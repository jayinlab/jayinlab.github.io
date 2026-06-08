---
title: "ANGLE descriptor row 추적: schema는 맞는데 value가 틀릴 때"
date: 2026-06-08
slug: "opencl-angle-descriptor-row-live-value"
draft: false
type: "note"
series: "opencl-driver-internals"
tags: ["opencl", "angle", "clspv", "spirv", "vulkan", "descriptor", "pipeline-layout", "driver-dev", "trace-walkthrough", "optimization"]
difficulty: "advanced"
layer: "OpenCL -> ANGLE -> clspv/SPIR-V -> Vulkan -> UMD"
---

어제는 `clEnqueueNDRangeKernel`이 argument snapshot과 barrier visibility를 어떻게 고정해야 하는지 봤다.
오늘은 그중 descriptor 쪽만 더 좁혀 본다.

핵심 질문은 이것이다.

~~~text
pipeline layout schema는 맞다.
그런데 이번 dispatch의 descriptor row value도 맞는가?
~~~

최근 quiz에서 이 구분이 한 번 흔들렸다.
`clspv` reflection과 Vulkan pipeline layout은 “어떤 slot이 있어야 하는가”를 말한다.
반면 `clSetKernelArg`와 enqueue/record 경로는 “이번 실행에서 그 slot에 어떤 buffer/image/sampler가 꽂혔는가”를 만든다.
둘은 같이 가지만 같은 검사는 아니다.

오늘 trace spine은 아래처럼 잡는다.

~~~text
clSetKernelArg
-> ANGLE CLKernel / CLKernelVk argument handle
-> clspv reflection descriptorBinding
-> VkWriteDescriptorSet bufferInfo/imageInfo
-> vkCmdBindDescriptorSets
-> vkCmdDispatch
-> driver-facing descriptor table / cache visibility concern
~~~

## 먼저 확정된 코드 사실

아래는 공개 ANGLE 코드에서 확인되는 사실이다.

