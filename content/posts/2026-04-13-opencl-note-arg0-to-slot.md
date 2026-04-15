---
title: "Arg0→슬롯 미니 예제 — saxpy 커널 인자를 슬롯 매핑으로 구체화"
date: 2026-04-13
slug: "opencl-note-arg0-to-slot"
draft: false
type: "note"
series: "opencl-deep-dive"
tags: ["vulkan", "descriptor", "opencl"]
difficulty: "intermediate"
animation: true
layer: "COMP"
---

"OpenCL 인자가 어떻게 Vulkan 슬롯이 되는가"를 saxpy 커널 하나로 구체화한다.

---

## 예제 커널: saxpy

```c
__kernel void saxpy(
    __global const float* x,   // arg0
    __global const float* y,   // arg1
    __global float* out,       // arg2
    const float a              // arg3
) {
    int i = get_global_id(0);
    out[i] = a * x[i] + y[i];
}
```

---

{{< arg_slot_anim >}}

## 인자 → 슬롯 매핑 과정

```mermaid
flowchart LR
    subgraph kernel["OpenCL C kernel"]
        K0["arg0: x (__global const float*)"]
        K1["arg1: y (__global const float*)"]
        K2["arg2: out (__global float*)"]
        K3["arg3: a (const float)"]
    end

    subgraph spirv["SPIR-V (clspv 산출물)"]
        S0["StorageBuffer, set=0, binding=0"]
        S1["StorageBuffer, set=0, binding=1"]
        S2["StorageBuffer, set=0, binding=2"]
        S3["PushConstant"]
    end

    subgraph vk["Vulkan"]
        V0["DescriptorSetLayout\nb0: STORAGE_BUFFER\nb1: STORAGE_BUFFER\nb2: STORAGE_BUFFER"]
        V1["PipelineLayout\n= DSL + PushConstant(float)"]
        V2["DescriptorSet\nb0 → x_buffer\nb1 → y_buffer\nb2 → out_buffer"]
        V3["vkCmdPushConstants\n= float a"]
    end

    K0 --> S0 --> V0
    K1 --> S1 --> V0
    K2 --> S2 --> V0
    K3 --> S3 --> V1
    V0 --> V2
```

---

## 실제 Vulkan 코드 흐름

```c
// 1. DSL 생성 (arg0~2 → binding 0~2)
VkDescriptorSetLayoutBinding bindings[] = {
    { .binding=0, .descriptorType=VK_DESCRIPTOR_TYPE_STORAGE_BUFFER, ... },
    { .binding=1, .descriptorType=VK_DESCRIPTOR_TYPE_STORAGE_BUFFER, ... },
    { .binding=2, .descriptorType=VK_DESCRIPTOR_TYPE_STORAGE_BUFFER, ... },
};

// 2. PipelineLayout 생성 (DSL + push constant)
VkPushConstantRange pcRange = { .size=sizeof(float), ... };
// vkCreatePipelineLayout(... dslArray + pcRange ...)

// 3. Descriptor Set에 실제 버퍼 연결
// vkUpdateDescriptorSets: b0←x, b1←y, b2←out

// 4. Dispatch 전 bind
vkCmdBindPipeline(cmdBuf, VK_PIPELINE_BIND_POINT_COMPUTE, pipeline);
vkCmdBindDescriptorSets(cmdBuf, ..., descriptorSet, ...);
vkCmdPushConstants(cmdBuf, ..., sizeof(float), &a);
vkCmdDispatch(cmdBuf, n/64, 1, 1);
```

---

## arg3 (스칼라 `a`)가 PushConstant인 이유

- `__global` 포인터가 아닌 **작은 스칼라 값**
- descriptor slot을 쓰지 않아도 된다
- command buffer에 직접 기록 → 오버헤드 최소
- clspv가 이 패턴을 자동으로 PushConstant로 매핑한다

---

## 실전 체크포인트

- 커널 시그니처를 바꾸면 → descriptor layout/write 코드도 함께 재검토
- SPIR-V의 reflection 정보(set/binding/type)를 기준으로 host 코드와 대조
- pipeline create 성공만으로 안심하지 말고 bind/dispatch 호환성까지 확인

---

## 이해 확인 질문

### Q1. saxpy에서 arg0~2가 binding 0~2로 매핑되는 이유는?

<details>
<summary>정답 보기</summary>

clspv가 `__global` 포인터 인자를 순서대로 StorageBuffer descriptor binding으로 매핑한다.  
(실제 binding 번호는 clspv 옵션/반사 정책에 따라 달라질 수 있으나, 기본 동작은 순서 기반)

</details>

### Q2. `const float a`가 PushConstant로 내려가는 이유는?

<details>
<summary>정답 보기</summary>

`__global` 포인터가 아닌 작은 스칼라 값이라 별도 descriptor slot이 낭비된다.  
PushConstant는 command buffer에 직접 기록되어 오버헤드가 작다.  
clspv가 이 패턴을 자동으로 PushConstant로 매핑한다.

</details>

### Q3. 커널 시그니처를 바꾸면 무엇을 함께 바꿔야 하는가?

<details>
<summary>정답 보기</summary>

1. `VkDescriptorSetLayoutBinding` 배열 재생성
2. `VkPipelineLayout` 재생성
3. `vkUpdateDescriptorSets` 코드 재검토
4. push constant range 및 크기/offset 확인

</details>

---

## 관련 글

- [clspv 실전](/opencl-note-clspv-practice/) — vector_add 대응표
- [SPIR-V↔Vulkan 매핑](/opencl-note-spirv-vulkan-mapping/) — 매핑 이론
- [고정 슬롯이 빠른 이유](/opencl-note-fixed-slots-fast/) — 슬롯 계약의 성능 원리

## 관련 용어

[[descriptor-set]], [[pipeline-layout]], [[SPIR-V]], [[clspv]]
