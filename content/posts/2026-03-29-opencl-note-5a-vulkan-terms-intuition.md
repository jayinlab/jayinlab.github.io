---
title: "OpenCL Note #06 — Vulkan 용어 직관: Descriptor Set/Layout, Pipeline Layout (비유로 이해)"
date: 2026-03-29
slug: "opencl-note-5a-vulkan-terms-intuition"
draft: false
type: "note"
series: "opencl-deep-dive"
tags: ["vulkan", "descriptor", "pipeline"]
difficulty: "beginner"
---

이번 노트는 "외우는 용어"를 "이해되는 구조"로 바꾸는 용도다.

---

## 0) 한 줄 비유 먼저

Vulkan compute를 "주방"으로 비유하면:

- **Pipeline** = 레시피(어떤 연산을 할지)
- **Descriptor Set** = 실제 재료 꾸러미(버퍼/이미지 핸들)
- **Descriptor Set Layout** = 재료 꾸러미의 설계도(몇 번 칸에 어떤 재료가 와야 하는지)
- **Pipeline Layout** = 레시피가 기대하는 모든 입력 규격서(어떤 꾸러미들 + push constant 규격)
- **Push Constant** = 조리 직전 빠르게 바꾸는 소량 양념값(예: n)

핵심:
- 레시피만 있고 재료가 없으면 못 요리함
- 재료만 있고 레시피가 없으면 뭘 해야 할지 모름

그래서 `vkCmdDispatch` 전에 둘 다 필요하다.

---

## 1) Descriptor Set vs Descriptor Set Layout

### Descriptor Set Layout (설계도)
"binding 0은 읽기 버퍼 a, binding 1은 읽기 버퍼 b, binding 2는 쓰기 버퍼 out" 같은 **형식 정의**.

### Descriptor Set (실물)
설계도에 맞춰 실제 버퍼 핸들을 꽂아둔 **실체 객체**.

즉,
- Layout = 타입/슬롯 규칙
- Set = 실제 리소스 인스턴스

SPIR-V의 `DescriptorSet`/`Binding` 데코레이션은 이 규칙 정의의 근거가 된다.

---

## 2) Pipeline Layout이 왜 필요한가

Pipeline layout은 "이 파이프라인이 어떤 입력 규격을 기대하는지"를 Vulkan에 선언한다.

담는 것:
1. descriptor set layout들
2. push constant range들

왜 필요?
- 드라이버가 파이프라인과 리소스 바인딩의 **호환성**을 미리 검증하려고
- 런타임에 "이 파이프라인에 이 set을 붙여도 되는가"를 빠르게 판정하려고

---

## 3) 왜 `vkCmdBindPipeline` + `vkCmdBindDescriptorSets` 둘 다 해야 하나

- `vkCmdBindPipeline` = "무슨 연산(커널/셰이더)을 실행할지" 선택
- `vkCmdBindDescriptorSets` = "그 연산에 넣을 실제 데이터(버퍼들)" 연결

둘 중 하나라도 없으면:
- pipeline만 있음: 데이터 없음
- descriptor만 있음: 연산 로직 없음

그래서 둘 다 필요하고, 이건 암기가 아니라 구조적 필수다.

---

## 4) 이번 vector_add에 대입

OpenCL:
```c
__kernel void vector_add(__global const float* a,
                         __global const float* b,
                         __global float* out,
                         const int n)
```

직관 매핑:
- a/b/out = descriptor set 안의 buffer 슬롯 0/1/2
- n = push constant의 작은 스칼라 값
- kernel 본문 = pipeline(실행 로직)

---

## 5) "외우지 않고" 기억하는 방법

질문 하나로 고정해:

> "지금 나는 **무엇을 계산할지**를 정하는 중인가? 아니면 **어떤 데이터를 넣을지**를 정하는 중인가?"

- 무엇을 계산할지 → Pipeline
- 어떤 데이터를 넣을지 → Descriptor Set
- 둘의 호환 규격 정의 → Pipeline Layout + Descriptor Set Layout

---

## 이해 확인 질문 (Self-check)

1. Descriptor Set Layout과 Descriptor Set의 차이를 비유 없이 설명해봐.
2. Pipeline Layout이 없다면 어떤 검증/연결이 불가능해질까?
3. `vkCmdBindPipeline`만 하고 dispatch하면 왜 안 되나?
4. vector_add에서 push constant로 내려갈 값은 무엇이고 왜 거기로 가기 쉬울까?
5. "계산 로직" vs "입력 데이터"를 지금 네 말로 한 줄씩 정의해봐.

## 복습 카드 (Anki 스타일)

- Q: Descriptor Set Layout은 무엇인가?  
  A: 리소스 슬롯(binding) 규격서.

- Q: Descriptor Set은 무엇인가?  
  A: 슬롯 규격에 맞춰 실제 버퍼/이미지를 채운 객체.

- Q: Pipeline Layout의 구성은?  
  A: Descriptor set layouts + push constant ranges.

- Q: Dispatch 전에 pipeline과 descriptor를 모두 bind해야 하는 이유는?  
  A: 연산 로직과 입력 데이터가 모두 있어야 실행 가능하기 때문.


## 이해 확인 질문 정답 (토글)

### 핵심 정답 요약
<details>
  <summary>정답 보기</summary>
이 노트의 핵심은 **경계 구분**(compile vs submit, layout vs set)과 **연결**(OpenCL→SPIR-V→Vulkan→Dispatch)을 흔들리지 않게 잡는 것이다.
</details>
