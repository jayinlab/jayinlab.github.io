---
title: "OpenCL scalar kernel argument는 왜 cl_mem buffer descriptor가 아닌가"
date: 2026-07-06
slug: "opencl-scalar-arg-is-not-clmem-descriptor"
draft: false
type: "wrong-note"
series: "opencl-driver-internals"
tags: ["opencl", "angle", "clspv", "spirv", "vulkan", "descriptor", "kernel-argument"]
difficulty: "intermediate"
layer: "CL"
---

오늘의 한 문제는 이 문장이었다.

> OpenCL에서 int/float 같은 scalar kernel argument는 ANGLE/Vulkan 경로에서 반드시 host가 만든 cl_mem buffer descriptor처럼 표현되어야 한다.

답은 **X**다.  
핵심은 <code>cl_mem</code> argument와 scalar argument의 성격이 다르다는 점이다.

## OpenCL 표면에서 이미 다르다

아래처럼 커널이 있다고 하자.

~~~c
__kernel void scale(__global const float* src,
                    __global float* dst,
                    float factor,
                    int count)
{
    int gid = get_global_id(0);
    if (gid < count) {
        dst[gid] = src[gid] * factor;
    }
}
~~~

host 코드는 네 개의 argument를 넣는다.

~~~c
clSetKernelArg(kernel, 0, sizeof(cl_mem), &src_buf);
clSetKernelArg(kernel, 1, sizeof(cl_mem), &dst_buf);
clSetKernelArg(kernel, 2, sizeof(float), &factor);
clSetKernelArg(kernel, 3, sizeof(int), &count);
~~~

여기서 <code>src_buf</code>, <code>dst_buf</code>는 OpenCL memory object다. 즉 kernel이 실행될 때 GPU가 접근할 수 있는 buffer resource를 가리킨다.

반면 <code>factor</code>와 <code>count</code>는 작은 값이다. host가 만든 별도 <code>cl_mem</code> object가 아니다. GPU memory에 있는 큰 resource를 가리키는 handle도 아니다. enqueue 시점에 kernel argument state 안에 복사되어 들어가는 값에 가깝다.

그래서 첫 구분은 이렇게 잡으면 된다.

| OpenCL argument | 의미 | Vulkan 쪽에서 자연스러운 형태 |
|---|---|---|
| <code>__global float* src</code> | GPU가 읽을 buffer resource | storage buffer descriptor |
| <code>__global float* dst</code> | GPU가 쓸 buffer resource | storage buffer descriptor |
| <code>float factor</code> | 작은 scalar 값 | push constant, uniform/kernarg data, specialization과 다른 runtime value path |
| <code>int count</code> | 작은 scalar 값 | push constant 또는 uniform/kernarg류 state |

즉 scalar argument를 “반드시 <code>cl_mem</code> buffer descriptor”로 표현해야 한다고 하면 너무 강한 말이다.

## descriptor는 보통 resource를 설명한다

Vulkan descriptor는 shader가 접근할 resource를 알려주는 table entry로 생각하면 쉽다.

예를 들어 storage buffer descriptor는 대략 이런 질문에 답한다.

~~~text
binding 0:
  어떤 GPU address의 buffer인가?
  range는 어디까지인가?
  shader가 storage buffer로 읽거나 쓸 수 있는가?
~~~

이것은 <code>src_buf</code>, <code>dst_buf</code> 같은 <code>cl_mem</code> object와 잘 맞는다. OpenCL의 <code>__global</code> pointer argument는 뒤쪽에서 buffer resource binding으로 내려가는 것이 자연스럽다.

하지만 <code>float factor = 2.0f</code>는 “GPU address와 range를 가진 resource”가 아니다. shader가 곱셈에 바로 쓰는 작은 값이다.

그래서 implementation은 이런 선택지를 가질 수 있다.

~~~text
scalar arg path candidates:
  push constant style bytes
  uniform buffer / constant buffer style storage
  kernarg packet / driver-managed argument block
  compiler-known constant path in some specialized cases
~~~

정확히 어느 path를 쓰는지는 ANGLE, clspv, target Vulkan feature, backend compiler 전략에 따라 달라질 수 있다. 중요한 것은 “반드시 host-created cl_mem buffer descriptor”가 아니라는 점이다.

## clspv/SPIR-V 관점에서 보면 더 선명하다

OpenCL C의 argument들은 SPIR-V interface로 내려가면서 역할이 나뉜다.

~~~text
__global const float* src
  -> StorageBuffer-like resource interface

__global float* dst
  -> StorageBuffer-like resource interface

float factor
  -> scalar value interface

int count
  -> scalar value interface
~~~

buffer pointer argument는 shader가 memory load/store를 해야 하므로 resource binding이 필요하다. 반대로 scalar argument는 shader invocation이 실행될 때 필요한 작은 값이다. 이 값은 descriptor set의 storage buffer slot과 같은 종류의 계약으로 볼 필요가 없다.

물론 어떤 구현은 여러 scalar 값을 하나의 argument buffer나 uniform buffer에 pack할 수 있다. 이 경우 내부적으로는 buffer 비슷한 storage를 사용할 수 있다. 하지만 그래도 OpenCL API 관점의 <code>cl_mem</code> argument와 같지는 않다.

