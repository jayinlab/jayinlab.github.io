---
title: "ANGLE 소스로 보는 VkPipeline 증식 문제 — Specialization Constants와 ComputePipelineCache"
date: 2026-05-05
slug: "vkpipeline-specialization-constants-proliferation"
draft: false
type: "note"
series: "opencl-deep-dive"
tags: ["vulkan", "spirv", "clspv", "pipeline", "angle"]
difficulty: "intermediate"
layer: "COMP"
---

이번에 clspv 컴파일 과정을 소스 레벨로 파고들다가 한 가지 구조적인 질문이 생겼다.

> *"워크그룹 크기가 specialization constant로 처리된다면,  
> localWorkSize를 바꿀 때마다 VkPipeline이 새로 만들어지는 거 아닌가?  
> 그러면 파이프라인이 마구 늘어날 수도 있지 않나?"*

결론부터 말하면 — **맞다.** 실제로 그렇게 동작한다.  
ANGLE 소스로 정확히 어디서 어떻게 일어나는지 추적해본다.

---

## 왜 specialization constant인가?

clspv는 OpenCL C 커널을 SPIR-V로 컴파일할 때 워크그룹 크기를 상수로 확정하지 않는다.  
대신 **SPIR-V specialization constant**로 남겨놓는다.

```spvasm
; clspv가 생성하는 SPIR-V (개념)
OpDecorate %wg_size_x SpecId 1
OpDecorate %wg_size_y SpecId 2
OpDecorate %wg_size_z SpecId 3
%wg_size_x = OpSpecConstant %uint 1   ; 기본값 1, 실행 시 덮어씀
%wg_size_y = OpSpecConstant %uint 1
%wg_size_z = OpSpecConstant %uint 1
```

반사 정보에서 이 spec constant ID들을 기록해두고:

```
NonSemanticClspvReflectionSpecConstantWorkgroupSize
    → specConstantIDs[WorkgroupSizeX] = 1
    → specConstantIDs[WorkgroupSizeY] = 2
    → specConstantIDs[WorkgroupSizeZ] = 3
```

dispatch 시점에 실제 `localWorkSize` 값으로 채운다.

이렇게 설계된 이유: **OpenCL은 워크그룹 크기를 컴파일 시점에 알 수 없다.**  
`clEnqueueNDRangeKernel`에서 런타임에 결정되기 때문이다.

---

## VkPipeline은 언제 만들어지나

`clEnqueueNDRangeKernel` 호출 →  
`CLCommandQueueVk::enqueueNDRangeKernel()` (CLCommandQueueVk.cpp:1352) →  
`CLKernelVk::getOrCreateComputePipeline()` (CLKernelVk.cpp:370)

```cpp
// CLKernelVk.cpp:441
VkSpecializationInfo computeSpecializationInfo{
    .mapEntryCount = static_cast<uint32_t>(mapEntries.size()),
    .pMapEntries   = mapEntries.data(),
    .dataSize      = specConstantData.size() * sizeof(uint32_t),
    .pData         = specConstantData.data(),
};

// CLKernelVk.cpp:449
vk::ComputePipelineOptions options = vk::GetComputePipelineOptions(
    vk::PipelineRobustness::NonRobust, vk::PipelineProtectedAccess::Unprotected);
return mShaderProgramHelper.getOrCreateComputePipeline(
    mContext, &mComputePipelineCache, pipelineCache, getPipelineLayout(), options,
    PipelineSource::Draw, pipelineOut, mName.c_str(), &computeSpecializationInfo);
```

`computeSpecializationInfo`에는 이번 dispatch의 `localWorkSize`가 실제 값으로 들어있다.  
이걸 `mComputePipelineCache`로 조회한다.

---

## 캐시 키가 무엇인가 — ComputePipelineDesc

캐시의 키는 `ComputePipelineDesc`다. (vk_cache_utils.h:843)

