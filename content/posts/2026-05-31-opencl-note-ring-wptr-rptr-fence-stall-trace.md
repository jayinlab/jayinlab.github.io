---
title: "stalled dispatch를 ring wptr/rptr/fence로 좁혀 가는 법"
date: 2026-05-31
slug: "opencl-ring-wptr-rptr-fence-stall-trace"
draft: false
type: "note"
series: "opencl-driver-internals"
tags: ["opencl", "vulkan", "driver-dev", "kmd", "pm4", "ring-buffer", "wptr", "rptr", "fence", "cond-exec", "hang", "debugging"]
difficulty: "advanced"
layer: "CL"
---

OpenCL kernel enqueue가 끝났는데 event가 계속 완료되지 않는다고 가정하자. 이때 `ring wptr`, `ring rptr`, 마지막 완료 `fence`, checkpoint를 함께 보면 GPU가 **아예 새 command를 받지 못했는지**, **받고도 특정 구간에서 멈췄는지**, **끝까지 갔지만 completion 관찰이 끊겼는지**를 나눌 수 있다.

오늘은 아래 한 경로를 따라간다.

~~~text
clEnqueueNDRangeKernel
  -> Vulkan compute dispatch submit
  -> UMD builds IB
  -> KMD appends work to compute ring and updates wptr
  -> GPU command processor advances rptr
  -> PM4 dispatch executes
  -> completion fence write
  -> OpenCL event becomes COMPLETE
~~~

핵심은 pointer 하나만 보고 결론을 내리지 않는 것이다. `wptr`, `rptr`, fence는 서로 다른 질문에 답한다.

## 먼저 용어를 분리하기

단순화한 compute ring을 보자.

~~~text
old work                         newly submitted work
... | WAIT | IB_CALL | ... | DISPATCH | RELEASE_MEM fence=204 | ...
                    ^ old wptr                              ^ new wptr
                              ^ sampled rptr
~~~

- `wptr`: producer 쪽에서 GPU가 읽을 수 있도록 제출한 ring tail이다.
- `rptr`: command processor가 소비한 위치를 나타내는 관찰값이다.
- `fence`: 특정 submit의 completion 지점을 실제로 통과했는지 보여 주는 별도 증거다.
- `checkpoint`: IB 내부의 어느 논리 구간까지 왔는지 더 세밀하게 남기는 보조 증거다.

실제 하드웨어와 driver에 따라 pointer 레지스터, shadow memory, 업데이트 시점은 다를 수 있다. 따라서 한 번의 snapshot을 절대적인 instruction PC처럼 읽으면 안 된다. 같은 hang 분석에서 반복 sampling하고 submit metadata와 맞춰 보는 편이 안전하다.

## trace walkthrough: event E77이 끝나지 않는다

OpenCL runtime이 `E77`을 기다리고 있다고 하자.

~~~text
t0 OpenCL runtime
  enqueue kernel=blur event=E77 queue=Q0

t1 UMD submit
  submit=S204 ib=IB61 expected_fence=204
  vk_dispatch=(120, 68, 1)

t2 KMD ring append
  engine=compute0 wptr_before=0x180 wptr_after=0x1c0
  doorbell=0x1c0 job=J204 ib=IB61 expected_fence=204

t3 watchdog sample
  engine=compute0 sampled_wptr=0x1c0 sampled_rptr=0x198
  last_completed_fence=203 expected_fence=204
  last_checkpoint=IB61:before_dispatch
~~~

이 로그만으로도 몇 가지를 말할 수 있다.

- `wptr_after=0x1c0`이 기록되었으므로 KMD는 새 tail까지 제출하려 했다.
- `rptr=0x198`은 GPU가 ring의 일부를 소비했다는 단서다.
- `last_completed_fence=203`이므로 `S204`의 completion packet은 아직 관찰되지 않았다.
- `last_checkpoint=before_dispatch`가 반복되면 dispatch 진입 전후 구간을 우선 조사할 가치가 있다.

하지만 아직 원인은 확정되지 않았다. wait dependency, 잘못된 descriptor, non-resident VA, shader hang, interrupt/completion 처리 누락이 모두 후보로 남는다.

## 세 가지 pointer 패턴을 구분하기

### 1. wptr도 움직이지 않았다

~~~text
submit=S204 queued_in_runtime=true
wptr_before=0x180 wptr_after=0x180
rptr=0x180
fence=203
~~~

이 경우 GPU hang부터 의심하면 너무 이르다. UMD batching, KMD scheduler queue, dependency wait, ring-space 확보, VM bind 준비 단계에서 아직 GPU-visible submit이 만들어지지 않았을 수 있다.

### 2. wptr는 움직였지만 rptr가 같은 위치에 머문다

~~~text
wptr=0x1c0
rptr samples=[0x180, 0x180, 0x180]
fence=203
~~~

doorbell 전달, ring memory visibility, engine scheduling, 앞선 wait packet을 확인해야 한다. 특히 CPU가 ring bytes를 완전히 보이게 하기 전에 tail/doorbell이 먼저 관찰되는 ordering 버그와, 정상적인 dependency wait를 구분해야 한다.

### 3. rptr는 진행했지만 fence 직전에서 멈춘다

~~~text
wptr=0x1c0
rptr samples=[0x190, 0x198, 0x198]
checkpoint=IB61:before_dispatch
fence=203 expected=204
~~~

