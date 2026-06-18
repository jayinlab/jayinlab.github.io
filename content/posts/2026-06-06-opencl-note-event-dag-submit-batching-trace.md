---
title: "event DAG에서 submit batch까지: OpenCL 의존성이 드라이버 제출을 바꾸는 지점"
date: 2026-06-06
slug: "opencl-event-dag-submit-batching-trace"
draft: false
type: "note"
series: "opencl-driver-internals"
tags: ["opencl", "event", "queue", "vulkan", "submission", "synchronization", "pm4", "driver-dev", "trace-walkthrough", "optimization"]
difficulty: "advanced"
layer: "CL"
---

OpenCL의 event wait-list는 API에서는 작은 배열 하나로 보인다.

~~~c
clEnqueueNDRangeKernel(queue, kernelC, 1, NULL, &gws, &lws,
                       2, wait_events, &c_done);
~~~

하지만 driver 쪽에서는 이 배열이 command dependency graph의 edge가 된다.  
그리고 이 edge는 단순히 “C를 늦게 실행한다”가 아니라, 아래 결정을 바꾼다.

- C를 같은 command buffer/batch에 넣을 수 있는가?
- 별도 Vulkan submit으로 쪼개고 semaphore/fence wait를 걸어야 하는가?
- barrier만으로 충분한가, queue boundary가 필요한가?
- PM4 stream에서는 wait packet과 cache action이 dispatch 앞에 실제로 놓이는가?

오늘은 event wait-list 하나가 submit batching과 command stream ordering을 어떻게 흔드는지 한 trace로 본다.

## 왜 이 주제를 오늘 잡았나

최근 feedback에서는 GPU VM/PTE/TLB 쪽이 아직 너무 하위 계층이라, OpenCL/Vulkan 이해를 먼저 더 쌓는 편이 좋다는 신호가 있었다.  
또 오늘 13:00 quiz에서는 event wait-list order와 host/result visibility, descriptor row와 pipeline layout schema 구분이 잘 맞았다.

그래서 오늘은 PM4/VM으로 바로 깊게 내려가기보다, OpenCL queue/event model이 Vulkan submit model로 낮아질 때 생기는 driver-dev 판단을 잡는다.  
PM4는 최종 결과를 확인하는 짧은 downstream 관찰 지점으로만 둔다.

## 예제: A와 B는 독립, C는 둘 다 기다린다

out-of-order queue 하나를 가정한다.

~~~c
cl_event a_done;
cl_event b_done;
cl_event waits[2];

clEnqueueNDRangeKernel(q, kernelA, 1, NULL, &gws, &lws,
                       0, NULL, &a_done);

clEnqueueNDRangeKernel(q, kernelB, 1, NULL, &gws, &lws,
                       0, NULL, &b_done);

waits[0] = a_done;
waits[1] = b_done;
clEnqueueNDRangeKernel(q, kernelC, 1, NULL, &gws, &lws,
                       2, waits, NULL);
~~~

OpenCL command graph는 이렇게 된다.

~~~text
A ----\
       +--> C
B ----/
~~~

A와 B 사이에는 dependency가 없다. C는 A와 B가 모두 끝난 뒤 실행되어야 한다.  
중요한 점은 wait-list 배열 순서가 실행 순서를 만드는 것이 아니라는 것이다.

~~~text
wait_events = [a_done, b_done]

means:
  C waits for A
  C waits for B

does not mean:
  A must run before B
~~~

driver가 이 차이를 놓치면 병렬로 보낼 수 있는 A/B를 쓸데없이 직렬화한다.

## 1. OpenCL runtime: event DAG 만들기

runtime은 enqueue 시점에 command node와 edge를 캡처한다.

~~~text
node A:
  queue=q
  writes=buf_a
  event=a_done

node B:
  queue=q
  writes=buf_b
  event=b_done

node C:
  queue=q
  reads=buf_a, buf_b
  waits=[a_done, b_done]
  edges=[A -> C, B -> C]
~~~

여기서 driver가 보존해야 하는 것은 두 가지다.

첫째, C는 A/B보다 먼저 실행되면 안 된다.  
둘째, A와 B 사이에는 새 순서를 만들면 안 된다.

두 번째가 성능에 중요하다. 불필요한 edge를 만들면 out-of-order queue가 in-order queue처럼 변한다.

