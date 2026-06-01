---
title: "PTE update 뒤 TLB invalidate가 필요한 이유: dispatch 전 VA translation trace"
date: 2026-06-01
slug: "opencl-pte-tlb-invalidate-dispatch-trace"
draft: false
type: "note"
series: "opencl-driver-internals"
tags: ["opencl", "vulkan", "driver-dev", "gpu-vm", "pte", "tlb", "pm4", "cond-exec", "mapped-buffer", "debugging"]
difficulty: "advanced"
layer: "OpenCL -> Vulkan -> UMD/KMD -> PM4"
---

GPU page table의 PTE를 올바르게 고쳤다고 해서 다음 dispatch가 곧바로 새 mapping을 쓰는 것은 아니다. GPU의 address translation cache가 이전 translation을 기억하고 있다면 page walker는 새 PTE를 다시 읽지 않을 수 있다.

오늘은 한 buffer remap이 dispatch까지 내려가는 짧은 trace를 따라간다.

~~~text
clEnqueueNDRangeKernel
  -> descriptor points at GPU VA
  -> KMD updates PTE for that VA
  -> required TLB invalidate completes
  -> PM4 dispatch executes
  -> shader access uses the new translation
~~~

핵심은 `PTE update`와 `TLB invalidate`가 서로 다른 일을 한다는 점이다.

## PTE와 TLB를 먼저 분리하기

단순화해서 GPU VA `0x82001000`을 새 physical page로 다시 bind한다고 하자.

~~~text
GPU VA 0x82001000
  old PTE -> physical page A
  new PTE -> physical page B

translation cache before invalidate
  cached: 0x82001000 -> physical page A
~~~

- `PTE update`: page table memory에 새 mapping을 기록한다.
- `TLB invalidate`: 이전 translation cache entry를 버려 GPU가 새 mapping을 다시 보게 만든다.
- `dispatch`: descriptor가 가진 VA를 shader가 실제로 접근하는 시점이다.

PTE가 page B를 가리켜도 stale TLB entry가 남아 있으면 shader는 page A를 계속 읽거나 쓸 수 있다. 이전 mapping이 이미 제거되었다면 VM fault가 날 수도 있다.

## trace walkthrough: BO remap 직후 dispatch

OpenCL buffer `out_buf`를 재사용하는 상황을 보자. frontend와 UMD가 만든 descriptor는 정상이다.

~~~text
t0 OpenCL runtime
  enqueue kernel=write_out event=E301 queue=Q0

t1 UMD descriptor record
  arg1=out_buf binding=1 bo=82 va=[0x82000000,0x82400000)
  descriptor_generation=24 status=ok

t2 KMD VM update
  vmid=5 bo=82 vm_bind_seq=4510
  pte_update_batch=214 va=0x82001000 new_page=B status=written

t3 KMD translation visibility
  tlb_invalidate_batch=214 vmid=5 status=completed

t4 PM4-visible submit order
  WAIT_VM_UPDATE batch=214
  SET_DESCRIPTOR_BASE generation=24
  DISPATCH_DIRECT groups=(256,1,1)
  RELEASE_MEM fence=1004
~~~

이 순서에서는 shader access가 시작되기 전에 새 PTE와 translation-cache visibility가 모두 준비된다.

driver trace에서 확인할 invariant는 아래처럼 읽을 수 있다.

~~~text
BO bind / PTE write
  -> required TLB invalidate
  -> invalidate completion or ordering dependency
  -> descriptor state setup
  -> dispatch
  -> fence/event completion
~~~

실제 GPU와 KMD마다 packet 이름과 invalidate 범위는 다르다. 중요한 것은 특정 packet 이름을 외우는 일이 아니라, 새 translation이 dispatch보다 먼저 관찰 가능해야 한다는 계약이다.

## 누락 trace: PTE는 맞는데 여전히 fault가 난다

문제가 있는 trace는 이렇게 보일 수 있다.

~~~text
pte_update_batch=215 va=0x82001000 new_page=B status=written
SET_DESCRIPTOR_BASE generation=25
DISPATCH_DIRECT groups=(256,1,1)
TLB_INVALIDATE batch=215 vmid=5

fault:
  submit=1005 vmid=5 fault_va=0x82001040
  access=write reason=page_not_present
~~~

PTE dump만 보면 새 mapping은 존재한다. descriptor range도 맞다. 하지만 invalidate가 dispatch 뒤로 밀렸으므로 shader access 시점에는 stale translation을 썼을 수 있다.

이때 아래 세 질문을 따로 확인해야 한다.

| 질문 | 확인할 로그 |
|---|---|
| descriptor가 올바른 VA/range를 가리키는가 | binding, descriptor generation, VA range |
| page table memory에 새 mapping이 기록되었는가 | VM bind seq, PTE update batch, PTE present/permission |
| GPU가 새 translation을 보게 되었는가 | TLB invalidate batch, VMID, ordering dependency, dispatch 위치 |

