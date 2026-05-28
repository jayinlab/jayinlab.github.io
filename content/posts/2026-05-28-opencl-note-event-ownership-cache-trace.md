---
title: "event wait에서 ownership transfer와 cache visibility까지 따라가기"
date: 2026-05-28
slug: "opencl-event-ownership-cache-trace"
draft: false
type: "note"
series: "opencl-driver-internals"
tags: ["opencl", "vulkan", "event", "queue", "synchronization", "cache", "pm4", "driver-dev"]
difficulty: "advanced"
layer: "OpenCL -> Vulkan -> PM4"
---

OpenCL 앱에서 아래 코드는 평범해 보인다.

~~~c
clEnqueueNDRangeKernel(q0, producer, 1, NULL, &global, &local, 0, NULL, &prod_evt);
clEnqueueNDRangeKernel(q1, consumer, 1, NULL, &global, &local, 1, &prod_evt, &cons_evt);
~~~

앱 표면의 의미는 단순하다.

> consumer는 producer가 만든 데이터를 기다린 뒤 실행한다.

드라이버 표면에서는 이 문장이 훨씬 더 복잡해진다. 기다린다는 것은 적어도 세 층으로 쪼개진다.

- producer dispatch가 실제로 끝났는가
- producer가 쓴 memory가 consumer가 읽을 domain에 visible한가
- queue/engine/context가 다르면 ownership이나 access 권한 전환도 맞는가

오늘은 이 경로를 하나의 trace로 본다.

~~~text
OpenCL event waitlist
  -> ANGLE/OpenCL command dependency edge
  -> Vulkan queue submission + semaphore/fence/barrier choice
  -> PM4 wait/cache action/fence packet ordering
  -> OpenCL event completion or error propagation
~~~

핵심은 event wait를 하나의 신호로 뭉개지 않는 것이다. event는 dependency의 이름이고, driver는 그 dependency를 execution order, memory visibility, ownership/access transition으로 낮춰야 한다.

## 예제: queue 두 개가 buffer 하나를 넘겨받는 경우

예제는 intentionally 작게 둔다.

~~~c
// q0: out_buf를 쓴다.
clSetKernelArg(producer, 0, sizeof(cl_mem), &out_buf);
clEnqueueNDRangeKernel(q0, producer, 1, NULL, &global, &local, 0, NULL, &prod_evt);

// q1: prod_evt 뒤에 out_buf를 읽는다.
clSetKernelArg(consumer, 0, sizeof(cl_mem), &out_buf);
clEnqueueNDRangeKernel(q1, consumer, 1, NULL, &global, &local, 1, &prod_evt, &cons_evt);
~~~

같은 in-order queue라면 command 순서만으로 일부 문제가 단순해질 수 있다. 하지만 queue가 다르거나 backend에서 다른 engine/timeline으로 낮아질 수 있으면 이야기가 달라진다.

producer 쪽은 최소한 이런 사실을 남겨야 한다.

~~~text
event=E100 command=producer queue=Q0 submit=70 engine=compute0
resource:
  out_buf bo=53 va=[0x73000000,0x73400000) access=shader_write
pm4:
  dispatch_direct packet=184
  cache_action=release/out_buf packet=191
  signal timeline_value=700 packet=193
  fence_write event_complete_candidate=E100 packet=194
~~~

consumer 쪽은 이 event를 기다린다는 사실을 다른 형태로 기록해야 한다.

~~~text
event=E101 command=consumer queue=Q1 submit=71 engine=compute1
waits:
  event=E100 timeline_value=700
resource:
  out_buf bo=53 va=[0x73000000,0x73400000) access=shader_read
pm4:
  wait timeline_value=700 packet=22
  cache_action=acquire/invalidate out_buf packet=24
  dispatch_direct packet=31
  fence_write event_complete_candidate=E101 packet=44
~~~

이 trace에서 중요한 순서는 아래다.

~~~text
producer writes out_buf
  -> producer release/cache action
  -> producer signal observed by consumer
  -> consumer acquire/invalidate
  -> consumer reads out_buf
