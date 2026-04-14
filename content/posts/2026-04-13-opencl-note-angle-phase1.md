---
title: "ANGLE 추적 1차 — Entry에서 Build/Enqueue 경로 분리 지도 만들기"
date: 2026-04-13
slug: "opencl-note-angle-phase1"
draft: false
type: "note"
series: "opencl-deep-dive"
tags: ["angle", "opencl", "clspv"]
difficulty: "intermediate"
layer: "ANGLE"
---

ANGLE 코드를 처음 추적할 때는 **깊이보다 지형**이 먼저다.  
함수 내부를 100% 이해하려 하면 전체 지도를 잃는다.  
이 노트는 breadth-first 지도 작성법을 안내한다.

---

## 추적 목표 (범위 제한)

이번 1차 추적은 "완전 해부"가 아니라 **길찾기 지도 만들기**다.

- OpenCL API entrypoint 시작점 찾기
- Program 생성/Build 관련 경로 1차 분류
- Enqueue(NDRange) 경로 1차 분류
- 각 경로의 함수 체인을 "다음 1단계"씩 목록화

---

## 추적 프레임

### A. Compile Chain 추적 프레임

```
clCreateProgramWithSource  ← 여기서 시작
  → [다음 내부 함수?]
  → [SPIR-V/binary 저장 지점?]

clBuildProgram             ← 여기서 시작
  → [clspv 관여 후보?]
  → [pipeline 준비 연결 지점?]
```

### B. Submit Chain 추적 프레임

```
clSetKernelArg             ← 여기서 시작
  → [인자 상태 저장 지점?]

clEnqueueNDRangeKernel     ← 여기서 시작
  → [command recording 시작 지점?]
  → [vkCmdDispatch 연결 후보?]
```

---

## 실전 추적 순서

```bash
# Step 1: API 엔트리 이름으로 grep
grep -r "clCreateProgramWithSource" --include="*.cpp" -l
grep -r "clBuildProgram" --include="*.cpp" -l
grep -r "clEnqueueNDRangeKernel" --include="*.cpp" -l

# Step 2: 각 함수에서 "바로 다음 호출" 1단계만 기록
# Step 3: 호출된 함수로 들어가 다시 1단계 기록
# Step 4: 5~8단계 쌓이면 1차 체인 완성
```

> 중요: 처음엔 깊게 파지 말고 breadth-first로 지도를 만든다.

---

## 1차 추적 기록 템플릿

아래를 복붙해서 채운다.

### Compile Chain

| API | → | 내부 함수 1 | → | 내부 함수 2 | → | 후보 역할 |
|-----|---|------------|---|------------|---|---------|
| `clCreateProgramWithSource` | | | | | | source 저장 |
| `clBuildProgram` | | | | | | clspv/SPIR-V |

```
clspv 관여 후보 지점: [채울 것]
SPIR-V 산출/로드 후보 지점: [채울 것]
```

### Submit Chain

| API | → | 내부 함수 1 | → | 내부 함수 2 | → | 후보 역할 |
|-----|---|------------|---|------------|---|---------|
| `clSetKernelArg` | | | | | | 인자 저장 |
| `clEnqueueNDRangeKernel` | | | | | | dispatch |

```
Vulkan command recording 후보 지점: [채울 것]
vkCmdDispatch 연결 후보 지점: [채울 것]
```

---

## 완료 기준

이번 노트의 완료 기준:

1. Compile chain 1개 이상 함수 체인 도식화 완료
2. Submit chain 1개 이상 함수 체인 도식화 완료
3. 두 체인에 같은 함수가 나와도 역할 구분 가능

아직 함수 내부를 100% 이해 못해도 된다.  
**체인 분리 지도**만 만들면 성공이다.

---

## 이해 확인 질문

### Q1. 이번 1차 추적의 목표를 한 줄로 쓰면?

<details>
<summary>정답 보기</summary>

Compile chain과 submit chain의 함수 호출 흐름을 분리해서 1차 지도로 만드는 것.  
완전한 내부 이해가 아니라 경로 지형 파악이 목표다.

</details>

### Q2. 왜 depth-first가 아니라 breadth-first 지도 작성이 먼저인가?

<details>
<summary>정답 보기</summary>

처음부터 깊게 파면 전체 지형을 잃는다.  
로컬 디테일에 빠지면 "내가 compile chain을 보는지 submit chain을 보는지" 구분이 안 된다.  
먼저 지도를 만들어야 세부 탐색 위치를 알 수 있다.

</details>

### Q3. Compile chain과 submit chain을 분리하지 않으면 생기는 대표 문제는?

<details>
<summary>정답 보기</summary>

실행 지연의 원인을 분리할 수 없다.  
"느린 이유가 컴파일인지 dispatch인지" 모르면 최적화 방향을 잘못 잡게 된다.

</details>

### Q4. 이번 단계의 완료 조건 3가지는?

<details>
<summary>정답 보기</summary>

1. Compile chain 함수 체인 1개 이상 도식화
2. Submit chain 함수 체인 1개 이상 도식화
3. 같은 함수가 두 체인에 나와도 역할 구분 가능

</details>

### Q5. 다음 단계(phase2)에서 확인해야 할 핵심 연결점은?

<details>
<summary>정답 보기</summary>

SPIR-V → Vulkan shader module → descriptor set layout → pipeline layout → compute pipeline 생성으로 이어지는 **객체 생성 연결점**.  
이번 1차 추적에서 만든 지도에서 "pipeline 관련 함수"로 표시된 지점을 심화 탐색한다.

</details>

---

## 관련 글

- [ANGLE 분리 지도](/opencl-note-angle-map/) — compile/submit 체인 개념 분리
- [ANGLE 추적 2차](/opencl-note-angle-phase2/) — SPIR-V→Vulkan Pipeline 연결점 상세 추적

## 관련 용어

[[ANGLE]], [[SPIR-V]], [[clspv]], [[command-buffer]], [[pipeline-layout]]
