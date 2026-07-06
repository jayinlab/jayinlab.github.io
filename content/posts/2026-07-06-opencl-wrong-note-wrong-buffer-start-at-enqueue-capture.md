---
title: "엉뚱한 buffer 결과가 나왔을 때 왜 PM4보다 enqueue capture를 먼저 보나"
date: 2026-07-06
slug: "opencl-wrong-buffer-start-at-enqueue-capture"
draft: false
type: "wrong-note"
series: "opencl-driver-internals"
tags: ["opencl", "angle", "vulkan", "descriptor", "command-queue", "debugging", "pm4"]
difficulty: "intermediate"
layer: "CL"
---

오늘의 한 문제는 이 문장이었다.

> OpenCL 커널 실행 결과가 엉뚱한 buffer에 나온다면, PM4 로그부터 파기보다 먼저 해당 enqueue가 캡처한 커널 인자/메모리 객체가 맞는지 확인하는 편이 자연스럽다.

답은 **O**다.  
PM4가 중요하지 않다는 뜻은 아니다. 다만 이 증상에서는 첫 질문을 너무 낮은 layer에서 시작하면 원인 분리가 어려워진다.

## 먼저 봐야 하는 것은 “이번 command가 무엇을 잡았나”다

OpenCL 앱은 보통 이런 순서로 커널을 실행한다.

~~~c
clSetKernelArg(kernel, 0, sizeof(cl_mem), &src);
clSetKernelArg(kernel, 1, sizeof(cl_mem), &dst);
clEnqueueNDRangeKernel(queue, kernel, 1, NULL, &global, &local,
                       0, NULL, &event);
~~~

여기서 중요한 감각은 <code>clEnqueueNDRangeKernel</code>이 단순히 “나중에 kernel을 실행해줘”만 넣는 호출이 아니라는 점이다. 이 command는 enqueue 시점의 kernel argument 상태, mem object, wait-list, work size 같은 실행 조건을 잡아서 queue에 넣는다.

그래서 결과가 엉뚱한 buffer에 나왔다면 첫 질문은 이것이다.

~~~text
이 enqueue가 arg0, arg1에 어떤 cl_mem을 캡처했나?
~~~

예를 들어 원래는 <code>src=A</code>, <code>dst=B</code>여야 하는데 runtime 내부 arg table이 <code>src=B</code>, <code>dst=A</code>처럼 채워졌거나, 이전 dispatch의 descriptor value가 재사용되었다면 결과는 쉽게 다른 buffer로 간다. 이 경우 PM4 dump를 먼저 보면 “어떤 GPU address로 dispatch했다”는 하위 증거는 보일 수 있지만, 왜 그 address가 선택됐는지는 다시 OpenCL/ANGLE/Vulkan state 쪽으로 올라와야 한다.

## ANGLE/Vulkan 경로에서는 slot mapping 문제로 바뀐다

ANGLE의 OpenCL-to-Vulkan 경로로 생각하면 흐름은 대략 이렇게 나뉜다.

~~~text
OpenCL API:
  clSetKernelArg(arg0=src, arg1=dst)
  clEnqueueNDRangeKernel(...)

ANGLE / clspv / SPIR-V:
  arg0 -> storage buffer binding 0
  arg1 -> storage buffer binding 1

Vulkan runtime state:
  binding 0 -> descriptor value for src
  binding 1 -> descriptor value for dst

Driver-visible result:
  dispatch reads/writes GPU VA selected by those descriptors
~~~

여기서 “엉뚱한 buffer” 증상은 보통 아래 축 중 하나다.

| 의심 축 | 질문 | 예시 |
|---|---|---|
| OpenCL arg capture | enqueue가 올바른 <code>cl_mem</code>을 잡았나? | arg0/arg1 순서가 바뀜 |
| descriptor value | binding에 올바른 buffer VA/range가 들어갔나? | binding 1이 이전 dispatch의 dst를 가리킴 |
| lifetime/reuse | command 완료 전 buffer가 release/reuse 되었나? | 같은 handle/BO가 다른 용도로 재활용됨 |
| visibility | 올바른 buffer인데 최신 값이 보이나? | producer/consumer barrier 부족 |

이 네 가지는 비슷해 보이지만 처방이 다르다. arg capture가 틀렸으면 barrier를 추가해도 고쳐지지 않는다. descriptor value가 stale이면 PM4 packet 이름을 더 자세히 알아도 원인이 바로 나오지 않는다. lifetime 문제면 event completion과 refcount/lifetime evidence가 필요하다. visibility 문제면 그때는 barrier, access mask, cache action을 본다.

## PM4는 “첫 원인”보다 “아래쪽 증거”에 가깝다