~~~

wait packet만 있고 release/acquire가 빠지면 실행 순서는 맞아도 값이 오래될 수 있다. 반대로 cache action은 있는데 wait가 없으면 consumer가 너무 빨리 읽을 수 있다.

## Vulkan으로 낮출 때의 세 가지 질문

OpenCL event waitlist를 Vulkan backend로 낮춘다고 가정하면 driver는 보통 세 질문을 분리해야 한다.

### 1. execution dependency는 무엇으로 표현할까

같은 queue 안에서는 submit order나 command buffer order로 충분할 수 있다. queue가 다르면 semaphore, sync object, timeline value 같은 primitive가 필요하다.

중요한 것은 OpenCL event id와 backend sync value를 연결하는 metadata다.

~~~text
OpenCL E100
  -> producer submit=70
  -> backend timeline value=700
  -> consumer submit=71 waits value=700
~~~

이 연결이 없으면 clWaitForEvents(E100)가 멈췄을 때 fence 문제인지, GPU fault인지, wait edge 누락인지 추적하기 어렵다.

### 2. memory dependency는 어떤 access mask/domain을 덮어야 할까

producer가 shader write를 했고 consumer가 shader read를 한다면 Vulkan 쪽에서는 shader write -> shader read 가시성을 표현해야 한다.

대충 아래 의미가 필요하다.

~~~text
src: compute shader write to out_buf
dst: compute shader read from out_buf
resource: out_buf range
~~~

stage/access mask가 너무 좁으면 실제 write/read를 덮지 못한다. 너무 넓으면 correctness는 맞아도 불필요한 stall이 커진다. 여기서 app-dev 최적화와 driver-dev correctness가 만난다.

### 3. ownership/access 전환이 필요한가

Vulkan에는 queue family ownership 같은 개념이 있다. 실제 구현이 OpenCL queue를 어떻게 Vulkan queue나 internal engine에 배치하느냐에 따라 ownership transfer가 필요할 수도 있고, 내부적으로 단일 ownership으로 숨길 수도 있다.

중요한 점은 ownership transfer와 cache visibility가 같은 말이 아니라는 것이다.

~~~text
ownership/access transition: 이 queue/engine이 resource를 사용할 권한을 갖는가
cache visibility: 이전 write가 다음 read에 최신 값으로 보이는가
execution wait: 다음 작업이 이전 작업 뒤에 실행되는가
~~~

셋은 같이 배치될 수 있지만, 로그와 invariant에서는 분리해서 봐야 한다.

## PM4 관점: packet ordering에서 확인할 것

PM4 수준으로 내려오면 질문은 더 구체적이다.

producer submit 안에서:

~~~text
DISPATCH producer
RELEASE/CACHE action for out_buf
SIGNAL value consumed by q1
FENCE/INTERRUPT used to mark E100 complete
~~~

consumer submit 안에서:

~~~text
WAIT value from q0
ACQUIRE/INVALIDATE for out_buf
DISPATCH consumer
FENCE/INTERRUPT used to mark E101 complete
~~~

문제는 packet이 있다는 사실만으로 충분하지 않다는 것이다. 위치가 맞아야 한다.

나쁜 producer 예시는 아래다.

~~~text
DISPATCH producer
SIGNAL value=700
RELEASE/CACHE action for out_buf
~~~

consumer가 value=700만 보고 진행하면 release 전에 읽기 준비를 시작할 수 있다. backend가 실제로는 더 강한 ordering을 보장할 수도 있지만, trace만 봤을 때는 invariant가 약하다.

나쁜 consumer 예시는 아래다.

~~~text
ACQUIRE/INVALIDATE out_buf
WAIT value=700
DISPATCH consumer
~~~

invalidate가 producer signal을 기다리기 전에 실행되면, producer write 이후의 cache state를 대상으로 한 acquire가 아니다.

내가 보고 싶은 invariant는 이렇다.

~~~text
producer release happens before producer signal
consumer wait observes producer signal before consumer acquire
consumer acquire happens before consumer dispatch
event COMPLETE is attributed after the required packet sequence
~~~

