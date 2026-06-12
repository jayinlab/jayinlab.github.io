---
title: "enqueue capture에서 barrier visibility까지: dispatch 하나가 고정되는 시점"
date: 2026-06-07
slug: "opencl-enqueue-capture-barrier-visibility"
draft: false
type: "note"
series: "opencl-driver-internals"
tags: ["opencl", "queue", "event", "vulkan", "barrier", "synchronization", "descriptor", "driver-dev", "trace-walkthrough", "optimization"]
difficulty: "advanced"
layer: "OpenCL -> ANGLE -> Vulkan -> UMD/KMD -> PM4"
---

OpenCL에서 `clEnqueueNDRangeKernel`은 단순한 실행 요청처럼 보인다.

~~~c
clSetKernelArg(kernel, 0, sizeof(cl_mem), &src_a);
clSetKernelArg(kernel, 1, sizeof(cl_mem), &dst_a);
clEnqueueNDRangeKernel(q, kernel, 1, NULL, &gws, &lws,
                       0, NULL, &event_a);

clSetKernelArg(kernel, 0, sizeof(cl_mem), &src_b);
clSetKernelArg(kernel, 1, sizeof(cl_mem), &dst_b);
clEnqueueNDRangeKernel(q, kernel, 1, NULL, &gws, &lws,
                       1, &event_a, &event_b);
~~~

앱 입장에서는 “첫 번째 dispatch는 `src_a/dst_a`, 두 번째 dispatch는 `src_b/dst_b`” 정도로 읽힌다.
하지만 driver/runtime 쪽에서는 enqueue 시점에 command가 어떤 argument snapshot, dependency edge, resource hazard를 들고 내려가는지가 중요하다.

오늘은 `clEnqueueNDRangeKernel` 하나가 ANGLE/OpenCL-to-Vulkan 경로에서 어떻게 고정되고, 그 뒤 Vulkan barrier의 execution dependency와 memory visibility가 어떻게 분리되는지 한 trace로 본다.

## 왜 이 주제를 오늘 잡았나

최근 feedback에서는 GPU VM/PTE/TLB 세부사항보다 OpenCL/Vulkan 기본 의미론을 먼저 더 다지는 편이 좋다는 신호가 있었다.
또 어제 quiz는 맞았지만, event visibility와 descriptor/resource compatibility는 아직 가볍게 반복할 가치가 있다.

그래서 오늘은 PM4/VM으로 깊게 내려가기보다, driver-dev가 반드시 잡아야 하는 중간 계층 질문에 집중한다.

~~~text
enqueue 시점:
  이번 dispatch가 어떤 kernel arg 값을 쓰는가?

record/submit 시점:
  그 arg snapshot이 어떤 descriptor/resource state로 기록되는가?

barrier 시점:
  앞 command 뒤에 실행된다는 증거와 최신 memory를 읽는다는 증거가 둘 다 있는가?
~~~

## 1. clSetKernelArg는 kernel object의 현재 값을 바꾼다

`clSetKernelArg`는 즉시 GPU packet을 만들지 않는다.
대부분의 runtime에서는 kernel object 또는 그 주변의 arg table에 현재 값을 채운다.

~~~text
kernel object: scale
  arg0 src -> src_a
  arg1 dst -> dst_a
  arg2 factor -> 2.0
  arg_table_generation = 17
~~~

이 상태에서 enqueue가 들어오면 command는 “현재 arg table”을 자기 실행 정보로 붙잡아야 한다.
그 뒤 앱이 같은 kernel object에 다른 argument를 설정하더라도, 이미 queued 된 command가 새 값을 몰래 따라가면 안 된다.

~~~text
t0 clSetKernelArg:
  arg0 = src_a
  arg1 = dst_a
  generation = 17

t1 clEnqueueNDRangeKernel -> command A
  captures generation 17
  retains resources src_a, dst_a
  captures global/local size
  captures wait-list edges

t2 clSetKernelArg:
  arg0 = src_b
  arg1 = dst_b
  generation = 18

t3 clEnqueueNDRangeKernel -> command B
  captures generation 18
  retains resources src_b, dst_b
~~~

이 “capture”는 driver 디버깅에서 아주 중요하다.
증상이 “첫 번째 dispatch가 두 번째 buffer에 쓴 것 같다”라면, pipeline layout보다 먼저 enqueue command가 어떤 arg generation을 들고 있었는지 확인해야 한다.

## 2. ANGLE/Vulkan 경로에서는 snapshot이 record 가능한 state로 바뀐다

OpenCL command가 backend로 내려가면 snapshot은 Vulkan에 가까운 state로 풀린다.

~~~text
OpenCL command A:
  kernel = scale
  arg_generation = 17
  arg0 = src_a
  arg1 = dst_a
  gws = 4096
  lws = 64
  waits = []