## 2. Vulkan-ish lowering: batch를 합칠지 쪼갤지 고른다

Vulkan 쪽으로 낮출 때는 여러 선택지가 있다. 단순화하면 아래 세 가지다.

~~~text
case 1: one command buffer, internal barrier/order enough
  cmd: dispatch A
  cmd: dispatch B
  cmd: barrier A/B writes -> C reads
  cmd: dispatch C
  submit once

case 2: multiple command buffers, one submit batch
  submit:
    command_buffer_A
    command_buffer_B
    command_buffer_C_after_barriers

case 3: multiple submits with semaphore/fence edges
  submit A signals S_A
  submit B signals S_B
  submit C waits S_A and S_B
~~~

항상 case 3으로 가면 correctness는 표현하기 쉽지만 submit overhead가 커진다.  
항상 case 1로 우겨 넣으면 external queue dependency, host-visible event completion, resource hazard, command buffer recording boundary를 정확히 표현하기 어려울 수 있다.

좋은 UMD는 dependency graph를 보고 가능한 경우 batch를 합치되, event completion과 memory visibility를 흐리지 않는 경계를 유지한다.

## 3. fan-in edge는 submit 압력을 만든다

A와 B가 같은 queue 안에서 바로 기록 가능한 작업이라면 C 앞에 barrier를 넣고 한 submit으로 묶을 수 있다.

~~~text
record command buffer:
  DISPATCH A
  DISPATCH B
  BARRIER:
    src = shader-write from A/B
    dst = shader-read by C
    resources = buf_a, buf_b
  DISPATCH C

submit:
  signal final fence/event state
~~~

이 경우 CPU submit 횟수는 적다. 하지만 debug log에서는 C가 A/B를 기다린다는 semantic edge를 잃으면 안 된다.

~~~text
submit_id=800
opencl_edges=[A->C, B->C]
batching=merged
barrier_before=C
barrier_resources=[buf_a, buf_b]
~~~

반대로 A와 B가 이미 다른 submit으로 나갔거나, 서로 다른 queue/fence domain에 있거나, host가 중간 event를 관찰해야 한다면 C submit은 wait payload를 명시해야 한다.

~~~text
submit_id=801:
  dispatch A
  signal S_A=10

submit_id=802:
  dispatch B
  signal S_B=20

submit_id=803:
  wait S_A >= 10
  wait S_B >= 20
  barrier writes(A/B) -> reads(C)
  dispatch C
~~~

여기서 semaphore/fence wait는 execution ordering을 만든다.  
Vulkan에서는 semaphore wait도 올바른 stage/access scope의 barrier와 연결될 때 memory dependency의 일부가 될 수 있지만, 그 자체만으로 모든 shader write/read visibility를 설명했다고 보면 위험하다.  
따라서 trace에서는 progress signal과 resource별 visibility action을 따로 확인해야 한다.

## 4. PM4-visible 관찰: packet 순서가 semantic edge를 반영하는가

PM4 수준으로 보면 관심사는 더 좁아진다.

~~~text
merged batch shape:
  DISPATCH A
  DISPATCH B
  RELEASE/CACHE action for A/B writes if needed
  ACQUIRE/WAIT or barrier-equivalent ordering point before C
  DISPATCH C
  EVENT_WRITE final fence

split submit shape:
  submit A:
    DISPATCH A
    EVENT_WRITE S_A

  submit B:
    DISPATCH B
    EVENT_WRITE S_B

  submit C:
    WAIT S_A
    WAIT S_B
    ACQUIRE/CACHE action for buf_a, buf_b
    DISPATCH C
    EVENT_WRITE C done
~~~

실제 packet 이름은 GPU와 driver마다 다르다. 그래도 trace에서 확인할 질문은 안정적이다.

| 질문 | 봐야 할 증거 |
|---|---|
| C가 A/B 전에 실행되지 않는가? | C dispatch 앞의 wait/order point |
| A와 B를 불필요하게 직렬화하지 않았는가? | A->B edge가 없는 DAG와 packet/order trace |
| C가 최신 데이터를 읽는가? | write-to-read visibility action의 resource/scope |
| event COMPLETE가 너무 일찍 올라가지 않는가? | completion update가 wait/barrier 뒤에 있는지 |
| submit overhead가 과하지 않은가? | DAG 대비 submit count와 batch split reason |

