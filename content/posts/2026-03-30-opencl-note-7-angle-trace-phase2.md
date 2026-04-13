---
title: "OpenCL Note #10 — ANGLE 코드 추적 2차: SPIR-V에서 Vulkan Pipeline/Layout으로"
date: 2026-03-30
slug: "opencl-note-7-angle-trace-phase2"
draft: false
type: "note"
series: "opencl-deep-dive"
tags: ["angle", "spirv", "vulkan", "pipeline"]
difficulty: "intermediate"
---

이번 노트 목표:
- ANGLE 추적 2차로,
- **SPIR-V 산출물 정보가 Vulkan pipeline/layout 생성으로 연결되는 지점**을 찾는 기준을 잡는다.

(고정 목표: ANGLE OpenCL entry → clspv/SPIR-V → Vulkan dispatch → AMD PM4 mental model)

---

## 1) 이번 단계 핵심 질문

1. SPIR-V 모듈은 어디서 로드/보관되는가?
2. DescriptorSet/Binding 정보는 어디서 Vulkan set layout으로 반영되는가?
3. PushConstant 정보는 어디서 pipeline layout range로 반영되는가?
4. 최종적으로 어느 지점에서 compute pipeline 객체가 확정되는가?

이 4개 질문에 답이 잡히면, Note #6의 "분리 지도"가 실제 객체 생성 단계로 내려온다.

---

## 2) 추적 포인트(검색 키워드)

ANGLE 코드에서 아래 키워드를 중심으로 추적:

- SPIR-V 관련
  - `spirv`, `SPIRV`, `shader module`, `create shader module`
- layout 관련
  - `DescriptorSetLayout`, `PipelineLayout`, `PushConstant`
- compute pipeline 관련
  - `ComputePipeline`, `vkCreateComputePipelines`
- dispatch 관련
  - `vkCmdBindPipeline`, `vkCmdBindDescriptorSets`, `vkCmdDispatch`

팁:
- 한 번에 완벽히 찾으려 하지 말고,
- "이 함수가 어떤 Vulkan 객체를 만드는 함수인가" 라벨링부터 한다.

---

## 3) 기대되는 논리 연결(정답 프레임)

이론적으로 우리가 기대하는 연결은 아래와 같다.

1. clspv 결과 SPIR-V 확보
2. SPIR-V로 shader module 생성
3. SPIR-V의 binding/push constant 요구사항을 반영해
   - descriptor set layout 생성
   - pipeline layout 생성
4. compute pipeline 생성
5. 실행 시 bind + dispatch

중요: 코드 구조는 구현체마다 다르지만,
**객체 의존 관계**는 이 프레임을 크게 벗어나지 않는다.

---

## 4) 실제 추적 기록 템플릿 (복붙용)

### [A] SPIR-V → ShaderModule
- 후보 함수:
- 입력 데이터:
- 출력 Vulkan 객체:
- 확인한 근거(파일/라인):

### [B] Binding 정보 → DescriptorSetLayout
- 후보 함수:
- set/binding 반영 방식:
- 생성되는 layout 객체:
- 근거:

### [C] PushConstant → PipelineLayout
- 후보 함수:
- range(size/offset/stage) 반영 방식:
- 근거:

### [D] Pipeline 생성
- 후보 함수:
- `vkCreateComputePipelines` 연결 여부:
- pipeline cache/재사용 힌트:
- 근거:

### [E] Dispatch 체인 연결
- bind pipeline 함수:
- bind descriptor sets 함수:
- dispatch 함수:
- 근거:

---

## 5) 자주 생기는 혼동 3개

1. "SPIR-V가 있으니 곧바로 dispatch 가능"
   - 아님. layout/pipeline 생성/호환 검증이 필요.

2. "binding 정보는 런타임 즉흥 처리"
   - Vulkan은 계약(layout) 기반이라 즉흥 처리 폭이 작다.

3. "enqueue 지연 = 무조건 compile"
   - pipeline 생성/캐시 miss/초기 submit 비용일 수 있음.

---

## 6) 다음 단계 예고

Note #8에서:
- 이번 추적 템플릿으로 네가 찾은 실제 함수 경로를 바탕으로
- "ANGLE 내부 객체 ↔ Vulkan 객체" 대응표를 완성한다.

---

## 이해 확인 질문 (토글형)

### Q1. 왜 SPIR-V 다음에 바로 dispatch가 아니라 layout/pipeline 단계가 필요한가?
<details>
  <summary>정답 보기</summary>
  Vulkan은 명시적 계약 모델이라, 리소스 바인딩 규격(DescriptorSetLayout)과 전체 입력 계약(PipelineLayout), 그리고 실행 객체(Compute Pipeline)가 선행되어야 안전하고 빠르게 dispatch할 수 있다.
</details>

### Q2. 추적할 때 키워드 기반 라벨링을 먼저 하는 이유는?
<details>
  <summary>정답 보기</summary>
  함수 내부 디테일 전에 객체 생성 책임을 먼저 분류해야 전체 지형을 잃지 않는다. (ShaderModule/Layout/Pipeline/Dispatch)
</details>

### Q3. PushConstant 추적에서 반드시 확인할 항목은?
<details>
  <summary>정답 보기</summary>
  range의 size/offset/stage 및 pipeline layout 반영 지점.
</details>

### Q4. `vkCreateComputePipelines`를 찾았다고 끝이 아닌 이유는?
<details>
  <summary>정답 보기</summary>
  실제 실행에는 bind pipeline, bind descriptor sets, push constants, dispatch까지 연결 확인이 필요하다.
</details>

### Q5. 이번 노트의 산출물(완료 기준)은?
<details>
  <summary>정답 보기</summary>
  SPIR-V→Layout→Pipeline→Dispatch로 이어지는 함수 후보 맵(근거 포함) 1차 작성.
</details>

## 복습 카드 (Anki 스타일)

- Q: SPIR-V 다음 단계의 핵심 객체 3개는?  
  A: ShaderModule, PipelineLayout, ComputePipeline.

- Q: DescriptorSetLayout은 무엇을 반영하나?  
  A: set/binding 기반 리소스 슬롯 규격.

- Q: PipelineLayout은 무엇을 묶나?  
  A: descriptor set layouts + push constant ranges.

- Q: dispatch 직전 필수 바인딩은?  
  A: pipeline bind + descriptor sets bind (+ 필요 시 push constants).