Vulkan-ish record:
  bind compute pipeline P_scale
  update descriptor row D17
    binding0 = VA/range(src_a)
    binding1 = VA/range(dst_a)
  push/update scalar factor
  vkCmdDispatch(groups=64)
~~~

여기서 두 검증은 여전히 분리된다.

| 질문 | 예 |
|---|---|
| schema가 맞는가? | `P_scale`의 pipeline layout이 binding0/1 storage buffer를 기대하는가 |
| value가 맞는가? | `D17.binding0`이 정말 `src_a`, `D17.binding1`이 정말 `dst_a`를 가리키는가 |

`clSetKernelArg`를 다시 호출해서 generation 18이 생겨도 command A의 descriptor row가 D18을 참조하면 안 된다.
반대로 command B가 D17을 재사용하면서 값 업데이트를 누락해도 안 된다.

좋은 trace는 아래처럼 command id, arg generation, descriptor generation을 같이 남긴다.

~~~text
opencl_cmd=A
kernel=scale
arg_generation=17
descriptor_generation=D17
resources=[src_a, dst_a]
recorded_cb=cb_401

opencl_cmd=B
kernel=scale
arg_generation=18
descriptor_generation=D18
resources=[src_b, dst_b]
waits=[A]
recorded_cb=cb_401
~~~

## 3. wait-list edge는 execution order를 만든다

두 번째 dispatch가 첫 번째 dispatch 결과를 읽는다면 wait-list가 생긴다.

~~~c
clEnqueueNDRangeKernel(q, kernelB, 1, NULL, &gws, &lws,
                       1, &event_a, &event_b);
~~~

driver 관점에서 이 edge는 최소한 “B가 A보다 먼저 실행되면 안 된다”를 의미한다.
Vulkan 쪽으로 낮추면 같은 command buffer 안의 command order와 barrier로 표현될 수도 있고, submit이 갈라졌다면 semaphore/fence wait로 표현될 수도 있다.

~~~text
same command buffer:
  dispatch A
  barrier/order point for A -> B
  dispatch B

split submit:
  submit A
    dispatch A
    signal S_A

  submit B
    wait S_A
    barrier/order point for A writes -> B reads
    dispatch B
~~~

여기까지는 execution dependency다.
B가 A보다 먼저 실행되지 않는다는 증거를 만든다.

하지만 그것만으로는 B가 A의 최신 memory write를 읽는다고 말할 수 없다.
Vulkan에서는 semaphore wait나 barrier도 올바른 stage/access/scope와 연결될 때 memory dependency에 참여할 수 있으므로, 여기서의 구분은 "순서 신호만 확인했는가"와 "memory visibility 범위까지 확인했는가"를 나누기 위한 디버깅 관점이다.

## 4. barrier는 execution과 memory를 따로 봐야 한다

Vulkan barrier를 driver-dev 관점에서 보면 두 축이 있다.

~~~text
execution dependency:
  어떤 stage의 작업이 어떤 stage 앞에 와야 하는가?

memory dependency:
  어떤 access가 available/visible 해야 하는가?
~~~

예를 들어 A가 storage buffer에 쓰고 B가 같은 buffer를 읽는다면, 단순한 순서만으로는 부족하다.

~~~text
needed intent:
  A shader write completes before B shader read
  A shader write becomes visible to B shader read
  resource scope includes the shared buffer
~~~

Vulkan-ish로 쓰면 이런 모양이다.

~~~text
barrier A -> B:
  srcStage  = COMPUTE_SHADER
  srcAccess = SHADER_WRITE
  dstStage  = COMPUTE_SHADER
  dstAccess = SHADER_READ
  resource  = shared buffer range
~~~

`srcStage/dstStage` 쪽만 맞고 access/scope가 빠지면 “늦게 실행한다”는 조건은 표현했지만 “최신 write를 읽는다”는 조건은 약해진다.
반대로 access mask를 과하게 넓히면 correctness는 쉬워져도 cache flush/invalidate가 커져 작은 dispatch나 반복 측정에서 비용이 튈 수 있다.

PM4-visible trace에서는 이름이 GPU마다 달라져도 질문은 유지된다.

~~~text
DISPATCH A
ORDER/WAIT point for A completion before B
CACHE release/acquire or flush/invalidate for A write -> B read
DISPATCH B
EVENT_WRITE event_b complete
~~~

`WAIT`만 보이면 order 증거다.
cache action까지 맞아야 visibility 증거다.

## 5. 흔한 버그: command capture와 barrier 축을 섞어 보는 것

첫 번째 버그는 late binding이다.

~~~text
wrong:
  command A captures pointer to mutable arg table
  app updates arg table to generation 18
  command A records descriptors from generation 18
