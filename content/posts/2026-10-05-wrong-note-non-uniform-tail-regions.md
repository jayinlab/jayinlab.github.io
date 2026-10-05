---
title: "non-uniform tail은 초과 invocation을 지우는 문제가 아니다"
date: 2026-10-05
slug: "opencl-non-uniform-tail-uniform-regions"
draft: false
type: "wrong-note"
series: "opencl-deep-dive"
tags: ["opencl", "non-uniform-work-group", "ndrange", "angle", "clspv", "spirv", "vulkan", "dispatch", "driver-dev"]
difficulty: "advanced"
animation: true
---

이번 주 퀴즈에서 `global_work_size=100`, `local_work_size=64`인 1차원 NDRange를 두고 이런 모델을 떠올렸다.

> Vulkan dispatch는 128개 invocation을 만들고, `gid >= 100`인 28개는 자동으로 무효화된다.

이 문장은 일반적인 OpenCL 보장이 아니다. OpenCL이 보장하는 것은 **global ID 0부터 99까지의 work-item 100개**와, non-uniform work-group을 지원하는 경우 **64개짜리 정규 work-group 하나 + 36개짜리 remainder work-group 하나**다. `gid=100..127`이라는 OpenCL work-item은 애초에 없다.

OpenCL-on-Vulkan 구현이 이 계약을 맞추는 방법도 “항상 128개를 띄운 뒤 guard” 하나로 고정되지 않는다. 현재 ANGLE Vulkan backend는 NDRange를 uniform region들로 나누고, region마다 맞는 pipeline과 `dispatch`를 기록한다. 그래서 이 경로에서 먼저 찾을 것은 숨은 `if (gid < 100)`이 아니라 **region 분할, 각 region의 local size, group count, offset**이다.

## 먼저 확정된 코드 사실