`PTE present=true` 하나만 보고 translation visibility까지 증명했다고 간주하면 안 된다.

## COND_EXEC로 invalidate 순서를 대신할 수 없다

어제 본 `COND_EXEC`를 이 trace에 넣어 보면 차이가 더 선명하다.

~~~text
PTE_UPDATE batch=215
COND_EXEC invalidate_done == 1
  -> guarded DISPATCH_DIRECT
~~~

`COND_EXEC`는 조건값을 읽고 guarded packet을 실행하거나 skip한다. 조건이 아직 `0`이면 기다리는 대신 dispatch를 건너뛸 수 있다. 조건이 `1`이어도 필요한 TLB invalidate나 cache action을 스스로 수행하지 않는다.

dependency가 필요하다면 개념적으로 아래 순서가 필요하다.

~~~text
PTE_UPDATE
TLB_INVALIDATE
WAIT / ordering dependency until translation visibility is ready
DISPATCH_DIRECT
~~~

| 도구 | 하는 일 | 하지 않는 일 |
|---|---|---|
| `COND_EXEC` | 조건에 따라 packet 구간 실행 또는 skip | 조건 충족까지 wait, TLB invalidate, cache visibility 보장 |
| wait/dependency | 필요한 선행 작업 완료까지 진행 제어 | translation cache를 자동으로 invalidate한다고 단정할 수 없음 |
| TLB invalidate | stale address translation 제거 | 일반 data cache visibility를 자동으로 해결한다고 단정할 수 없음 |

translation cache와 data cache도 구분해야 한다. TLB invalidate는 주소 변환을 새로 보게 만드는 작업이다. producer가 쓴 buffer 내용을 consumer가 새 값으로 읽게 만드는 data-cache flush/invalidate 계약과는 별개다.

## mapped/pinned buffer도 측정이 필요한 이유

앱에서 mapped/pinned buffer를 쓰면 staging copy를 줄일 수 있다. 하지만 copy 하나가 사라졌다는 사실만으로 end-to-end latency가 줄었다고 결론 내리면 안 된다.

~~~text
mapped/pinned path
  fewer copies
  + host/device synchronization
  + cache maintenance
  + mapping lifetime and residency pressure

staging path
  explicit copy
  + often simpler ownership and synchronization points
~~~

작은 transfer를 자주 동기화하거나, cache maintenance 비용이 copy 절감보다 크거나, pinned memory가 residency pressure를 키우면 staging path가 더 나을 수 있다. 선택 기준은 copy 개수가 아니라 실제 workload의 end-to-end measurement다.

## what this means for driver dev

- submit trace에는 `vmid`, BO, VA range, VM bind seq, PTE update batch, TLB invalidate batch, descriptor generation, dispatch 위치, fence seq를 같은 submit id로 묶어 남긴다.
- `PTE update 완료`와 `TLB invalidate 완료`를 별도 상태로 기록한다. page table dump 하나만으로 dispatch 안전성을 판정하지 않는다.
- invalidate 범위가 VMID/context와 맞는지 확인한다. 올바른 mapping을 고쳤어도 다른 address space의 translation cache만 비우면 문제가 남는다.
- `COND_EXEC`, dependency wait, TLB invalidate, data-cache action을 서로 대체 가능한 것으로 취급하지 않는다.
- fault VA가 descriptor range 안에 있으면 shader bug로 바로 좁히지 말고 PTE present/permission, residency, TLB invalidate ordering을 함께 확인한다.
- OpenCL event는 fault 경로에서 terminal error로 전이되어야 한다. fence wait만 남겨 두면 앱에는 무한 대기처럼 보인다.

## app-facing takeaway

- mapped/pinned buffer는 항상 빠른 경로가 아니다. staging copy와 비교할 때 transfer 크기, 빈도, synchronization, cache maintenance를 함께 측정한다.
- buffer를 비동기로 재사용한다면 이전 kernel event 완료와 lifetime을 명확히 지킨다.
- GPU fault가 재사용 직후에만 난다면 kernel 코드뿐 아니라 buffer lifetime, map/unmap 시점, queue dependency도 같이 확인한다.

---

## 관련 글

- [dispatch 전에 page table과 residency 순서를 고정하기]({{< relref "2026-05-29-opencl-note-page-table-residency-ordering.md" >}})
- [stalled dispatch를 ring wptr/rptr/fence로 좁혀 가는 법]({{< relref "2026-05-31-opencl-note-ring-wptr-rptr-fence-stall-trace.md" >}})
- [OpenCL event COMPLETE와 memory visibility는 같은 말이 아니다]({{< relref "2026-05-13-opencl-note-event-complete-vs-memory-visibility.md" >}})

## 관련 용어

- [[command-queue]], [[descriptor-set]], [[pm4-packet]], [[event]]

