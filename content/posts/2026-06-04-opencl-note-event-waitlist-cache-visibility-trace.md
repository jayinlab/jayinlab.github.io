---
title: "event wait-list에서 PM4 cache visibility까지: buffer handoff trace"
date: 2026-06-04
slug: "opencl-note-event-waitlist-cache-visibility-trace"
draft: false
type: "note"
series: "opencl-driver-internals"
tags: ["opencl", "event", "synchronization", "cache", "pm4", "vulkan", "driver-dev", "optimization"]
difficulty: "advanced"
layer: "CL"
---

OpenCL의 event wait-list는 API 표면에서는 단순히 “이 command는 저 event 뒤에 실행한다”는 조건처럼 보인다.  
하지만 driver 쪽으로 내려가면 이 조건은 네 가지 질문으로 쪼개진다.

1. consumer command를 언제 submit 가능한 상태로 볼 것인가?
2. producer의 완료를 어떤 fence/semaphore 값으로 관찰할 것인가?
3. producer가 쓴 memory가 consumer cache domain에서 보이도록 어떤 flush/invalidate가 필요한가?
4. 이 모든 조건이 끝난 뒤에 OpenCL event를 COMPLETE로 올려도 되는가?

오늘은 kernel A가 buffer를 쓰고 kernel B가 그 buffer를 읽는 한 경로만 따라가 본다.

## 왜 이 주제를 오늘 잡았나

어제는 VMID-scoped TLB invalidate trace를 보면서 descriptor correctness와 translation visibility를 분리했다.  
오늘 아침 fact feedback은 descriptor row, PM4 fence/cache visibility, local-size/occupancy sweep을 모두 이해한 것으로 들어왔다.

그래서 오늘은 그중 driver-dev 쪽 핵심인 **“fence가 signaled라는 증거와 cache visibility가 확보됐다는 증거는 다르다”**를 event wait-list trace에 붙여 복습한다.  
이 주제는 sync semantics, queue/event model, PM4 packet ordering/cache visibility를 한 번에 연결해 준다.

## 예제: A가 쓰고 B가 읽는 out-of-order queue

간단한 OpenCL 코드를 가정한다.

~~~c
cl_event a_done;

clEnqueueNDRangeKernel(q, kernelA, 1, NULL, &gws, &lws,
                       0, NULL, &a_done);        // out_buf write

clEnqueueNDRangeKernel(q, kernelB, 1, NULL, &gws, &lws,
                       1, &a_done, NULL);        // out_buf read
~~~

앱 개발자 눈에는 kernel B가 a_done 뒤에 실행되면 충분해 보인다.  
driver 눈에는 kernel B가 늦게 실행되는 것만으로는 부족하다. kernel A의 write 결과가 kernel B가 읽는 cache path에서 실제로 보일 수 있어야 한다.

## driver 내부 trace로 펼치기

개념적으로는 아래처럼 내려간다.

~~~text
OpenCL API:
  A writes out_buf -> event a_done
  B waits a_done, then reads out_buf

UMD dependency graph:
  node A: write(out_buf)
  node B: read(out_buf)
  edge A -> B, resource hazard = write-to-read

Vulkan-ish lowering:
  submit A
    signal semaphore/fence S=41
  submit B
    wait S=41
    apply memory dependency for shader-write -> shader-read

PM4-visible intent:
  DISPATCH A
  RELEASE/EVENT_WRITE or fence signal for A completion point
  WAIT for A completion point before B
  CACHE_FLUSH/INVALIDATE or acquire-side action for out_buf visibility
  DISPATCH B
~~~

실제 packet 이름과 위치는 GPU/driver마다 다르지만, debug trace에서 봐야 하는 축은 비슷하다.
여기서도 semaphore wait은 실행 순서/progress의 증거이고, shader-write → shader-read memory dependency는 올바른 stage/access/resource scope가 붙을 때 의미가 생긴다고 분리해서 읽어야 한다.

| 축 | 증명하는 것 | 증명하지 않는 것 |
|---|---|---|
| wait-list edge | B가 A에 의존한다 | cache가 이미 정리됐다는 뜻은 아님 |
| fence/semaphore signal | A의 완료 지점을 관찰할 수 있음 | B가 최신 데이터를 읽는다는 뜻은 아님 |
| PM4 wait packet | B가 A 완료 전 실행되지 않음 | cache domain visibility를 자동 보장하지 않음 |
| flush/invalidate/acquire | 필요한 memory domain이 정리됨 | descriptor/VA가 맞다는 뜻은 아님 |
| event COMPLETE | API가 약속한 완료 상태에 도달 | 다른 독립 resource까지 전역 정리됐다는 뜻은 아님 |

핵심은 하나다. **ordering evidence와 visibility evidence를 같은 로그 필드로 뭉개면 안 된다.**

## 흔한 버그: wait는 있는데 stale read가 난다

문제 상황을 조금 더 구체화해 보자.

~~~text
submit 220:
  descriptor out_buf -> va 0x91000000
  DISPATCH A writes out_buf
  EVENT_WRITE fence=1200

submit 221:
  WAIT_REG_MEM fence >= 1200
  DISPATCH B reads out_buf
~~~

겉보기에는 순서가 맞다. B는 fence 1200을 기다린 뒤 실행된다.  
그런데 shader write가 consumer read path에서 보이도록 필요한 cache action이 빠져 있다면 B는 stale value를 읽을 수 있다.

이 버그는 event timeline만 보면 잘 안 잡힌다.