- `src/libANGLE/CLKernel.cpp`의 `Kernel::setArg`는 backend `mImpl->setArg(...)`를 호출한 뒤 `mSetArguments[argIndex]`에 argument가 set 되었음을 저장한다. 즉 OpenCL frontend object가 “현재 kernel argument 상태”를 갖는다.  
  Source: [CLKernel.cpp](https://github.com/google/angle/blob/main/src/libANGLE/CLKernel.cpp#L22-L27)
- `src/libANGLE/renderer/vulkan/CLKernelVk.cpp`의 `CLKernelVk::init`은 clspv reflection argument type을 보고 `VK_DESCRIPTOR_TYPE_STORAGE_BUFFER`, `VK_DESCRIPTOR_TYPE_UNIFORM_BUFFER`, image/sampler/texel buffer type 등을 고른 뒤 `descriptorSetLayoutDesc.addBinding(arg.descriptorBinding, ...)`을 호출한다. 이 부분이 schema 쪽이다.  
  Source: [CLKernelVk.cpp](https://github.com/google/angle/blob/main/src/libANGLE/renderer/vulkan/CLKernelVk.cpp#L132-L190)
- 같은 파일의 `CLKernelVk::setArg`는 storage/uniform buffer, image, sampler 같은 pointer/resource argument에 대해 `arg.handle`과 `arg.handleSize`를 저장한다. 이 부분은 schema 생성이 아니라 이번 argument value를 저장하는 쪽이다.  
  Source: [CLKernelVk.cpp](https://github.com/google/angle/blob/main/src/libANGLE/renderer/vulkan/CLKernelVk.cpp#L247-L301)
- `src/libANGLE/renderer/vulkan/CLCommandQueueVk.cpp`의 `enqueueNDRangeKernel`은 wait-list 처리 뒤 `processKernelResources(kernelImpl)`를 호출하고, compute pipeline bind와 dispatch를 기록한다.  
  Source: [CLCommandQueueVk.cpp](https://github.com/google/angle/blob/main/src/libANGLE/renderer/vulkan/CLCommandQueueVk.cpp#L1255-L1347)
- `processKernelResources`는 kernel argument를 순회하면서 `VkDescriptorBufferInfo`, `VkDescriptorImageInfo`, `VkWriteDescriptorSet`을 만들고 `dstBinding = arg.descriptorBinding`을 채운다. 마지막에는 descriptor update를 flush하고 `bindDescriptorSets(...)`를 호출한다.  
  Source: [CLCommandQueueVk.cpp](https://github.com/google/angle/blob/main/src/libANGLE/renderer/vulkan/CLCommandQueueVk.cpp#L1599-L2040)
- Vulkan descriptor set layout binding은 binding number, descriptor type, count, shader stage 같은 slot 규칙을 정의한다. Vulkan spec의 `VkDescriptorSetLayoutBinding` 설명도 `binding`이 shader stage의 같은 binding number resource에 대응하고, `descriptorType`이 그 binding의 resource descriptor type을 지정한다고 설명한다.  
  Source: [Vulkan descriptorsets spec](https://github.com/KhronosGroup/Vulkan-Docs/blob/main/chapters/descriptorsets.adoc#L441-L472)

여기까지가 코드/스펙에서 직접 확인한 부분이다.
아래부터는 이 구조를 driver-debug 관점으로 읽는 해석이다.

## 1. schema: clspv reflection이 slot 계약을 만든다

OpenCL kernel이 이런 모양이라고 하자.

~~~c
__kernel void saxpy(__global const float *x,
                    __global float *y,
                    float a)
{
    size_t i = get_global_id(0);
    y[i] = a * x[i] + y[i];
}
~~~

OpenCL 앱은 argument 번호만 본다.

~~~text
arg0 = x
arg1 = y
arg2 = a
~~~

하지만 OpenCL-on-Vulkan runtime은 이 kernel을 Vulkan shader interface로 낮춰야 한다.
clspv reflection이 알려주는 것은 대략 이런 정보다.

~~~text
kernel saxpy interface:
  arg0 -> descriptorBinding 0, storage buffer, read-like usage
  arg1 -> descriptorBinding 1, storage buffer, write-like usage
  arg2 -> push constant or POD buffer region
~~~

ANGLE의 `CLKernelVk::init`에서 하는 일은 이 reflection 결과를 Vulkan descriptor set layout과 pipeline layout의 재료로 바꾸는 것이다.
이 단계에서 중요한 검사는 “이번 buffer가 `x_buf_17`인가?”가 아니다.
중요한 검사는 “binding 0이 storage buffer slot인가?”, “binding 1이 storage buffer slot인가?”, “compute stage에서 보이는가?”, “push constant range가 맞는가?”다.

~~~text
schema-level state:
  descriptor set: KernelArguments
  binding 0: STORAGE_BUFFER, count 1, COMPUTE
  binding 1: STORAGE_BUFFER, count 1, COMPUTE
  push range: arg2 scalar bytes
  pipeline layout key: PL_saxpy_v1
~~~

이 schema가 맞으면 pipeline layout compatibility 경로를 탈 수 있다.
하지만 아직 이번 dispatch가 어느 buffer를 읽고 쓸지는 확정되지 않았다.

## 2. value: clSetKernelArg는 live resource를 저장한다

이제 앱이 argument를 설정한다.

~~~c
clSetKernelArg(kernel, 0, sizeof(cl_mem), &x_a);
clSetKernelArg(kernel, 1, sizeof(cl_mem), &y_a);
clSetKernelArg(kernel, 2, sizeof(float), &alpha);
~~~

ANGLE의 frontend `Kernel::setArg`는 backend 구현에 전달하고, set된 argument 목록을 저장한다.
Vulkan backend의 `CLKernelVk::setArg`는 resource argument에 대해 `arg.handle`을 채운다.

driver-debug 관점에서는 이때부터 질문이 바뀐다.

~~~text
value-level state:
  arg0.handle = x_a
  arg1.handle = y_a
  arg2.value  = alpha bytes
  arg_generation = G42
~~~

이것은 pipeline layout schema가 아니다.
schema가 `binding 0은 storage buffer`라고 말한다면, value는 `binding 0에 이번에는 x_a의 VkBuffer/range를 쓴다`라고 말한다.

그래서 다음 두 상태는 완전히 다르다.

~~~text
same schema, different value:
  PL_saxpy_v1
  binding 0 = x_a
  binding 1 = y_a

same schema, different value:
  PL_saxpy_v1
  binding 0 = x_b
  binding 1 = y_b
~~~

둘 다 layout compatibility는 통과할 수 있다.
하지만 dispatch A가 실수로 `x_b/y_b` row를 읽으면 value-level bug다.

## 3. enqueue: processKernelResources가 descriptor row를 만든다

`clEnqueueNDRangeKernel` 쪽으로 내려가면 `processKernelResources(kernelImpl)`가 호출된다.
여기서 ANGLE은 kernel argument를 순회하면서 Vulkan descriptor write를 만든다.

storage/uniform buffer argument라면 흐름은 이런 식으로 읽을 수 있다.

~~~text
CLKernelArgument:
  type = ArgumentStorageBuffer
  descriptorBinding = 0
  handle = x_a

processKernelResources:
  cl_mem x_a -> CLBufferVk
  VkDescriptorBufferInfo:
    buffer = x_a's VkBuffer
    offset = x_a offset
    range  = x_a size
  VkWriteDescriptorSet:
    dstSet = KernelArguments descriptor set
    dstBinding = 0
    descriptorType = STORAGE_BUFFER
    pBufferInfo = &bufferInfo
~~~

이 순간 만들어지는 것이 오늘 말하는 descriptor row value다.

~~~text
descriptor row D42:
  binding 0 -> VkBuffer(x_a), offset/range
  binding 1 -> VkBuffer(y_a), offset/range
  binding for POD/scalar -> alpha storage or push constant bytes
~~~

그 뒤 descriptor update가 flush되고 command buffer에는 descriptor set bind가 들어간다.
이 상태에서 compute pipeline과 dispatch가 기록된다.

~~~text
recorded command:
  bind pipeline P_saxpy(PL_saxpy_v1)
  bind descriptor set D42
  push constants / POD state
  dispatch groups
~~~

따라서 “layout은 맞는데 값이 틀렸다”는 말은 꽤 구체적인 의미를 갖는다.
`PL_saxpy_v1`은 맞지만, `D42.binding0`이 `x_a`가 아니라 `x_b` 또는 이미 free/reused된 buffer range를 가리킨다는 뜻이다.

## 4. 흔한 failure mode: schema cache hit에 속는 경우

아래 로그가 있다고 하자.

~~~text
kernel=saxpy
pipeline_layout_key=PL_saxpy_v1
pipeline_cache=hit
descriptor_set_layout=compatible
dispatch=success
~~~

이것만 보면 안전해 보인다.
하지만 value 축을 남기지 않으면 중요한 정보가 빠진다.

~~~text
missing:
  arg_generation captured by enqueue
  descriptor row id
  binding0 cl_mem id / VkBuffer / offset / range
  binding1 cl_mem id / VkBuffer / offset / range
  resource lifetime generation
~~~

실제 버그는 이런 모양일 수 있다.

~~~text
t0 clSetKernelArg arg0 = x_a
t1 enqueue dispatch A
t2 clSetKernelArg arg0 = x_b
t3 record dispatch A

wrong record:
  descriptor row for dispatch A uses latest mutable arg table
  binding0 = x_b
~~~

schema는 전혀 깨지지 않았다.
`x_a`도 `x_b`도 storage buffer이기 때문이다.
그래서 validation layer나 layout compatibility check만으로는 이런 bug를 못 잡을 수 있다.

driver/runtime 로그는 schema와 value를 같이 남겨야 한다.

~~~text
opencl_cmd=A
kernel=saxpy
arg_generation=G42
pipeline_layout_key=PL_saxpy_v1
descriptor_row=D42
descriptor_values=[
  binding0: cl_mem=x_a, vkBuffer=B17, offset=0, range=4096, lifetime_gen=8
  binding1: cl_mem=y_a, vkBuffer=B18, offset=0, range=4096, lifetime_gen=3
]
~~~

이렇게 해야 “layout cache hit”과 “이번 row가 맞는 resource를 가리킴”을 따로 증명할 수 있다.

## 5. descriptor value가 맞아도 visibility는 별도다

여기서 한 번 더 분리해야 한다.

descriptor row가 맞다는 것은 kernel이 읽을 주소/범위가 의도한 resource라는 뜻이다.
하지만 producer가 방금 쓴 값이 consumer에게 보인다는 뜻은 아니다.

~~~text
descriptor correctness:
  binding0 -> shared_buffer

memory visibility:
  producer shader write to shared_buffer
  becomes visible to consumer shader read
~~~

예를 들어 command A가 `y_a`에 쓰고 command B가 같은 `y_a`를 읽는다면, B의 descriptor row가 `y_a`를 정확히 가리켜도 barrier/access/cache path가 필요하다.

~~~text
needed for B:
  descriptor row:
    binding0 -> y_a

  ordering/visibility:
    A COMPUTE_SHADER SHADER_WRITE
    -> B COMPUTE_SHADER SHADER_READ
    over y_a range
~~~

최근 어려웠던 지점이 바로 여기다.
semaphore/fence/event는 progress나 ordering의 증거가 될 수 있지만, resource access visibility까지 자동으로 설명하지는 않는다.
descriptor row correctness도 마찬가지다.
“어느 buffer를 읽는가”와 “그 buffer의 최신 write가 보이는가”는 별도 축이다.

## 6. driver-facing 해석

Vulkan driver 아래로 내려가면 descriptor set은 GPU가 읽을 descriptor table, user data, root pointer, 또는 backend별 state setup으로 바뀐다.
구체적인 packet 이름은 GPU와 driver에 따라 다르지만 driver-dev가 확인할 질문은 유지된다.

~~~text
before dispatch:
  pipeline/shader expects descriptor table shape S
  descriptor table row D42 has binding0/binding1 values
  command stream points shader-visible state to D42
  producer writes are visible if this dispatch consumes produced data
~~~

PM4 관점으로 아주 짧게 말하면, `DISPATCH_DIRECT`만 정상이어도 충분하지 않다.
그 앞에 shader가 descriptor table을 찾는 데 필요한 user-data/state setup이 맞아야 하고, 그 descriptor가 가리키는 memory가 resident/valid/visible 해야 한다.

오늘 글에서는 VM/PTE/TLB까지 깊게 들어가지 않는다.
다만 downstream consequence는 이것이다.

~~~text
schema bug:
  shader interface와 descriptor table shape가 다름
  -> pipeline/layout/reflection/cache key 문제

value bug:
  descriptor row가 wrong VkBuffer/range를 가리킴
  -> clSetKernelArg/enqueue capture/update 문제

visibility bug:
  descriptor row는 맞지만 최신 write가 안 보임
  -> wait/barrier/access/cache 문제
~~~

이 셋을 한 로그 문자열로 “descriptor 문제”라고 뭉개면 디버깅이 길어진다.

## what this means for driver dev

- `clspv` reflection에서 나온 `descriptorBinding`, descriptor type, push constant range는 schema-level 계약으로 기록한다.
- `clSetKernelArg`가 저장한 `arg.handle`, scalar bytes, local memory size는 value-level state로 기록한다.
- `clEnqueueNDRangeKernel` 또는 record 경계에서 어떤 argument generation을 캡처했는지 남긴다.
- `processKernelResources` 같은 descriptor write 경로에서는 `dstBinding`, descriptor type, VkBuffer/Image/Sampler handle, offset, range, lifetime generation을 같이 로그화한다.
- pipeline layout cache hit를 descriptor value correctness의 증거로 쓰지 않는다.
- descriptor value correctness를 memory visibility의 증거로 쓰지 않는다.
- PM4/command-stream 직전에는 pipeline id, descriptor table pointer 또는 descriptor set id, resource VA/range, wait/barrier/cache action을 같은 submit id로 묶어 본다.

## app-facing takeaway

앱 개발자는 같은 kernel schema를 유지하고 buffer argument만 바꿔가며 dispatch하는 경우가 많다.
이 패턴은 정상적이고, runtime이 descriptor layout/pipeline layout을 재사용하기 좋은 형태다.

다만 성능 분석에서 “같은 kernel이니까 다 같은 비용”이라고 보면 안 된다.
반복 dispatch마다 descriptor value update, resource lifetime tracking, wait-list/barrier가 따라붙을 수 있다.
따라서 tiny dispatch를 많이 쪼갠 workload에서는 kernel 실행 시간뿐 아니라 argument update와 sync 비용도 같이 봐야 한다.

---

## 관련 글

- [kernel arg에서 pipeline layout compatibility까지: schema와 value를 분리해서 보기]({{< relref "2026-06-05-opencl-note-kernel-arg-layout-compat-trace.md" >}})
- [enqueue capture에서 barrier visibility까지: dispatch 하나가 고정되는 시점]({{< relref "2026-06-07-opencl-note-enqueue-capture-barrier-visibility.md" >}})
- [OpenCL address space는 어떻게 descriptor 계약이 되나]({{< relref "2026-05-24-opencl-note-address-space-descriptor-contract.md" >}})
- [Descriptor/Pipeline Layout 호환 계약: 왜 드라이버는 '같아 보이는 바인딩'도 거절할까]({{< relref "2026-05-11-opencl-note-descriptor-pipeline-layout-compat-contract.md" >}})

## 관련 용어

- [[descriptor-set]], [[pipeline-layout]], [[SPIR-V]], [[command-buffer]], [[barrier]]
