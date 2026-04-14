---
title: "Vulkan 용어 직관 — descriptor/pipeline/layout을 주방 비유로 이해"
date: 2026-04-13
slug: "opencl-note-vulkan-terms-intuition"
draft: false
type: "note"
series: "opencl-deep-dive"
tags: ["vulkan", "descriptor", "pipeline"]
difficulty: "beginner"
animation: true
layer: "VK"
---

Vulkan 용어들은 이름이 직관적이지 않다. 처음 접하면 비슷해 보여서 헷갈린다.  
이 노트는 **주방 비유**로 각 개념을 구분하고, animation으로 배치를 확인한다.

---

## 한 줄 비유 먼저

Vulkan compute를 주방으로 비유하면:

| Vulkan 개념 | 주방 비유 |
|------------|---------|
| **Pipeline** | 레시피 (어떤 연산을 할지) |
| **Descriptor Set** | 실제 재료 꾸러미 (버퍼/이미지 핸들) |
| **Descriptor Set Layout** | 재료 꾸러미의 설계도 (몇 번 칸에 어떤 재료가 와야 하는지) |
| **Pipeline Layout** | 레시피가 기대하는 모든 입력 규격서 (꾸러미들 + 소량 양념) |
| **Push Constant** | 조리 직전 빠르게 바꾸는 소량 양념값 (예: `n`) |

핵심:
- 레시피만 있고 재료가 없으면 못 요리한다
- 재료만 있고 레시피가 없으면 뭘 해야 할지 모른다

그래서 `vkCmdDispatch` 전에 **둘 다** 필요하다.

---

## Animation: 각 객체의 위치와 관계

{{< compat_anim_v2 >}}

---

## Descriptor Set Layout vs Descriptor Set

**Descriptor Set Layout (설계도)**  
"binding 0은 읽기 버퍼 a, binding 1은 읽기 버퍼 b, binding 2는 쓰기 버퍼 out" — **형식 정의**.

**Descriptor Set (실물)**  
설계도에 맞춰 실제 버퍼 핸들을 꽂아둔 **실체 객체**.

```
Layout: [slot 0: StorageBuffer] [slot 1: StorageBuffer] [slot 2: StorageBuffer]
   ↕  (규격 일치)
Set:    [slot 0: a_buffer]      [slot 1: b_buffer]      [slot 2: out_buffer]
```

SPIR-V의 `OpDecorate DescriptorSet/Binding`은 이 규칙 정의의 근거가 된다.

---

## Pipeline Layout이 왜 필요한가

Pipeline layout은 "이 파이프라인이 어떤 입력 규격을 기대하는지"를 Vulkan에 선언한다.

담는 것:
1. Descriptor set layouts (슬롯 규격들)
2. Push constant ranges (소량 스칼라 공간)

왜 필요?
- 드라이버가 파이프라인과 리소스 바인딩의 **호환성을 미리 검증**하기 위해
- 런타임에 "이 파이프라인에 이 set을 붙여도 되는가"를 빠르게 판정하기 위해

---

## vector_add에 직접 대입

```c
__kernel void vector_add(__global const float* a,   // descriptor binding 0
                         __global const float* b,   // descriptor binding 1
                         __global float* out,        // descriptor binding 2
                         const int n)               // push constant
```

| 커널 인자 | Vulkan 매핑 |
|---------|------------|
| `a`, `b`, `out` | Descriptor Set 슬롯 0/1/2 (실제 VkBuffer 핸들) |
| `n` | Push Constant (작은 스칼라) |
| 커널 본문 | Pipeline (실행 로직) |

---

## "외우지 않고" 기억하는 질문

다음 한 가지 질문으로 고정한다:

> "지금 나는 **무엇을 계산할지**를 정하는 중인가?  
> 아니면 **어떤 데이터를 넣을지**를 정하는 중인가?"

- 무엇을 계산할지 → **Pipeline**
- 어떤 데이터를 넣을지 → **Descriptor Set**
- 둘의 호환 규격 정의 → **Pipeline Layout + Descriptor Set Layout**

---

## 이해 확인 질문

### Q1. Descriptor Set Layout과 Descriptor Set의 차이를 비유 없이 설명해봐.

<details>
<summary>정답 보기</summary>

- **Descriptor Set Layout**: 각 binding 슬롯의 타입/개수를 정의하는 규격서. 실제 리소스가 없다.
- **Descriptor Set**: 그 규격에 맞춰 실제 VkBuffer/VkImage 핸들을 꽂아둔 실체 객체.

Layout은 "틀"이고, Set은 "틀에 내용을 채운 것"이다.

</details>

### Q2. Pipeline Layout이 없다면 어떤 검증/연결이 불가능해질까?

<details>
<summary>정답 보기</summary>

Pipeline과 Descriptor Set 간의 **호환성 검증**이 불가능해진다.  
SPIR-V의 binding 번호와 실제로 제공된 descriptor set의 binding이 일치하는지 드라이버가 확인할 수 없게 된다.  
또한 push constant의 크기/offset도 선언 없이는 검증할 수 없다.

</details>

### Q3. vkCmdBindPipeline만 하고 dispatch하면 왜 안 되나?

<details>
<summary>정답 보기</summary>

Pipeline은 "어떤 연산을 실행할지"(레시피)만 알고 있다.  
실제 계산에 쓸 버퍼(a, b, out)는 Descriptor Set에 있다.  
Descriptor Set이 bind되지 않으면 GPU가 **어떤 메모리에서 읽고 써야 하는지**를 모른다.

</details>

### Q4. vector_add에서 push constant로 내려갈 값은 무엇이고 왜 거기로 가는가?

<details>
<summary>정답 보기</summary>

`n` (경계 체크용 정수). Push Constant로 내려가는 이유:  
- 작은 스칼라 값이라 별도 버퍼가 낭비
- Command Buffer에 직접 기록되어 매번 binding 없이 빠르게 전달 가능
- clspv가 `__global` 포인터가 아닌 작은 스칼라를 자동으로 PushConstant에 매핑

</details>

### Q5. "계산 로직" vs "입력 데이터"를 지금 네 말로 한 줄씩 정의해봐.

<details>
<summary>정답 보기</summary>

- **계산 로직 (Pipeline)**: GPU가 실행할 셰이더 코드와 실행 조건의 조합
- **입력 데이터 (Descriptor Set)**: 그 계산에 실제로 필요한 버퍼/이미지 핸들의 묶음

</details>

---

## 관련 글

- [SPIR-V↔Vulkan 매핑](/opencl-note-spirv-vulkan-mapping/) — OpDecorate에서 이 구조가 어떻게 나오는가
- [왜 이 이름인가](/opencl-note-vulkan-names-why/) — pipeline, descriptor, layout 이름의 역사적 배경
- [Layout 호환성](/opencl-note-layout-compat/) — 호환/비호환 규칙의 성능 이점

## 관련 용어

[[descriptor-set]], [[pipeline-layout]], [[SPIR-V]], [[command-buffer]]
