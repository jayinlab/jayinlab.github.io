---
title: "OpenCL Note #08 — ANGLE 코드 추적 1차: Entry → Build/Enqueue 경로 분리"
date: 2026-03-30
slug: "opencl-note-6-angle-trace-phase1"
draft: false
type: "note"
series: "opencl-deep-dive"
tags: ["angle", "opencl", "clspv"]
difficulty: "intermediate"
---

이번 노트 목표:
- ANGLE OpenCL 경로를 추적할 때,
- **컴파일 체인**과 **커맨드 제출 체인**을 코드 레벨에서 분리하는 방법을 잡는다.

(고정 목표: ANGLE OpenCL entry → clspv/SPIR-V → Vulkan dispatch → AMD PM4 mental model)

---

## 1) 이번 단계에서 할 일 (범위 제한)

이번 1차 추적은 "완전 해부"가 아니라 **길찾기 지도 만들기**다.

- OpenCL API entrypoint 시작점 찾기
- Program 생성/Build 관련 경로 찾기
- Enqueue(특히 NDRange) 경로 찾기
- 각 경로의 함수 체인을 1차로 목록화

핵심: "완벽한 이해"보다 "경로 분리"를 먼저 확보.

---

## 2) 추적 프레임 (반드시 분리)

### A. 컴파일 체인 추적 프레임
- `clCreateProgramWithSource`
- `clBuildProgram`
- 내부에서 clspv/SPIR-V 생성/관리 지점
- (필요 시) pipeline 생성 준비 지점

### B. 커맨드 제출 체인 추적 프레임
- `clSetKernelArg`
- `clEnqueueNDRangeKernel`
- command recording / Vulkan dispatch 연결 지점

둘은 같은 파일에 있어도 **마인드맵을 따로 그려야** 한다.

---

## 3) 실전 코드 추적 순서 (권장)

아래 순서를 그대로 따라가면 된다.

1. API 엔트리 이름으로 grep
   - `clCreateProgramWithSource`
   - `clBuildProgram`
   - `clSetKernelArg`
   - `clEnqueueNDRangeKernel`

2. 각 함수에서 "바로 다음 호출" 1단계만 기록
3. 호출된 함수로 들어가 다시 1단계 기록
4. 5~8단계 정도 쌓이면 1차 체인 완성

중요: 처음엔 깊게 파지 말고 breadth-first로 지도를 만든다.

---

## 4) 기록 템플릿 (복붙해서 쓰기)

아래 템플릿을 그대로 써서 네 로컬 노트에 채워.

### 컴파일 체인
- Entry: `clCreateProgramWithSource` -> ... -> ...
- Entry: `clBuildProgram` -> ... -> ...
- clspv 관여 후보 지점: ...
- SPIR-V 산출/로드 후보 지점: ...

### 커맨드 제출 체인
- Entry: `clSetKernelArg` -> ... -> ...
- Entry: `clEnqueueNDRangeKernel` -> ... -> ...
- Vulkan command recording 후보 지점: ...
- `vkCmdDispatch` 연결 후보 지점: ...

---

## 5) 무엇이 "성공"인가 (이번 단계의 완료 정의)

이번 노트의 완료 기준:

1. 컴파일 체인 1개 이상 함수 체인 도식화
2. 제출 체인 1개 이상 함수 체인 도식화
3. 두 체인에 같은 함수가 나와도 역할 구분 가능

즉, 아직 함수 내부를 100% 이해 못해도 된다.
"체인 분리 지도"만 만들면 성공이다.

---

## 6) 다음 노트 예고

Note #7에서 할 것:
- 이번에 만든 체인을 바탕으로
- "SPIR-V가 실제로 어디서 pipeline/layout으로 이어지는지"를
- 좀 더 구체 함수 단위로 들어간다.

---

## 이해 확인 질문 (Self-check)

1. 이번 1차 추적의 목표를 한 줄로 쓰면?
2. 왜 depth-first가 아니라 breadth-first 지도 작성이 먼저인가?
3. 컴파일 체인과 제출 체인을 분리하지 않으면 생기는 대표 문제는?
4. 이번 단계의 완료 조건 3가지는?
5. 다음 단계(Note #7)에서 확인해야 할 핵심 연결점은?

## 복습 카드 (Anki 스타일)

- Q: Note #6의 핵심 산출물은?  
  A: 컴파일 체인/제출 체인 분리된 1차 함수 지도.

- Q: 1차 추적에서 가장 중요한 원칙은?  
  A: 체인 분리(compile vs submit).

- Q: 처음부터 깊게 파지 말라는 이유는?  
  A: 전체 지형을 놓치면 로컬 디테일이 오히려 혼란을 만든다.

- Q: 이번 단계 성공 기준은 100% 코드 이해인가?  
  A: 아니다. 분리된 경로 지도 확보가 성공 기준.


## 이해 확인 질문 정답 (토글)

### 핵심 정답 요약
<details>
  <summary>정답 보기</summary>
이 노트의 핵심은 **경계 구분**(compile vs submit, layout vs set)과 **연결**(OpenCL→SPIR-V→Vulkan→Dispatch)을 흔들리지 않게 잡는 것이다.
</details>