## 실패 증상을 분류하는 법

이 trace에서 문제가 생기면 증상은 비슷해 보일 수 있다. 하지만 첫 질문은 달라야 한다.

| 증상 | 먼저 볼 축 | 확인할 로그 |
|---|---|---|
| consumer가 오래된 값을 읽음 | cache visibility | release/signal/wait/acquire packet 순서 |
| consumer가 너무 빨리 실행됨 | execution dependency | event id -> timeline wait edge |
| enqueue나 submit이 layout/usage 오류 | ownership/access contract | resource usage, queue ownership, access mask |
| GPU VM fault | address/residency | descriptor VA range, BO lifetime, VM bind |
| clWaitForEvents가 hang | completion/fault propagation | fence seq, fault wakeup, event terminal state |

이 표는 원인을 자동 판정하기 위한 것이 아니다. stale data를 descriptor 문제로 몰거나, VM fault를 barrier 문제로 몰지 않게 첫 분기를 세우는 용도다.

## what this means for driver dev

driver dev 관점에서 event waitlist는 단순히 wait packet 하나를 넣는 기능이 아니다.

- OpenCL event id, backend timeline value, submit id, fence seq를 서로 추적 가능하게 묶어야 한다.
- wait edge를 만들 때 execution wait와 memory visibility action을 별도 invariant로 검사해야 한다.
- queue/engine이 갈라지는 경우 ownership/access transition과 cache visibility를 같은 로그에 넣되, 같은 개념으로 취급하지 않아야 한다.
- event COMPLETE는 필요한 release/acquire/cache action 뒤의 fence나 signal에 붙어야 한다.
- fault가 발생하면 fence 미완료만 기다리지 말고 event를 terminal error로 전이해 waiters를 깨워야 한다.

좋은 debug log는 이런 식의 한 줄 요약을 만들 수 있어야 한다.

~~~text
E101 waited E100(value=700), acquired out_buf after wait, dispatched at packet=31, completed fence=710
~~~

이 문장을 만들 수 없으면 event waitlist lowering의 어느 층이 끊겼는지 찾기 어렵다.

## app-facing takeaway

앱 개발자 입장에서는 waitlist를 가능한 한 정확한 data dependency로 표현하는 것이 중요하다.

- producer가 쓴 buffer를 consumer가 읽으면 event waitlist로 그 관계를 드러낸다.
- 관련 없는 작업까지 같은 event에 묶으면 backend가 병렬 실행과 좁은 barrier를 쓰기 어렵다.
- stale data가 보이면 단순히 clFinish를 더 넣기 전에 buffer lifetime, map/unmap, blocking read, queue 간 dependency를 먼저 줄여서 재현한다.
- pinned/mapped buffer나 host-visible path는 CPU cache maintenance까지 얽힐 수 있으므로, host가 언제 읽고 쓰는지도 trace에 포함한다.

앱은 dependency를 명확히 주고, driver는 그 dependency를 execution order와 visibility action으로 정확히 낮춰야 한다. 이 둘 중 하나가 빠지면 event는 있었는데 값은 틀린 상태가 된다.

---

## 관련 글

- [OpenCL Event Waitlist Lowering — API 의존성을 실제 wait로 낮추는 기준]({{< relref "2026-05-16-opencl-note-event-waitlist-lowering.md" >}})
- [OpenCL Sync Semantics — event COMPLETE와 memory visibility를 같은 것으로 보면 왜 깨지나]({{< relref "2026-05-13-opencl-note-event-complete-vs-memory-visibility.md" >}})
- [PM4 packet ordering과 cache visibility를 분리해서 보기]({{< relref "2026-05-10-opencl-note-pm4-ordering-vs-cache-visibility.md" >}})
- [GPU fault는 OpenCL event와 error로 어떻게 올라오나]({{< relref "2026-05-20-opencl-note-gpu-fault-to-event-error.md" >}})

## 관련 용어

- [[command-queue]], [[barrier]], [[pm4-packet]], [[descriptor-set]]