```cpp
class ComputePipelineDesc final
{
  private:
    std::vector<uint32_t> mConstantIds;  // spec constant ID 목록
    std::vector<uint32_t> mConstants;    // spec constant 실제 값 목록
    ComputePipelineOptions mPipelineOptions = {};  // 1바이트 (robust/protected 비트)
};
```

생성자에서 `VkSpecializationInfo`를 그대로 복사한다. (vk_cache_utils.cpp:3185)

```cpp
ComputePipelineDesc::ComputePipelineDesc(VkSpecializationInfo *specializationInfo,
                                         ComputePipelineOptions pipelineOptions)
    : mConstantIds{}, mConstants{}, mPipelineOptions{pipelineOptions}
{
    // spec constant ID 배열 복사
    mConstantIds.resize(specializationInfo->mapEntryCount);
    for (size_t i = 0; i < mConstantIds.size(); i++)
        mConstantIds[i] = mapEntries[i].constantID;

    // spec constant 값 배열 복사
    const uint32_t *constDataEntries = (const uint32_t *)specializationInfo->pData;
    mConstants.resize(specializationInfo->dataSize / sizeof(uint32_t));
    for (size_t i = 0; i < mConstants.size(); i++)
        mConstants[i] = constDataEntries[i];
}
```

그리고 `keyEqual()`은: (vk_cache_utils.cpp:3234)

```cpp
bool ComputePipelineDesc::keyEqual(const ComputePipelineDesc &other) const
{
    return mPipelineOptions.permutationIndex == other.getPipelineOptions().permutationIndex &&
           mConstantIds == other.getConstantIds() &&
           mConstants == other.getConstants();     // ← 값까지 비교
}
```

**`mConstants`에 워크그룹 크기 값이 담긴다.**  
`localWorkSize`가 다르면 `mConstants`가 달라지고 → `keyEqual` 실패 → 캐시 미스 → 새 VkPipeline.

---

## 캐시 저장소 구조

`ComputePipelineCache`의 실제 저장소: (vk_cache_utils.h:2780)

```cpp
std::unordered_map<vk::ComputePipelineDesc,
                   vk::PipelineHelper,
                   ComputePipelineDescHash,
                   ComputePipelineDescKeyEqual>
    mPayload;
```

그리고 이 `mComputePipelineCache`는 **CLKernelVk 객체 하나에 하나**씩 들어있다. (CLKernelVk.h:161)

```cpp
class CLKernelVk final : public CLKernelImpl {
    // ...
    ComputePipelineCache mComputePipelineCache;  // ← 커널 인스턴스마다 독립적
};
```

---

## 언제 파이프라인이 새로 만들어지나 — 정리

같은 커널(`CLKernelVk` 객체)을 다른 `localWorkSize`로 반복 호출하면:

```
clEnqueueNDRangeKernel(..., localSize={64, 1, 1})
    → ComputePipelineDesc{ mConstants=[64,1,1] }
    → 캐시 조회: 없음 → vkCreateComputePipelines() → VkPipeline A

clEnqueueNDRangeKernel(..., localSize={256, 1, 1})
    → ComputePipelineDesc{ mConstants=[256,1,1] }
    → 캐시 조회: 없음 → vkCreateComputePipelines() → VkPipeline B

clEnqueueNDRangeKernel(..., localSize={16, 16, 1})
    → ComputePipelineDesc{ mConstants=[16,16,1] }
    → 캐시 조회: 없음 → vkCreateComputePipelines() → VkPipeline C

clEnqueueNDRangeKernel(..., localSize={64, 1, 1})   ← 다시
    → 캐시 조회: 있음 (VkPipeline A) → 재사용 ✓
```

---

## 증식은 실제 문제가 되나?

결론부터: **대부분의 경우엔 아니지만, 특정 패턴에선 주의가 필요하다.**

### 증식이 제한되는 이유

`ComputePipelineOptions`는 1바이트, 2개의 비트 플래그: (vk_cache_utils.h:821)