- OpenCL API spec은 non-uniform work-group이 허용될 때 나누어떨어지지 않는 차원을 두 region으로 분할한다고 규정한다. 첫 region은 요청한 local size를 쓰고, 두 번째 remainder region은 그보다 적은 work-item을 가진다. 1D의 `100 / 64`라면 `64 + 36`이다. 2D는 최대 4가지, 3D는 최대 8가지 work-group shape가 생길 수 있다.
  Source: [OpenCL API Specification §3.2.1, lines 954–969](https://registry.khronos.org/OpenCL/specs/unified/html/OpenCL_API.html#mapping-workitems-onto-an-ndrange)
- non-uniform 지원에는 device와 program 양쪽 조건이 있다. OpenCL 3.x device라면 `CL_DEVICE_NON_UNIFORM_WORK_GROUP_SUPPORT == CL_TRUE`여야 하고, source program은 OpenCL C 2.0 이상으로 `-cl-uniform-work-group-size` 없이 빌드되어야 한다. 조건을 만족하지 않으면 명시한 local size가 global size를 나누어야 하며, 아니면 `CL_INVALID_WORK_GROUP_SIZE`다.
  Source: [clEnqueueNDRangeKernel reference, lines 38–55 and 97–104](https://registry.khronos.org/OpenCL/specs/unified/refpages/man/html/clEnqueueNDRangeKernel.html)
- clspv 문서는 OpenCL의 enqueue-time work-group size와 Vulkan pipeline-time local size의 시점 차이를 설명한다. 필요한 경우 specialization constant로 local size를 pipeline 생성 시 확정한다. 또 non-uniform NDRange용으로 `global_size`, `num_workgroups`, `region_offset`, `region_group_offset` push constant를 정의한다.
  Source: [clspv OpenCLCOnVulkan.md, lines 527–565](https://github.com/google/clspv/blob/main/docs/OpenCLCOnVulkan.md#module-scope-push-constants)
- ANGLE의 `CLCommandQueueVk::enqueueNDRangeKernel`은 `createUniformRegions(...)`가 만든 region들을 순회한다. 각 region에서 offset push constant를 쓰고, `getOrCreateComputePipeline(..., uniformRegion, ...)`로 pipeline을 얻은 뒤 그 region의 work-group count로 `dispatch(...)`를 기록한다.
  Source: [ANGLE CLCommandQueueVk.cpp, commit 48739e4](https://chromium.googlesource.com/angle/angle/+/48739e490fbcc602e4c86dac545e9fd32d0f9e6c/src/libANGLE/renderer/vulkan/CLCommandQueueVk.cpp)
- ANGLE의 `NDRange::createUniformRegions` 변경에는 non-uniform work-group shape가 3D에서 최대 8개라는 OpenCL 규칙이 코드 주석과 reserve 크기로 반영돼 있다.
  Source: [ANGLE change for uniform-region construction](https://chromium.googlesource.com/angle/angle/+/refs/heads/chromium/7770%5E%21/)

여기까지가 코드/스펙에서 직접 확인한 부분이다. 아래부터는 이 구조를 driver-debug 관점으로 읽는 해석이다.

## 먼저 그림의 적용 범위를 고친다

아래 기존 애니메이션은 GWS/LWS가 **나누어떨어지는 uniform case**의 OpenCL → Vulkan → PM4 흐름을 보여 준다. `64×64 / 8×8` 예제 자체에는 tail이 없다. Step 3의 `ceil(GWS/LWS)`를 non-uniform case에 그대로 적용해 “마지막 full-size group의 남는 invocation은 자동 삭제된다”고 확장하면 안 된다.

{{< gws_lws_dispatch_anim >}}

uniform case에서는 한 local size와 한 `vkCmdDispatch`만으로 설명이 닫힌다.

~~~text
OpenCL: GWS=4096, LWS=64
Vulkan pipeline local size: 64
vkCmdDispatch groupCountX: 64
logical work-items: 4096
~~~

하지만 `GWS=100, LWS=64`는 다른 문제다. OpenCL contract부터 이렇게 읽어야 한다.

~~~text
region A: local size 64 × group count 1 -> gid 0..63
region B: local size 36 × group count 1 -> gid 64..99
OpenCL work-item gid 100..127: 없음
~~~

## 오답 모델은 세 층을 한 문장에 섞었다

“128개를 띄우고 28개를 막는다”에는 서로 다른 세 질문이 섞여 있다.

1. **OpenCL contract** — 어떤 work-item과 work-group이 존재하는가?
2. **OpenCL-on-Vulkan lowering** — 그 contract를 몇 개의 Vulkan dispatch와 어떤 pipeline local size로 표현하는가?
3. **GPU execution** — 마지막 wave의 비활성 lane은 하드웨어에서 어떻게 처리되는가?

OpenCL의 remainder work-group과 AMD wave의 inactive lane은 같은 것이 아니다. 예를 들어 remainder work-group의 논리적 local size가 36이고 target이 wave64를 선택했다면, 물리적으로 한 wave의 일부 lane만 활성일 수 있다. 그래도 OpenCL 관점의 work-group에는 work-item 36개만 존재한다. 반대로 OpenCL 구현이 full-size Vulkan work-group을 만들고 shader guard로 효과를 막는 전략도 원리상 가능하지만, 그것은 **구현 증거를 확인해야 할 lowering 선택**이지 OpenCL contract 자체가 아니다.

~~~mermaid
flowchart LR
    CL["OpenCL NDRange<br/>GWS 100 · LWS 64"] --> A["uniform region A<br/>local 64 · groups 1<br/>gid 0..63"]
    CL --> B["remainder region B<br/>local 36 · groups 1<br/>gid 64..99"]
    A --> VA["Vulkan pipeline A<br/>local_size_x 64"]
    B --> VB["Vulkan pipeline B<br/>local_size_x 36"]
    VA --> DA["dispatch 1,1,1"]
    VB --> DB["dispatch 1,1,1<br/>region offset 64"]
    DA --> GPU["driver / AMD dispatch"]
    DB --> GPU

    classDef cl fill:#dbeafe,stroke:#2563eb,color:#172554
    classDef region fill:#fef3c7,stroke:#d97706,color:#451a03
    classDef vk fill:#dcfce7,stroke:#16a34a,color:#052e16
    classDef hw fill:#fee2e2,stroke:#dc2626,color:#450a0a
    class CL cl
    class A,B region
    class VA,VB,DA,DB vk
    class GPU hw
~~~

이 다이어그램은 현재 ANGLE 코드의 region별 pipeline/dispatch 구조를 1D 숫자로 풀어 쓴 해석이다. 실제 pipeline cache key와 specialization 방식, AMD wave size는 target과 build artifact에서 확인해야 한다.

## `gid=99`와 `gid=100`을 다시 묻기

kernel이 다음처럼 생겼다고 하자.

~~~c
__kernel void fill(__global uint *out)
{
    size_t gid = get_global_id(0);
    out[gid] = (uint)gid;
}
~~~

OpenCL contract상 결과는 단순하다.

- `gid=99` work-item은 존재하며 `out[99]`에 쓴다.
- `gid=100` work-item은 존재하지 않는다. “실행됐지만 store만 무효화”가 아니다.
- 따라서 올바른 OpenCL kernel에 `gid < global_work_size` guard가 자동 삽입된다고 가정할 필요가 없다.

여기서 host가 실제 buffer를 100개보다 작게 할당했다면 별개의 out-of-bounds 문제다. 반대로 runtime/lowering이 내부적으로 padded dispatch를 택했다면 OpenCL 밖의 invocation이 관찰 가능한 효과를 만들지 않도록 구현이 책임져야 한다. 하지만 어느 전략인지 판단하려면 SPIR-V, pipeline specialization, command trace를 봐야 한다.

## ANGLE에서 추적할 증거

`global=100, local=64` 한 번을 trace할 때는 다음 네 묶음을 같이 남기는 편이 좋다.

~~~text
OpenCL enqueue
  global_work_size = [100, 1, 1]
  enqueued_local_size = [64, 1, 1]
  non_uniform_support = true

uniform region A
  region_global_size = [64, 1, 1]
  region_local_size = [64, 1, 1]
  region_group_offset = [0, 0, 0]
  vk_group_count = [1, 1, 1]

uniform region B
  region_global_size = [36, 1, 1]
  region_local_size = [36, 1, 1]
  region_group_offset = [1, 0, 0]
  region_offset = [64, 0, 0]
  vk_group_count = [1, 1, 1]

artifact evidence
  pipeline keys / specialization constants
  SPIR-V use of region offsets
  AMD code-object metadata: wave32 or wave64, registers, LDS
~~~

마지막 묶음이 있어야 “remainder local size 36”에서 실제 AMD wave가 어떻게 구성됐는지 말할 수 있다. Vulkan command에 `dispatch(1,1,1)`이 두 번 보인다는 사실만으로 wave32/wave64를 확정할 수 없고, wave64 일부 lane이 inactive였다고 해도 그것은 `gid=100..127` OpenCL work-item이 존재했다는 뜻이 아니다.

## 확인하지 못한 경계

- 이번 글은 공개 ANGLE 코드가 uniform region을 만들고 region별 pipeline/dispatch를 기록한다는 데까지 확인했다.
- 실제 Android + AMDGPU 빌드에서 `100/64`가 정확히 `64 + 36` 두 pipeline/dispatch로 나타나는 command trace는 아직 확보하지 못했다.
- 해당 target의 최종 wave size, EXEC mask, PM4 packet 수와 필드는 code object/disassembly 및 command stream을 보기 전에는 확정할 수 없다.
- 그러므로 “ANGLE은 모든 target에서 반드시 두 PM4 dispatch를 낸다”거나 “마지막 wave는 반드시 wave64다”라고 일반화하지 않는다.

## 교정된 모델

처음의 기술 모델은 이랬다.

~~~text
ceil(100 / 64) = 2 groups
2 × 64 = 128 Vulkan invocations
gid 100..127은 자동 무효화
~~~

충돌한 사실은 OpenCL이 remainder work-group 자체를 정의하고, 현재 ANGLE이 NDRange를 uniform region들로 분할해 region별 pipeline/dispatch를 만든다는 점이다.

수정된 모델은 이렇다.

~~~text
OpenCL contract:
  100 work-items = 64 + 36

ANGLE/clspv/Vulkan lowering:
  uniform regions + region offsets + region별 local size/pipeline/dispatch

AMD execution:
  실제 wave와 inactive lane은 최종 artifact로 별도 확인
~~~

핵심은 “tail을 누가 지우는가?”가 아니다. 먼저 **OpenCL에서 tail은 작은 work-group으로 존재한다**고 놓고, Vulkan의 고정 local size 제약을 runtime이 어떤 region과 pipeline 조합으로 만족시키는지를 추적해야 한다.

---

## 관련 글

- [GWS/LWS에서 Vulkan dispatch까지]({{< relref "2026-04-21-opencl-note-gws-lws-to-vulkan-dispatch.md" >}})
- [GPU work-group은 왜 매번 같은 자리에 앉지 않을까]({{< relref "2026-09-21-gpu-fun-fact-workgroup-seating.md" >}})
- [GPU의 줄 맞추기는 왜 32명과 64명일까]({{< relref "2026-08-13-gpu-fun-fact-wave-size.md" >}})

## 관련 용어

- [[work-item]], [[work-group]], [[NDRange]], [[wavefront]], [[SPIR-V]]