PM4까지 내려가면 driver가 만든 command stream에서 resource address, user data, dispatch packet, fence 같은 흔적을 볼 수 있다. 이것은 매우 강한 증거다. 하지만 OpenCL 학습 단계에서는 PM4를 먼저 보면 질문이 너무 raw해진다.

좋은 순서는 아래에 가깝다.

~~~text
1. OpenCL command가 어떤 kernel arg/mem object를 캡처했나?
2. clspv/SPIR-V interface는 arg를 어떤 binding으로 기대하나?
3. Vulkan descriptor/pipeline state는 그 binding에 어떤 value를 넣었나?
4. driver/PM4 쪽 evidence가 그 value와 일치하나?
~~~

즉 PM4는 “정말 하드웨어에 어떤 주소와 dispatch 상태가 내려갔나”를 확인하는 마지막 쪽 증거로 두는 편이 낫다. 첫 단계에서 이미 arg slot이 틀렸다면 PM4는 그 잘못된 선택이 아래로 전달되었다는 사실을 보여줄 뿐이다.

## 작은 예시

아래처럼 두 번 dispatch한다고 하자.

~~~c
// dispatch A
clSetKernelArg(k, 0, sizeof(cl_mem), &src_a);
clSetKernelArg(k, 1, sizeof(cl_mem), &dst_a);
clEnqueueNDRangeKernel(q, k, 1, NULL, &global, &local, 0, NULL, &evt_a);

// dispatch B
clSetKernelArg(k, 0, sizeof(cl_mem), &src_b);
clSetKernelArg(k, 1, sizeof(cl_mem), &dst_b);
clEnqueueNDRangeKernel(q, k, 1, NULL, &global, &local, 0, NULL, &evt_b);
~~~

dispatch B의 결과가 <code>dst_a</code>에 써졌다면, 먼저 볼 로그는 이런 형태가 좋다.

~~~text
enqueue_id=B kernel=scale
  arg0 src -> cl_mem src_b -> binding 0 -> VA 0x2000 range 4096
  arg1 dst -> cl_mem dst_b -> binding 1 -> VA 0x3000 range 4096

observed write:
  dst_a VA 0x1000 changed
~~~

이 로그에서 <code>arg1 dst</code>가 이미 <code>dst_a</code>를 가리키고 있었다면 OpenCL arg table/capture 문제다. <code>arg1 dst_b</code>는 맞는데 Vulkan descriptor binding 1이 <code>dst_a</code> VA로 채워졌다면 descriptor update/stale descriptor 문제다. 둘 다 맞는데 host가 <code>dst_b</code>의 최신 값을 못 본다면 visibility/readback 문제로 넘어간다.

PM4 dump는 이 다음에 붙인다.

~~~text
PM4-visible dispatch state:
  resource/user-data for binding 1 points to VA 0x1000
~~~

이 정보는 유용하지만, 그것만으로는 “OpenCL arg capture가 틀렸는지”, “descriptor update가 틀렸는지”, “lifetime/reuse 때문에 VA가 바뀌었는지”를 바로 구분하지 못한다. 그래서 위쪽 state trace가 먼저다.

## 오늘 문제의 핵심

이 문장이 O인 이유는 간단하다.

> wrong buffer 결과는 보통 “어떤 resource를 선택했나” 문제에서 시작한다. 그러므로 OpenCL enqueue capture와 descriptor value를 먼저 확인하고, PM4는 그 선택이 실제 command stream까지 내려갔는지 확인하는 downstream evidence로 보는 편이 자연스럽다.

현재 학습 단계에서는 PM4 packet 자체를 해석하는 것보다, PM4가 어떤 상위 계약의 결과인지 연결하는 쪽이 더 중요하다.  
“PM4는 너무 raw하다”는 감각은 맞다. 지금은 PM4를 목표 지점으로 두되, 매번 첫 출발점으로 삼지는 않는 편이 더 잘 맞는다.

## Related

- [kernel arg에서 pipeline layout compatibility까지: schema와 value를 분리해서 보기]({{< relref "2026-06-05-opencl-note-kernel-arg-layout-compat-trace.md" >}})
- [OpenCL dispatch 디버깅: stale data, invalid descriptor, VM fault를 먼저 나누기]({{< relref "2026-05-25-opencl-note-dispatch-debug-three-axes.md" >}})
- [OpenCL enqueue capture와 barrier visibility를 분리해서 보기]({{< relref "2026-06-07-opencl-note-enqueue-capture-barrier-visibility.md" >}})

[[command-queue]], [[descriptor-set]], [[pipeline-layout]], [[pm4-packet]]