~~~

증상은 descriptor row가 틀린 것처럼 보인다.
하지만 뿌리는 descriptor validation이 아니라 enqueue-time snapshot 실패다.

두 번째 버그는 execution-only barrier다.

~~~text
wrong:
  dispatch A writes dst_a
  execution barrier A before B
  dispatch B reads dst_a
  missing shader-write -> shader-read visibility
~~~

event timeline은 정상처럼 보일 수 있다.
A도 COMPLETE, B도 COMPLETE다.
그런데 B 결과가 가끔 stale value라면 event state보다 barrier access/scope와 cache action을 봐야 한다.

세 번째 버그는 과한 global barrier다.

~~~text
safe but expensive:
  every dispatch boundary -> global all-cache flush/invalidate
~~~

처음에는 안정적으로 보이지만 submit batching, tiny dispatch, local-size sweep 같은 workload에서 synchronization cost가 커진다.
driver가 해야 할 일은 barrier를 없애는 것이 아니라, dependency graph와 resource hazard에 맞게 scope를 줄이는 것이다.

## 6. trace checklist

이 종류의 버그를 볼 때는 한 dispatch를 아래 필드로 추적하면 좋다.

~~~text
opencl_cmd_id:
  queue id
  kernel object id
  arg_generation captured at enqueue
  retained cl_mem objects
  global/local size
  wait-list event ids

vulkan_record:
  command buffer id
  pipeline layout key
  descriptor generation
  descriptor resource/range values
  dispatch group count

sync_lowering:
  producer event/fence/semaphore
  execution dependency stage pair
  memory access pair
  resource range/scope

pm4_visible:
  dispatch packet order
  wait/order packet before consumer
  cache release/acquire or flush/invalidate action
  final fence/event write
~~~

이렇게 나누면 “arg가 잘못 캡처됐나”, “descriptor value가 틀렸나”, “순서는 맞는데 visibility가 빠졌나”를 분리해서 볼 수 있다.

## what this means for driver dev

- `clEnqueueNDRangeKernel`에서 kernel arg snapshot, resource retain, NDRange shape, wait-list edge를 command-local state로 고정한다.
- `clSetKernelArg` 이후 같은 kernel object가 바뀌어도 이미 queued command의 descriptor/value generation이 흔들리지 않게 한다.
- Vulkan recording에서는 pipeline layout compatibility, descriptor row value correctness, resource lifetime/range validity를 별도 로그로 남긴다.
- event wait-list lowering은 execution dependency와 memory dependency를 분리해서 설계한다. wait/semaphore/fence는 ordering 증거이고, access mask/cache action은 visibility 증거다.
- PM4 trace에서는 consumer dispatch 앞에 wait/order point가 있는지와 필요한 release/acquire 또는 flush/invalidate가 있는지를 따로 확인한다.
- 성능 최적화는 barrier를 무작정 제거하는 것이 아니라, OpenCL dependency graph와 Vulkan resource hazard에 맞춰 stage/access/resource scope를 좁히는 작업이다.

## app-facing takeaway

앱에서는 같은 `cl_kernel` object에 argument를 바꿔가며 여러 dispatch를 enqueue할 수 있다.
정상 runtime이라면 enqueue된 command는 자기 argument snapshot을 가져야 하므로, enqueue 뒤 `clSetKernelArg`를 바꾼다고 이미 queued 된 dispatch 의미가 바뀌면 안 된다.

다만 성능 면에서는 dependency를 너무 크게 잡으면 driver가 submit batching과 barrier scope를 좁히기 어렵다.
정확한 event wait-list를 주고, 중간중간 `clFinish`로 전체 queue를 강제로 끊지 않는 편이 driver가 order와 visibility를 더 작게 표현할 여지를 준다.

---

## 관련 글

- [kernel arg에서 pipeline layout compatibility까지: schema와 value를 분리해서 보기]({{< relref "2026-06-05-opencl-note-kernel-arg-layout-compat-trace.md" >}})
- [event DAG에서 submit batch까지: OpenCL 의존성이 드라이버 제출을 바꾸는 지점]({{< relref "2026-06-06-opencl-note-event-dag-submit-batching-trace.md" >}})
- [event wait-list에서 PM4 cache visibility까지: buffer handoff trace]({{< relref "2026-06-04-opencl-note-event-waitlist-cache-visibility-trace.md" >}})
- [OpenCL Event Waitlist Lowering — API 의존성을 실제 wait로 낮추는 기준]({{< relref "2026-05-16-opencl-note-event-waitlist-lowering.md" >}})

## 관련 용어

- [[command-queue]], [[event]], [[descriptor-set]], [[barrier]], [[pm4-packet]]
