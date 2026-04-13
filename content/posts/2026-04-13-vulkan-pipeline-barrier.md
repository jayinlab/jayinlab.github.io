---
title: "vkCmdPipelineBarrier 깊이 파기 — GPU 동기화의 실제 동작"
date: 2026-04-13
slug: "vulkan-pipeline-barrier"
draft: false
type: "note"
series: "opencl-deep-dive"
tags: ["vulkan", "barrier", "sync", "gpu", "animation"]
difficulty: "intermediate"
---

Shader A가 버퍼에 쓰고, Shader B가 그 버퍼를 읽는다. 문제없어 보인다. 하지만 **barrier 없이는 Shader B가 A의 결과를 읽는다는 보장이 없다**. GPU는 파이프라인을 최대한 채우기 위해 순서를 바꿀 수 있기 때문이다.

`vkCmdPipelineBarrier`는 이 실행 순서와 메모리 가시성을 명시적으로 보장하는 명령이다.

---

## 두 가지 문제를 동시에 해결한다

`vkCmdPipelineBarrier`는 아래 두 가지를 **한꺼번에** 처리한다:

1. **실행 순서(execution dependency)**: src stage가 끝난 후에만 dst stage를 시작
2. **메모리 가시성(memory dependency)**: src의 쓰기 결과가 dst에서 보이도록 캐시 flush/invalidate

이 두 가지를 별도로 생각해야 이해가 쉽다.

---

## Animation

barrier 없을 때 hazard가 어떻게 발생하는지, barrier가 있을 때 어떻게 보장되는지 직접 확인하세요.

{{< pipeline_barrier_anim >}}

---

## API 사용법

```c
vkCmdPipelineBarrier(
    cmdBuf,
    VK_PIPELINE_STAGE_COMPUTE_SHADER_BIT,   // srcStageMask: 여기까지 끝난 후
    VK_PIPELINE_STAGE_COMPUTE_SHADER_BIT,   // dstStageMask: 여기부터 시작 허용
    0,
    0, NULL,       // memory barriers
    1, &bufBarrier, // buffer memory barriers
    0, NULL        // image memory barriers
);
```

`VkBufferMemoryBarrier`:
```c
VkBufferMemoryBarrier bufBarrier = {
    .sType               = VK_STRUCTURE_TYPE_BUFFER_MEMORY_BARRIER,
    .srcAccessMask       = VK_ACCESS_SHADER_WRITE_BIT,  // Shader A의 쓰기
    .dstAccessMask       = VK_ACCESS_SHADER_READ_BIT,   // Shader B의 읽기 전
    .buffer              = myBuffer,
    .offset              = 0,
    .size                = VK_WHOLE_SIZE,
};
```

---

## 핵심 개념

### srcStageMask vs srcAccessMask

- `srcStageMask`: **어느 파이프라인 스테이지**가 끝나야 하는가
- `srcAccessMask`: **어떤 메모리 접근**이 flush되어야 하는가

둘 다 지정해야 한다. 스테이지가 끝나도 캐시가 flush 안 되어 있으면 다른 유닛에서 못 볼 수 있다.

### dstStageMask vs dstAccessMask

- `dstStageMask`: **어느 스테이지부터** 실행을 허용하는가
- `dstAccessMask`: **어떤 접근** 전에 캐시를 invalidate해야 하는가

### 자주 쓰는 패턴

| 상황 | srcStage | srcAccess | dstStage | dstAccess |
|------|---------|-----------|---------|-----------|
| Compute → Compute (buffer) | COMPUTE_SHADER | SHADER_WRITE | COMPUTE_SHADER | SHADER_READ |
| Compute → Transfer (copy) | COMPUTE_SHADER | SHADER_WRITE | TRANSFER | TRANSFER_READ |
| Transfer → Compute | TRANSFER | TRANSFER_WRITE | COMPUTE_SHADER | SHADER_READ |

---

## OpenCL과의 대응

OpenCL에서는 이런 barrier가 보이지 않는다. 하지만 내부적으로는 일어나고 있다.

```
clEnqueueNDRangeKernel(queue, kernelA, ...)  // Shader A
clEnqueueNDRangeKernel(queue, kernelB, ...)  // Shader B (in-order queue)
```

**In-order queue**라면 OpenCL 런타임이 자동으로 kernelA 완료 후 kernelB를 실행한다. ANGLE on Vulkan은 이 순서 보장을 위해 내부적으로 `vkCmdPipelineBarrier`를 삽입한다.

즉, OpenCL 개발자는 안 보이지만 **barrier는 항상 일어나고 있다**.

---

## 주의사항

- **너무 broad한 barrier는 성능을 떨어뜨린다**
  - `VK_PIPELINE_STAGE_ALL_COMMANDS_BIT`는 모든 것을 멈춘다
  - 필요한 스테이지만 정확히 지정하는 것이 좋다

- **이미지 barrier는 layout transition도 함께 처리**
  - 이미지는 `VkImageMemoryBarrier`를 써서 layout도 같이 변경

- **compute-only 워크로드에서는 stage가 단순**
  - `COMPUTE_SHADER` ↔ `COMPUTE_SHADER` 패턴이 대부분

---

## 관련 글

- [clFinish의 내부 구현 — Fence & Semaphore](/clfinish-internals/) — CPU-GPU 수준의 동기화
- [PM4 제출 흐름](/pm4-submit-flow-animation/) — barrier가 PM4 패킷으로 어떻게 변환되는가
- [GPU 메모리 계층 전체 지도](/gpu-memory-hierarchy/) — 왜 캐시 flush가 필요한가

## 관련 용어

[[command-buffer]], [[descriptor-set]], [[pipeline-layout]], [[barrier]], [[ring-buffer]]