~~~text
OpenCL event:
  A COMPLETE
  B COMPLETE

app symptom:
  B output sometimes contains old data
~~~

이때 “event가 COMPLETE인데 왜 값이 낡았지?”라고 보면 막힌다. 더 좋은 질문은 “A COMPLETE를 올리기 전 또는 B dispatch 전 visibility action이 어떤 domain/scope로 들어갔나?”다.

## 반대 버그: 모든 COMPLETE에 전역 flush

반대로 correctness가 무서워서 모든 event completion 지점에 강한 global flush를 넣을 수도 있다.

~~~text
DISPATCH A
GLOBAL_FLUSH_ALL
EVENT_WRITE fence=1200
WAIT fence>=1200
GLOBAL_INVALIDATE_ALL
DISPATCH B
~~~

이 방식은 처음에는 안전해 보이지만, queue throughput과 tail latency를 크게 깎는다. 특히 작은 kernel을 많이 던지거나 local-size sweep처럼 같은 kernel을 여러 설정으로 반복 측정할 때 sync 비용이 kernel 실행 시간보다 커질 수 있다.

좋은 driver는 “항상 전역 정리”가 아니라 resource hazard와 consumer domain에 맞춰 최소 visibility action을 고른다.

## descriptor/VA/TLB와도 독립이다

어제 VMID/TLB trace와 연결하면 debug 축이 더 선명하다.

~~~text
B가 stale value를 읽었다:
  1. wait-list edge가 빠졌나?
  2. fence wait가 잘못된 값/queue를 기다렸나?
  3. cache flush/invalidate scope가 부족했나?
  4. descriptor row가 old BO/old offset을 가리키나?
  5. VA/PTE/TLB가 old physical page를 가리키나?
~~~

이 다섯 질문은 서로를 대체하지 않는다.

descriptor row가 정확해도 cache visibility가 빠지면 stale data가 가능하다.  
cache action이 있어도 descriptor가 old buffer를 가리키면 틀린 데이터를 읽는다.  
descriptor와 cache가 맞아도 VMID/TLB scope가 틀리면 다른 physical page로 갈 수 있다.

driver trace는 그래서 아래 필드를 함께 남기는 편이 좋다.

~~~text
submit_id=221
opencl_event_waited=a_done
producer_fence=1200
consumer_wait_packet=WAIT_REG_MEM fence>=1200
resource=out_buf bo=77 va=[0x91000000,0x91400000)
descriptor_generation=44
visibility_action=shader_write -> shader_read, scope=out_buf/domain
vmid=7 page_table_root=PTR7 tlb_invalidate_batch=319
consumer_dispatch_packet=DISPATCH_DIRECT
~~~

한 줄 로그가 길어지더라도, 이렇게 분리해 두면 “완료는 됐는데 값이 틀린” 문제를 훨씬 빨리 좁힐 수 있다.

## what this means for driver dev

- event wait-list lowering은 dependency edge, fence/semaphore wait, cache visibility action을 별도 단계로 설계한다.
- OpenCL event COMPLETE를 “GPU retire만 봤다”로 올리지 않는다. 해당 API 경계에서 필요한 visibility action이 끝났는지 같이 본다.
- trace에는 event id, producer fence seq, consumer wait packet, resource hazard, descriptor generation, cache action scope, VMID/page-table-root를 같은 submit id로 묶는다.
- PM4 packet ordering을 볼 때 WAIT가 dispatch 앞에 있는지만 확인하지 말고, 그 사이에 필요한 release/acquire 또는 flush/invalidate가 있는지 확인한다.
- 성능 최적화는 global flush 제거가 아니라 **필요 domain으로 scope를 줄이는 작업**이다. 제거한 flush마다 어떤 hazard rule이 visibility를 대신 보장하는지 남겨야 한다.
- stale read triage에서는 event state만 보지 말고 descriptor row, VA/PTE/TLB, cache action, fence value를 독립 증거로 확인한다.

## app-facing takeaway

앱에서는 event wait-list를 가능한 한 정확한 data dependency로 표현하는 것이 좋다.  
관련 없는 작업까지 큰 event 하나에 묶으면 driver가 병렬 실행과 좁은 cache action을 선택하기 어렵다.

성능 측정에서도 clFinish를 중간중간 넣어 시간을 재면 실제 kernel 비용보다 global synchronization 비용을 더 크게 볼 수 있다.  
local-size sweep이나 mapped/pinned transfer 비교를 할 때는 kernel 실행 시간, queue wait, map/unmap, readback, synchronization을 나눠 재야 병목이 보인다.

---

## 관련 글

- [OpenCL Event Waitlist Lowering — API 의존성을 실제 wait로 낮추는 기준]({{< relref "2026-05-16-opencl-note-event-waitlist-lowering.md" >}})
- [OpenCL Sync Semantics — event COMPLETE와 memory visibility를 같은 것으로 보면 왜 깨지나]({{< relref "2026-05-13-opencl-note-event-complete-vs-memory-visibility.md" >}})
- [PM4 packet ordering과 cache visibility를 분리해서 보기]({{< relref "2026-05-10-opencl-note-pm4-ordering-vs-cache-visibility.md" >}})
- [VMID-scoped TLB invalidate를 context switch trace로 보기]({{< relref "2026-06-03-opencl-note-vmid-tlb-invalidate-context-trace.md" >}})

## 관련 용어

- [[command-queue]], [[barrier]], [[pm4-packet]], [[descriptor-set]]
