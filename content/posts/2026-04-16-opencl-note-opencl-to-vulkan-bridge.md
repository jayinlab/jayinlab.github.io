---
title: "OpenCL → Vulkan 변환 — clspv가 arg를 binding으로 바꾸는 전 과정"
date: 2026-04-16
slug: "opencl-note-opencl-to-vulkan-bridge"
draft: false
type: "note"
series: "opencl-deep-dive"
tags: ["opencl", "vulkan", "clspv", "SPIR-V", "descriptor", "beginner"]
difficulty: "intermediate"
animation: true
layer: "COMP"
---

[OpenCL 입문 애니메이션](/opencl-note-opencl-intro-animation/)에서는 `clSetKernelArg`로 직접 버퍼를 꽂았고,  
[Vulkan 큰 그림](/opencl-note-big-picture-full/)에서는 DSL → DescriptorSet → bind 4단계를 봤다.

이번에는 그 **둘 사이의 다리** — clspv가 OpenCL C를 어떻게 Vulkan용 SPIR-V로 번역하는지,  
그리고 `arg0`이 어떻게 `binding=0`이 되는지를 따라간다.

---

{{< opencl_to_vulkan_anim >}}

---

## 10장면 구성

### 1막 — 두 세계 (장면 1–2)

| 장면 | 내용 | 핵심 포인트 |
|------|------|------------|
| ① | 같은 saxpy, 두 API | OpenCL ~20줄 vs Vulkan ~150줄 |
| ② | clspv 번역기 | `.cl` → `.spv` + OpDecorate decoration |

### 2막 — 변환 규칙 (장면 3–7)

| 장면 | 내용 | 핵심 규칙 |
|------|------|----------|
| ③ | arg0~3 → decoration | `__global` 포인터 → `Binding N` \| 스칼라 → `PushConstant` |
| ④ | decoration → DSL | `DescriptorSet=0, Binding=0` → `VkDescriptorSetLayoutBinding{binding=0}` |
| ⑤ | clSetKernelArg ≡ vkUpdateDescriptorSets | 하는 일은 같다, 표현만 다름 |
| ⑥ | NDRange ↔ vkCmdDispatch | `global÷local = groupCountX` |
| ⑦ | arg3 float → PushConstant | 스칼라는 descriptor 슬롯 낭비 없이 |

### 3막 — 전체 조망 (장면 8–10)

| 장면 | 내용 | 핵심 포인트 |
|------|------|------------|
| ⑧ | 전체 변환 흐름 | `.cl → .spv → Vulkan` 5줄 대응표 |
| ⑨ | 왜 Vulkan은 더 명시적? | driver 추측 제거 / 재사용 / 멀티스레드 |
| ⑩ | 전체 매핑 테이블 | 12개 대응 행 |

---

## 핵심 변환 규칙 3가지

### 규칙 1: `__global` 포인터 → StorageBuffer binding

```
OpenCL C                         SPIR-V (clspv 출력)
──────────────────────           ─────────────────────────────────
__global const float* x  →      OpDecorate %x DescriptorSet 0
                                 OpDecorate %x Binding 0

__global const float* y  →      OpDecorate %y DescriptorSet 0
                                 OpDecorate %y Binding 1

__global float* out      →      OpDecorate %out DescriptorSet 0
                                 OpDecorate %out Binding 2
```

이 decoration을 Vulkan이 읽어서 `VkDescriptorSetLayoutBinding` 배열을 자동 구성.

### 규칙 2: 스칼라 인자 → PushConstant

```
OpenCL C          SPIR-V                  Vulkan
────────────      ──────────────────      ─────────────────────────
const float a  →  OpDecorate %a       →   VkPushConstantRange{size=4}
                  PushConstant            vkCmdPushConstants(0, 4, &a)
```

### 규칙 3: NDRange → vkCmdDispatch

```
OpenCL                       Vulkan
────────────────────         ──────────────────────────────
global_size = 1,000,000  →  vkCmdDispatch(1000000/64, 1, 1)
local_size  =        64      = vkCmdDispatch(15625, 1, 1)
```

---

## clSetKernelArg ≡ vkUpdateDescriptorSets

이 둘은 **같은 일을 한다** — 슬롯 번호에 버퍼를 연결하는 것.

```c
/* OpenCL */
clSetKernelArg(k, 0, sizeof(cl_mem), &x_buf);   // 슬롯 0 ← x
clSetKernelArg(k, 1, sizeof(cl_mem), &y_buf);   // 슬롯 1 ← y
clSetKernelArg(k, 2, sizeof(cl_mem), &out_buf); // 슬롯 2 ← out

/* Vulkan (같은 의미, 더 명시적) */
VkWriteDescriptorSet ws[3] = {
    {.dstBinding=0, .pBufferInfo=&xInfo},   // 슬롯 0 ← x
    {.dstBinding=1, .pBufferInfo=&yInfo},   // 슬롯 1 ← y
    {.dstBinding=2, .pBufferInfo=&outInfo}, // 슬롯 2 ← out
};
vkUpdateDescriptorSets(dev, 3, ws, 0, NULL);
vkCmdBindDescriptorSets(cmd, ..., &ds, ...);
```

차이: OpenCL은 1줄로 끝나고, Vulkan은 DSL 생성 → DS 할당 → Write → Bind 4단계.  
Vulkan이 더 복잡한 이유는 이 명시성이 driver 추측을 제거하고 재사용을 가능하게 하기 때문.

---

## 전체 대응표

| OpenCL API | clspv / SPIR-V | Vulkan API |
|-----------|---------------|-----------|
| `clGetDeviceIDs` + `clCreateContext` | (플랫폼 선택) | `VkInstance` → `VkDevice` |
| `cl_command_queue` | (실행 채널) | `VkCommandBuffer` + `VkQueue` |
| `cl_mem` (clCreateBuffer) | `OpTypePointer StorageBuffer` | `VkBuffer` + `VkDeviceMemory` |
| `clBuildProgram` | clspv 컴파일 → .spv | `vkCreateShaderModule(spv)` |
| `clCreateKernel` | (커널 핸들) | `VkPipeline` (compute) |
| **`clSetKernelArg(k, N, &buf)`** | `OpDecorate %x Binding N` | **`vkUpdateDescriptorSets(N)`** |
| `clSetKernelArg(k, 3, &a)` | `OpDecorate %a PushConstant` | `vkCmdPushConstants(a)` |
| `global/local_size` | `LocalSize(local,1,1)` | `vkCmdDispatch(g/l, 1, 1)` |
| `get_global_id(0)` | `gl_GlobalInvocationID.x` | (동일) |
| `clFinish(q)` | (동기화) | `vkQueueWaitIdle` / Fence |

---

## 핵심 3줄

```
1. clspv: __global 포인터 arg → DescriptorSet/Binding decoration (자동)
2. clspv: 스칼라 arg → PushConstant decoration (자동)
3. 이 decoration을 Vulkan이 읽어서 DSL을 구성 — OpenCL과 Vulkan은 같은 일을 다른 언어로 표현
```

---

## 관련 글

- [OpenCL 큰 그림 — Platform에서 clFinish까지](/opencl-note-opencl-intro-animation/)
- [GPU 배송센터 심화편 (Vulkan)](/opencl-note-big-picture-full/)
- [Arg0→슬롯 미니 예제](/opencl-note-arg0-to-slot/) — clspv 산출물 직접 확인

## 관련 용어

[[descriptor-set]], [[pipeline-layout]], [[SPIR-V]], [[clspv]], [[work-item]], [[NDRange]]
