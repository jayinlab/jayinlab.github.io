---
title: "OpenCL Note #10 — 종합 다이어그램 + 최종 체크리스트 (S9)"
date: 2026-03-30
slug: "opencl-note-10-final-map-checklist"
draft: false
---

이번 노트는 지금까지 학습한 전체를 한 장으로 묶는 최종 정리다.

(고정 목표: ANGLE OpenCL entry → clspv/SPIR-V → Vulkan dispatch → AMD PM4 mental model)

---

## 1) 종합 다이어그램 (텍스트 버전)

```text
[OpenCL App Layer]
  clCreateProgramWithSource / clBuildProgram / clSetKernelArg / clEnqueueNDRangeKernel
            |
            v
[ANGLE OpenCL Path]
  (A) Compile chain                (B) Submit chain
  - program/source handling         - kernel arg binding state
  - clspv invocation candidates     - command recording candidates
  - SPIR-V module handling          - dispatch command path
            |                                   |
            +-------------------+---------------+
                                v
[Vulkan Layer]
  - Shader module (from SPIR-V)
  - Descriptor Set Layout (set/binding contracts)
  - Pipeline Layout (set layouts + push constant ranges)
  - Compute Pipeline
  - vkCmdBindPipeline
  - vkCmdBindDescriptorSets
  - (push constants)
  - vkCmdDispatch
            |
            v
[Driver Backend / AMD HW-near]
  - command stream generation
  - PM4 packet sequence (Type3 중심)
  - CP 해석 후 compute 실행
```

핵심 분리 축:
- 컴파일 체인: Source -> SPIR-V -> Pipeline 준비
- 제출 체인: Arg/Binding -> Command recording -> Dispatch

---

## 2) 최종 체크리스트

아래 항목을 네가 "설명 가능"하면 현재 단계 목표를 달성한 것.

### A. 개념/용어
- [ ] Pipeline / Pipeline Layout 차이를 설명할 수 있다
- [ ] Descriptor Set / Descriptor Set Layout 차이를 설명할 수 있다
- [ ] 왜 layout(계약)이 필요한지 설명할 수 있다

### B. 체인 분리
- [ ] compile chain vs submit chain을 구분해 말할 수 있다
- [ ] enqueue 지연 원인을 단일 원인으로 단정하지 않는다

### C. clspv/SPIR-V
- [ ] OpenCL C -> clspv -> SPIR-V 흐름을 설명할 수 있다
- [ ] SPIR-V에서 최소 관찰 포인트(OpEntryPoint/Decorate/Variable 등)를 찾을 수 있다
- [ ] vector_add 예제에서 arg↔binding 대응표를 만들 수 있다

### D. Vulkan 연결
- [ ] set/binding이 descriptor set layout으로 이어짐을 설명할 수 있다
- [ ] push constant가 pipeline layout range로 이어짐을 설명할 수 있다
- [ ] dispatch 전 bind 순서를 설명할 수 있다

### E. PM4 관점
- [ ] PM4가 하드웨어 근접 명령 스트림임을 설명할 수 있다
- [ ] Type3가 왜 우선 추적 대상인지 설명할 수 있다
- [ ] dispatch를 패킷 "시퀀스" 관점으로 이해한다

---

## 3) 지금 단계 기준 "완료 정의"

현재 S0~S9를 끝낸 뒤의 완료 정의:

1. 전체 경로(OpenCL→ANGLE→clspv/SPIR-V→Vulkan→PM4)를 말로 설명 가능
2. 각 경계(compile vs submit, layout vs set)를 혼동하지 않음
3. 코드 추적 시 "무엇을 찾을지" 명확한 체크리스트를 갖고 있음

이 3개가 되면, 다음은 "심화 추적"(실제 파일/함수 라인 레벨) 단계다.

---

## 4) 다음 사이클(심화) 제안

다음 라운드는 아래 순서 추천:

1. ANGLE 실제 함수 체인 표(파일/함수명/역할/근거라인)
2. clspv 산출물 2~3개 커널 추가 비교(local memory, barrier 포함)
3. Vulkan descriptor/pipeline 생성 코드 근거 수집
4. AMD PM4 자료와 대조해 dispatch 근처 패킷 패밀리 해석

---

## 이해 확인 질문

### Q1. 전체 경로를 6단계 이내로 요약해봐.
<details>
  <summary>정답 보기</summary>
  OpenCL API -> ANGLE(OpenCL path) -> clspv/SPIR-V -> Vulkan layout/pipeline -> dispatch -> PM4 command stream/실행.
</details>

### Q2. Pipeline과 Descriptor Set의 역할 차이를 한 줄씩 써봐.
<details>
  <summary>정답 보기</summary>
  Pipeline은 계산 로직/실행 상태, Descriptor Set은 계산에 투입할 실제 리소스 묶음.
</details>

### Q3. 왜 compile chain과 submit chain을 분리해야 하나?
<details>
  <summary>정답 보기</summary>
  오류/지연의 원인을 정확히 분리해 디버깅/최적화를 올바르게 하기 위해.
</details>

### Q4. PM4에서 지금 단계 우선 포인트는?
<details>
  <summary>정답 보기</summary>
  Type3 중심 패킷 시퀀스 관점으로 dispatch 주변 흐름을 보는 것.
</details>

### Q5. 다음 심화 사이클에서 네가 먼저 하고 싶은 1개를 고르면?
<details>
  <summary>정답 보기</summary>
  (열린 답) ANGLE 함수 체인 표 작성 / clspv 커널 추가 실습 / Vulkan 생성 코드 대조 / PM4 문서 대조 중 하나.
</details>

## 복습 카드 (Anki 스타일)

- Q: 전체 경로 핵심 키워드 5개는?  
  A: OpenCL, ANGLE, clspv/SPIR-V, Vulkan dispatch, PM4.

- Q: Pipeline vs Descriptor Set 한 줄 정의는?  
  A: Pipeline=연산 로직, Descriptor Set=입력 리소스 묶음.

- Q: Pipeline Layout의 의미는?  
  A: 파이프라인이 기대하는 입력 계약(set layouts + push constants).

- Q: PM4 학습 1순위 관점은?  
  A: 개별 패킷 암기보다 dispatch 주변 시퀀스 이해.