중요한 것은 “event wait-list를 봤다”에서 멈추지 않는 것이다.  
driver-dev 관점에서는 wait-list edge가 실제 submit/batch/barrier/wait packet으로 어떻게 표현됐는지가 핵심이다.

## 5. 흔한 구현 실수

첫 번째 실수는 fan-in을 직렬 chain으로 바꾸는 것이다.

~~~text
wrong:
  A -> B -> C

intended:
  A -> C
  B -> C
~~~

wait_events[0] 다음에 wait_events[1]을 처리한다고 해서 A 뒤에 B edge를 만들면 안 된다.  
이렇게 되면 A와 B가 독립이어도 B가 A를 기다리는 형태가 되고, 작은 kernel 여러 개에서는 submit/queue latency가 바로 보인다.

두 번째 실수는 semaphore wait를 넣고도 resource별 memory dependency를 충분히 표현하지 않는 것이다.

~~~text
submit C:
  wait S_A
  wait S_B
  dispatch C
~~~

이 trace는 ordering은 있어 보이지만 A/B의 shader write가 C의 shader read에서 보이도록 하는 stage/access/resource scope가 빠져 있을 수 있다.

세 번째 실수는 모든 fan-in마다 submit을 쪼개는 것이다.

~~~text
A submit
B submit
C submit
D submit
...
~~~

OpenCL event graph를 너무 문자 그대로 Vulkan submit graph로 만들면 CPU overhead가 커진다.  
driver는 semantic edge를 유지하면서도 command buffer 내부 barrier나 batch merge로 표현 가능한 edge를 찾아야 한다.

## what this means for driver dev

- wait-list는 배열 순서가 아니라 DAG edge로 저장한다. [A, B]는 A->C, B->C이지 A->B->C가 아니다.
- scheduler/recorder는 edge마다 split reason을 남긴다. 예: same-batch barrier 가능, external queue wait 필요, host-visible event boundary 필요, resource hazard 때문에 acquire 필요.
- submit trace에는 OpenCL event id, producer fence/semaphore payload, consumer node, batch id, command buffer id, barrier resource/scope를 같이 남긴다.
- PM4 trace에서는 C dispatch 앞에 필요한 wait/order point와 cache/visibility action이 모두 있는지 확인한다.
- correctness를 위해 모든 edge를 별도 submit으로 낮추는 방식은 작은 kernel과 app-side sweep에서 큰 overhead가 된다. merge 가능한 edge와 반드시 split해야 하는 edge를 구분해야 한다.
- OpenCL event COMPLETE는 graph edge와 visibility action이 표현된 뒤에 올린다. 단순히 command buffer recording이 끝났다는 뜻으로 올리면 안 된다.

## app-facing takeaway

앱 개발자는 event wait-list를 실제 data dependency에 맞게 좁게 주는 편이 좋다.  
독립 kernel을 하나의 큰 event chain으로 묶으면 driver가 병렬 실행이나 batch merge를 활용하기 어렵다.

성능 측정에서는 kernel 시간이 짧을수록 submit 수와 synchronization 수가 결과를 크게 흔든다.  
local-size sweep이나 작은 dispatch 반복 테스트에서는 clFinish를 매번 넣는 방식보다, 필요한 event dependency만 걸고 마지막에 결과를 기다리는 형태가 더 실제 실행 비용에 가깝다.

---

## 관련 글

- [event wait-list에서 PM4 cache visibility까지: buffer handoff trace]({{< relref "2026-06-04-opencl-note-event-waitlist-cache-visibility-trace.md" >}})
- [OpenCL Event Waitlist Lowering — API 의존성을 실제 wait로 낮추는 기준]({{< relref "2026-05-16-opencl-note-event-waitlist-lowering.md" >}})
- [OpenCL Queue/Event Dependency Graph — driver는 command를 어떤 그래프로 보는가]({{< relref "2026-05-12-opencl-note-queue-event-dependency-graph.md" >}})
- [PM4 packet ordering과 cache visibility를 분리해서 보기]({{< relref "2026-05-10-opencl-note-pm4-ordering-vs-cache-visibility.md" >}})

## 관련 용어

- [[command-queue]], event, [[command-buffer]], [[pm4-packet]]