```cpp
union ComputePipelineOptions final
{
    struct {
        uint8_t robustness     : 1;  // VK_EXT_pipeline_robustness
        uint8_t protectedAccess: 1;  // VK_EXT_pipeline_protected_access
        uint8_t reserved       : 6;
    };
    uint8_t permutationIndex;
    static constexpr uint32_t kPermutationCount = 0x1 << 2;  // 최대 4가지
};
```

옵션 차원은 최대 4가지다.  
결국 하나의 커널에서 만들어질 수 있는 파이프라인 수:

```
= (고유한 localWorkSize 조합 수) × (최대 4가지 옵션)
```

OpenCL 앱이 `localWorkSize`를 고정해서 쓰면 1~2개로 끝난다.

### 증식이 문제가 되는 패턴

- `localWorkSize=NULL` 전달 → `CLDeviceVk::selectWorkGroupSize()`가 선택. NDRange 크기에 따라 다른 값이 나올 수 있음.
- autotuning 코드 — 최적 워크그룹 크기를 탐색하며 다양한 값을 시도하는 경우.
- 대형 NDRange를 균일 구역으로 분할할 때 각 구역의 워크그룹 수가 다른 경우.

### eviction이 없다

그래픽 파이프라인 캐시 바로 위에 이런 TODO가 있다: (vk_cache_utils.h:2787 부근)

```cpp
// TODO(jmadill): Add cache trimming/eviction.
template <typename Hash>
class GraphicsPipelineCache final : ...
```

ANGLE의 파이프라인 캐시에는 **항목 제거 로직이 없다.**  
커널 객체가 살아있는 동안 캐시도 계속 살아있다.  
앱이 `clReleaseKernel`로 `CLKernelVk`를 소멸시키면 그때서야 캐시도 파괴된다.

---

## 전체 데이터 흐름

```
clEnqueueNDRangeKernel(queue, kernel, 1, NULL, {1024}, {128}, ...)
                                                        ↑ localWorkSize
    │
    ▼ CLCommandQueueVk::enqueueNDRangeKernel() [line 1255]
    │
    ▼ CLKernelVk::getOrCreateComputePipeline(ndrange) [line 370]
    │
    ├─ VkSpecializationInfo 구성
    │   specConstantData = [128, 1, 1]         ← localWorkSize
    │   mapEntries = [ID=1, ID=2, ID=3]        ← WorkgroupSizeX/Y/Z spec ID
    │
    ├─ ComputePipelineDesc 생성
    │   mConstantIds = [1, 2, 3]
    │   mConstants   = [128, 1, 1]
    │   mPipelineOptions.permutationIndex = 0  ← NonRobust + Unprotected
    │
    ├─ mComputePipelineCache.mPayload 조회
    │   │
    │   ├─ 있음 → 기존 PipelineHelper 반환 (vkCreateComputePipelines 생략)
    │   │
    │   └─ 없음 → vkCreateComputePipelines() 호출
    │               └─ VkPipeline (워크그룹 128×1×1로 특화)
    │
    └─ vkCmdBindPipeline + vkCmdDispatch(8, 1, 1)
                                         ↑ 1024/128
```

---

## 정리

| 항목 | 내용 |
|------|------|
| 파이프라인 캐시 위치 | `CLKernelVk::mComputePipelineCache` — 커널 인스턴스마다 독립 |
| 캐시 키 | `ComputePipelineDesc` = spec constant ID + 값 + 옵션 |
| localWorkSize 변경 시 | `mConstants` 달라짐 → 캐시 미스 → 새 `VkPipeline` |
| 파이프라인 수 상한 | (고유 localWorkSize 조합) × 4 (옵션) |
| eviction | 없음. 커널 객체 소멸 시 함께 해제됨 |
| 실제 문제 여부 | autotuning, 가변 localWorkSize 패턴에서 누적 주의 |

OpenCL 앱 입장에서 takeaway:  
`localWorkSize`를 실험적으로 바꾸는 autotuning 루프는  
Vulkan 백엔드에서 파이프라인 컴파일을 반복 유발한다.  
→ 안정화된 크기를 찾았으면 그 값으로 고정해서 쓰는 것이 좋다.
