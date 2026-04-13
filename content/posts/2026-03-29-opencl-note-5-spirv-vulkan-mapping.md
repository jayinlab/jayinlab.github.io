---
title: "OpenCL Note #05 — SPIR-V와 Vulkan Descriptor/Pipeline Layout 매핑"
date: 2026-03-29
slug: "opencl-note-5-spirv-vulkan-mapping"
draft: false
type: "note"
series: "opencl-deep-dive"
tags: ["spirv", "vulkan", "descriptor"]
difficulty: "intermediate"
---

이번 노트 목표:
- clspv 산출물(SPIR-V)에서 보이는 정보를
- Vulkan의 descriptor set / pipeline layout 개념과 1:1로 연결한다.

(우리 고정 목표: ANGLE OpenCL entry → clspv/SPIR-V → Vulkan dispatch → AMD PM4 mental model)

---

## 1) 우리가 이미 본 SPIR-V 단서

`vector_add.spvasm`에서 확인한 핵심:

- `OpDecorate %15 DescriptorSet 0`
- `OpDecorate %15 Binding 0`
- `OpDecorate %16 DescriptorSet 0`
- `OpDecorate %16 Binding 1`
- `OpDecorate %17 DescriptorSet 0`
- `OpDecorate %17 Binding 2`
- `OpVariable ... StorageBuffer` (a, b, out 후보)
- `OpVariable ... PushConstant` (n 후보)

이건 Vulkan 관점에서 거의 "설계도"다.

## 2) Vulkan 쪽 대응 개념

### (A) Descriptor Set Layout
SPIR-V의 `DescriptorSet` + `Binding` 데코레이션은
Vulkan에서 descriptor set layout 바인딩 정의로 연결된다.

예: set=0, binding=0/1/2
- binding 0: 입력 버퍼 a
- binding 1: 입력 버퍼 b
- binding 2: 출력 버퍼 out

### (B) Pipeline Layout
Pipeline layout은 크게 두 가지를 묶는다.
1. descriptor set layouts
2. push constant ranges

SPIR-V에 PushConstant 변수가 보이면,
Vulkan pipeline layout에도 해당 range 정의가 필요하다.

### (C) Compute Pipeline
SPIR-V 모듈 + entrypoint(`vector_add`)로 compute pipeline을 만든다.
그리고 command buffer에서 pipeline 바인딩 후 dispatch한다.

## 3) OpenCL 인자와 Vulkan 리소스 매핑 (이번 예제)

- `__global const float* a` → StorageBuffer(set0,binding0)
- `__global const float* b` → StorageBuffer(set0,binding1)
- `__global float* out` → StorageBuffer(set0,binding2)
- `const int n` → PushConstant(범위 내 int)

즉, OpenCL 커널 시그니처가 Vulkan 바인딩 모델로 "펼쳐진" 상태가 SPIR-V에 반영된다.

## 4) 실행 시퀀스(개념)

1. SPIR-V 로드
2. descriptor set layout 생성
3. pipeline layout 생성 (set layouts + push constant range)
4. compute pipeline 생성
5. descriptor set에 실제 버퍼(a,b,out) 바인딩
6. push constant에 n 기록
7. `vkCmdBindPipeline` / `vkCmdBindDescriptorSets` / (push constants) / `vkCmdDispatch`

이 흐름을 이해하면,
"OpenCL 인자 설정 → 실제 Vulkan 실행 준비"가 머릿속에서 연결된다.

## 5) ANGLE 코드 추적에서 어디를 볼까

다음 추적 포인트:
- 커널 인자 정보를 내부 구조로 들고 있는 지점
- descriptor binding 번호를 할당/고정하는 지점
- push constant를 구성하는 지점
- dispatch 직전 command buffer recording 지점

핵심은, "SPIR-V에 보인 binding 정보"와 "실제 Vulkan API 호출 인자"를 대조하는 것이다.

---

## 이해 확인 질문 (Self-check)

1. DescriptorSet/Binding 데코레이션은 Vulkan의 무엇으로 대응되나?
2. Pipeline layout이 descriptor set layout 외에 함께 들고 있어야 하는 건?
3. 이번 예제에서 `n`이 push constant로 내려간다는 건 Vulkan 쪽에서 무엇을 준비해야 함을 뜻하나?
4. `vkCmdDispatch` 전에 반드시 맞아야 하는 바인딩 2개는?
5. SPIR-V를 보고 Vulkan 추적할 때 가장 먼저 맞춰볼 "대조쌍" 2개는?

## 복습 카드 (Anki 스타일)

- Q: SPIR-V의 `DescriptorSet/Binding`은 Vulkan에서 어디로 가나?  
  A: Descriptor set layout 바인딩 정의.

- Q: Pipeline layout의 구성요소 2개는?  
  A: Descriptor set layouts + push constant ranges.

- Q: OpenCL의 스칼라 인자(`const int n`)는 이 프레임에서 주로 어디로 매핑되나?  
  A: Push constant.

- Q: dispatch 전 최소 바인딩 순서는?  
  A: Pipeline bind → Descriptor set bind → (필요 시 push constants) → Dispatch.


## 이해 확인 질문 정답 (토글)

### 핵심 정답 요약
<details>
  <summary>정답 보기</summary>
이 노트의 핵심은 **경계 구분**(compile vs submit, layout vs set)과 **연결**(OpenCL→SPIR-V→Vulkan→Dispatch)을 흔들리지 않게 잡는 것이다.
</details>