이 경우 packet decode, IB checkpoint, fault status를 같이 본다. descriptor state, PTE present/permission, residency, TLB invalidation, shader execution hang을 좁혀야 한다. `rptr`가 움직였다는 이유만으로 dispatch 성공이나 result visibility를 주장할 수는 없다.

## COND_EXEC는 synchronization packet이 아니다

AMD PM4의 `COND_EXEC` 류 packet은 조건값에 따라 뒤쪽 packet 구간을 실행하거나 건너뛰는 predication 도구다. 조건을 만족할 때까지 기다리는 wait나, cache를 flush/invalidate하는 barrier가 아니다.

~~~text
COND_EXEC condition_memory == 1
  -> true:  execute guarded packets
  -> false: skip guarded packets
~~~

반면 producer 결과를 기다린 뒤 consumer를 실행하려면 개념적으로 아래가 필요하다.

~~~text
producer work
  -> release / required cache action
  -> signal value

consumer queue
  -> wait until signal reaches expected value
  -> acquire / required cache action
  -> consumer work
~~~

`COND_EXEC`를 wait처럼 사용하면 조건을 너무 일찍 읽었을 때 consumer packet을 그냥 건너뛸 수 있다. 또 true였더라도 필요한 cache visibility를 자동으로 만들지 않는다.

| 질문 | `COND_EXEC` | wait/fence | cache action |
|---|---|---|---|
| 조건에 따라 packet 구간을 skip할 수 있는가 | 예 | 보통 목적이 아님 | 아니오 |
| dependency가 만족될 때까지 기다리는가 | 아니오 | 예 | 아니오 |
| producer write를 consumer에게 보이게 하는가 | 아니오 | 단독으로는 부족할 수 있음 | 필요한 범위에서 담당 |

stalled-dispatch trace에서 `COND_EXEC`가 보이면 "sync가 이미 있다"고 결론 내리지 말고, 어떤 packet을 skip할 수 있는지와 실제 wait/cache action이 별도로 있는지를 확인해야 한다.

## 로그를 한 줄로 묶는 이유

hang triage 로그는 pointer만 나열하기보다 하나의 submit identity로 연결하는 편이 낫다.

~~~text
queue=Q0 engine=compute0 submit=S204 job=J204 event=E77
ib=IB61 wptr_before=0x180 wptr_after=0x1c0 sampled_rptr=0x198
expected_fence=204 last_completed_fence=203 checkpoint=before_dispatch
vmid=5 fault_status=none reset_epoch=12
~~~

이후 watchdog sample에서도 같은 필드를 반복 기록하면 정체 구간을 비교할 수 있다.

~~~text
sample#1 rptr=0x198 fence=203 checkpoint=before_dispatch
sample#2 rptr=0x198 fence=203 checkpoint=before_dispatch
sample#3 rptr=0x198 fence=203 checkpoint=before_dispatch timeout=true
~~~

fault가 잡히면 같은 submit에 fault VA, VMID, BO, PTE 상태를 연결한다. reset이 발생하면 이전 글에서 본 것처럼 epoch와 terminal event error도 이어 붙인다.

## what this means for driver dev

- enqueue, UMD submit, KMD job, ring tail, IB, fence sequence, OpenCL event를 같은 submit id로 연결해야 한다.
- `wptr`는 제출 의도, `rptr`는 command processor 소비 진행, fence는 completion 지점 통과를 보여 주는 서로 다른 증거다. pointer 하나만으로 성공을 판정하지 않는다.
- watchdog은 pointer를 한 번만 덤프하지 말고 반복 sampling해서 정체인지 느린 진행인지 구분해야 한다.
- `rptr`가 fence 전에 멈추면 IB checkpoint, packet decode, descriptor state, fault VA/PTE/residency, TLB invalidate 이력을 함께 본다.
- `COND_EXEC` predication, wait/fence synchronization, cache flush/invalidate를 서로 대체 가능한 것으로 취급하면 안 된다.
- fence가 관찰되더라도 cache visibility와 OpenCL event success는 별도 계약이다. reset/error 경로에서는 terminal status도 확인해야 한다.

## app-facing takeaway

앱 개발자는 ring pointer를 직접 보지 않지만, 작은 dispatch를 지나치게 많이 쪼개면 submit, scheduling, fence bookkeeping 비용과 stall 관찰 지점이 늘어난다.

- 독립적인 tiny kernel이 많다면 batching이나 kernel fusion을 측정해 볼 가치가 있다.
- out-of-order queue에서는 event wait-list를 정확히 유지해야 정상 dependency wait와 실제 hang을 구분하기 쉽다.
- local size는 감으로 고정하지 말고 sweep profiling으로 고른다. stall처럼 보이는 느린 kernel과 실제 진행 정지를 구분하는 데도 도움이 된다.

---

## 관련 글

- [OpenCL 드라이버의 ring buffer와 doorbell: submit이 GPU 실행으로 바뀌는 경계]({{< relref "2026-05-18-opencl-note-ring-doorbell-submit-boundary.md" >}})
- [PM4 IB chain과 checkpoint: GPU hang에서 어디까지 실행됐는지 찾기]({{< relref "2026-05-23-opencl-note-ib-chain-checkpoint-observability.md" >}})
- [GPU reset 뒤 timeline을 그대로 믿으면 안 되는 이유]({{< relref "2026-05-30-opencl-note-reset-epoch-terminal-event.md" >}})

## 관련 용어

- [[command-queue]], [[pm4-packet]], [[ring-buffer]], event
