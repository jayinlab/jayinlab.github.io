---
title: "OpenCL Note #03 — SPIR-V 최소 읽기법 (clspv 산출물 해석 시작)"
date: 2026-03-27
slug: "opencl-note-3-spirv-reading"
draft: false
type: "note"
series: "opencl-deep-dive"
tags: ["spirv", "opencl", "clspv"]
difficulty: "beginner"
layer: "CL"
---

이번 노트 목표:
- SPIR-V를 "완전히" 이해하려고 하지 말고,
- **OpenCL→clspv→Vulkan 흐름 추적에 필요한 최소 읽기 포인트**만 잡는다.

---

## 0) 먼저: "컴파일 체인" vs "커맨드 제출 체인"을 왜 분리하나?

네 질문에 대한 핵심 답:

- **컴파일 체인**: 코드 변환/준비 경로
  - OpenCL C 소스
  - clspv
  - SPIR-V
  - (필요 시) 파이프라인 생성 준비

- **커맨드 제출 체인**: 실행 명령 기록/제출 경로
  - enqueue 호출
  - Vulkan command buffer 기록
  - `vkCmdDispatch`
  - queue submit

둘을 섞어서 보면, 예를 들어 "실행이 느리다"는 현상이 나왔을 때
- compile이 느린 건지,
- command recording/submit이 느린 건지,
- 첫 실행 JIT이 느린 건지
구분이 안 된다.

그래서 **원인 분리/디버깅/성능 분석**을 위해 반드시 분리한다.

---

## 1) SPIR-V를 읽을 때 처음 볼 것 5개

SPIR-V 텍스트(disassemble)에서 처음엔 아래 5개만 본다.

1. `OpEntryPoint`
   - 어떤 엔트리 함수가 커널 시작점인지
2. `OpExecutionMode`
   - 실행 모드(컴퓨트 관련 설정) 단서
3. `OpName`
   - 사람이 읽을 이름 매핑
4. `OpDecorate`
   - 바인딩/레이아웃 관련 힌트
5. `OpVariable` + Storage Class
   - 데이터가 어디(Uniform/Storage/Function 등)에 위치하는지

이 5개만 읽어도 "어떤 커널이 어떤 리소스를 어떻게 바라보는지" 감이 잡힌다.

## 2) clspv 산출물에서 특히 볼 포인트

clspv는 OpenCL 커널 모델을 Vulkan 친화 형태로 낮춘다.

초기 단계에서 확인할 포인트:
- 커널 인자들이 어떤 descriptor/resource 형태로 내려갔는지
- workgroup/local size 관련 정보가 어디에 반영됐는지
- push constant/UBO/SSBO 유사 구조로 어떻게 분배됐는지

지금 단계에서는 "완벽한 규칙 암기"보다
**하나의 커널을 정해서 end-to-end로 대응표를 만드는 것**이 훨씬 효과적이다.

## 3) 최소 실습 루프(권장)

1. 아주 작은 OpenCL C 커널 1개 준비
2. clspv로 SPIR-V 생성
3. SPIR-V disassemble
4. 위 5개 포인트만 표시
5. 커널 arg ↔ SPIR-V variable/decorate 대응표 작성

이 루프를 2~3번 반복하면,
다음 노트(Vulkan descriptor/pipeline) 이해 속도가 크게 올라간다.

## 4) 현재 단계의 오해 방지

- SPIR-V를 ISA로 바로 보면 안 된다 (중간표현이다)
- SPIR-V를 완벽히 읽어야 다음 단계로 가는 건 아니다
- 지금은 "추적 가능한 키 포인트"를 잡는 게 목표다

---

## 이해 확인 질문 (Self-check)

1. 컴파일 체인과 커맨드 제출 체인을 한 줄씩 다시 정의해봐.
2. 둘을 섞어 보면 실제로 어떤 문제가 생기나?
3. SPIR-V에서 처음 볼 5개 포인트를 적어봐.
4. 왜 지금 단계에서 SPIR-V 완전 해석보다 대응표 작성이 더 중요한가?
5. 다음 노트 전에 너가 직접 해볼 최소 실습 루프를 3단계로 줄이면?

## 복습 카드 (Anki 스타일)

- Q: 컴파일 체인의 끝 산출물(이 프레임 기준)은?  
  A: SPIR-V 및 실행 준비에 필요한 중간/파이프라인 준비물.

- Q: 커맨드 제출 체인의 핵심 API(개념)는?  
  A: enqueue → command recording → `vkCmdDispatch` → submit.

- Q: SPIR-V 첫 관찰 포인트 5개는?  
  A: `OpEntryPoint`, `OpExecutionMode`, `OpName`, `OpDecorate`, `OpVariable`.

- Q: 왜 체인 분리가 중요한가?  
  A: 원인 분리(compile vs submit vs JIT), 디버깅/성능 분석 정확도 향상.


## 이해 확인 질문 정답 (토글)

### 핵심 정답 요약
<details>
  <summary>정답 보기</summary>
이 노트의 핵심은 **경계 구분**(compile vs submit, layout vs set)과 **연결**(OpenCL→SPIR-V→Vulkan→Dispatch)을 흔들리지 않게 잡는 것이다.
</details>