구분은 이렇다.

~~~text
cl_mem buffer argument:
  host가 만든 memory object
  lifetime/refcount/residency/range가 중요
  descriptor value가 어떤 resource를 가리키는지가 핵심

scalar argument:
  host가 넘긴 값 bytes
  enqueue/kernel state에 값이 캡처됨
  ABI에서 그 값을 shader에 어떻게 전달하는지가 핵심
~~~

## 왜 헷갈리기 쉬운가

헷갈리는 이유는 <code>clSetKernelArg</code>가 둘 다 같은 API로 받기 때문이다.

~~~c
clSetKernelArg(kernel, 0, sizeof(cl_mem), &src_buf);
clSetKernelArg(kernel, 2, sizeof(float), &factor);
~~~

호출 모양만 보면 둘 다 “argument slot에 뭔가를 넣는다”다. 하지만 slot에 들어가는 의미가 다르다.

<code>src_buf</code>는 “이 resource를 shader가 읽게 해라”에 가깝다.  
<code>factor</code>는 “이 숫자 값을 shader가 쓰게 해라”에 가깝다.

따라서 디버깅 질문도 달라진다.

| 증상 | 먼저 볼 것 |
|---|---|
| wrong buffer를 읽거나 씀 | <code>cl_mem</code> arg capture, descriptor binding, buffer range |
| factor 값이 이전 실행 값처럼 보임 | scalar arg table update, push/uniform/kernarg bytes, command capture timing |
| pipeline layout mismatch | resource interface schema와 descriptor layout |
| scalar 값만 바꾸면 느려짐 | scalar 전달 방식, pipeline specialization 여부, update path 비용 |

## 작은 trace로 보기

dispatch A와 B가 같은 buffer를 쓰지만 scalar 값만 다르다고 하자.

~~~c
float factor = 2.0f;
clSetKernelArg(k, 2, sizeof(float), &factor);
clEnqueueNDRangeKernel(q, k, 1, NULL, &global, &local, 0, NULL, &evt_a);

factor = 3.0f;
clSetKernelArg(k, 2, sizeof(float), &factor);
clEnqueueNDRangeKernel(q, k, 1, NULL, &global, &local, 0, NULL, &evt_b);
~~~

좋은 trace는 이런 식이다.

~~~text
dispatch A:
  binding 0 -> src_buf descriptor
  binding 1 -> dst_buf descriptor
  scalar factor -> bytes 00 00 00 40  // 2.0f

dispatch B:
  binding 0 -> src_buf descriptor
  binding 1 -> dst_buf descriptor
  scalar factor -> bytes 00 00 40 40  // 3.0f
~~~

여기서 buffer descriptor는 그대로일 수 있다. 바뀐 것은 scalar value bytes다. 그러므로 factor가 잘못 적용되었다면 “buffer descriptor가 틀렸나?”보다 “scalar argument bytes가 이번 dispatch에 맞게 캡처/업데이트되었나?”를 먼저 봐야 한다.

## PM4와의 연결은 어디까지인가

PM4까지 내려가면 결국 driver는 dispatch 전에 필요한 state를 command stream에 반영해야 한다. buffer resource를 가리키는 state도 있고, scalar/kernarg/user-data류 state도 있을 수 있다.

하지만 여기서도 핵심은 packet 이름이 아니다.

~~~text
OpenCL scalar arg
  -> ANGLE/clspv/Vulkan scalar value interface
  -> driver ABI state
  -> PM4-visible dispatch state
~~~

PM4는 마지막 결과를 보여주는 아래쪽 증거다. 오늘 문제의 핵심은 그보다 위다. scalar argument는 OpenCL memory object가 아니며, 따라서 “반드시 host가 만든 <code>cl_mem</code> buffer descriptor로 표현된다”는 말은 틀렸다.

## 오늘 문제의 결론

정답은 **X**.

<code>int</code>, <code>float</code> 같은 scalar kernel argument는 작은 값으로 캡처된다. ANGLE/Vulkan 경로에서는 push constant, uniform/kernarg류 storage, driver-managed argument block 같은 여러 방식으로 전달될 수 있다. <code>cl_mem</code> buffer argument처럼 resource descriptor를 반드시 하나 가져야 하는 것은 아니다.

한 줄로 줄이면 이렇게 된다.

> <code>cl_mem</code> argument는 “어떤 buffer resource인가”의 문제이고, scalar argument는 “이번 dispatch에 어떤 값 bytes를 전달했나”의 문제다.

## Related

- [kernel arg에서 pipeline layout compatibility까지: schema와 value를 분리해서 보기]({{< relref "2026-06-05-opencl-note-kernel-arg-layout-compat-trace.md" >}})
- [OpenCL dispatch 디버깅: stale data, invalid descriptor, VM fault를 먼저 나누기]({{< relref "2026-05-25-opencl-note-dispatch-debug-three-axes.md" >}})
- [OpenCL address space가 descriptor와 PM4 state로 내려가는 방식]({{< relref "2026-05-24-opencl-note-address-space-descriptor-contract.md" >}})

[[descriptor-set]], [[pipeline-layout]], [[SPIR-V]], [[command-queue]]
