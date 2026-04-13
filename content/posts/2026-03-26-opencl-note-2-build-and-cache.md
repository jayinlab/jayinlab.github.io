---
title: "OpenCL Note #02 — Build/Compile 경계, Binary Path, 캐시, clspv 관여 시점"
date: 2026-03-26
slug: "opencl-note-2-build-and-cache"
draft: false
type: "note"
series: "opencl-deep-dive"
tags: ["opencl", "clspv", "spirv"]
difficulty: "beginner"
---

이번 노트 목표는 아래 4가지를 명확히 분리하는 것이다.

1. `clCreateProgramWithSource`가 하는 일
2. `clBuildProgram`이 하는 일
3. binary path(`clCreateProgramWithBinary`)의 의미
4. 캐시와 clspv가 실제로 언제 관여하는지

---

## 1) `clCreateProgramWithSource`: "코드 등록" 단계

이 함수는 보통 **컴파일 완료**가 아니라, 소스 코드를 Program 객체에 연결하는 단계에 가깝다.

- 입력: OpenCL C 소스 문자열
- 출력: Program 객체(아직 실행 준비 완성 전일 수 있음)

즉, 이 시점만으로는 “바로 커널 실행 가능”이 보장되지 않는다.

## 2) `clBuildProgram`: "실행 가능한 형태로 준비" 단계

핵심 컴파일/링크/백엔드 준비 작업은 보통 build 단계에서 일어난다.

개념적으로는 다음처럼 생각하면 된다.

- OpenCL C → (clspv 등) → SPIR-V
- SPIR-V를 바탕으로 런타임(Vulkan backend)이 실행 가능한 파이프라인 준비
- 구현에 따라 일부는 lazy(지연) 생성될 수 있음

중요 포인트:
- **enqueue는 제출 단계**이고,
- **build는 실행 준비 단계**라는 경계가 기본 축이다.

## 3) Binary Path: `clCreateProgramWithBinary`

이미 컴파일된/저장된 binary가 있다면 소스 재컴파일 부담을 줄일 수 있다.

- 소스 기반 경로: 사람이 읽기 쉽고 개발 편함
- binary 기반 경로: 재시작/재실행 시 초기 build 비용 절감 가능

여기서 binary의 정확한 내용/호환성은 구현체 정책에 좌우된다.
(벤더/드라이버/옵션이 다르면 재사용 조건이 달라질 수 있음)

## 4) 캐시는 어디에 개입하나?

대표적으로 3지점에서 캐시를 생각할 수 있다.

1. OpenCL 소스→중간표현(SPIR-V) 캐시
2. Vulkan pipeline 생성 결과 캐시
3. 드라이버 내부 JIT/ISA 관련 캐시

따라서 "enqueue 때 느려졌다"는 현상은
- 첫 build 비용,
- 첫 pipeline 생성 비용,
- 첫 실제 실행/JIT 비용
이 합쳐진 것일 수 있다.

## 5) clspv 관여 시점 (프레임 관점)

너의 목표 프레임(ANGLE CL→Vulkan)에서는 clspv를
**소스(OpenCL C)를 SPIR-V로 만드는 컴파일 도구**로 본다.

그래서 보통 mental model은 이렇게 둔다.

- `clCreateProgramWithSource`: 소스 등록
- `clBuildProgram`: clspv 관여 가능성이 큰 준비 단계
- `clEnqueueNDRangeKernel`: 실행 제출 단계 (`vkCmdDispatch` 계열)

주의:
- 구현에 따라 일부 단계가 지연될 수 있음(첫 enqueue에서 pipeline 생성 등)
- 따라서 "항상 이 함수에서 100% 확정"이라고 단정하면 안 된다.

## 6) 지금 너에게 중요한 실전 체크포인트

앞으로 ANGLE 코드 추적할 때 아래 3가지를 꼭 분리해서 보자.

1. "소스/바이너리 Program 생성" 함수 경로
2. "build 호출 시 컴파일/변환" 경로
3. "enqueue 시 실제 Vulkan command recording/submit" 경로

이 3개가 섞이면 이해가 급격히 어려워진다.

---

## 이해 확인 질문 (Self-check)

1. `clCreateProgramWithSource`와 `clBuildProgram`의 책임 차이를 한 문장씩 설명해봐.
2. binary path가 초기 실행 성능에 유리한 이유는?
3. enqueue 시점 지연이 항상 "컴파일 때문"이라고 단정하면 왜 위험한가?
4. clspv는 프레임 안에서 어느 단계에 가장 가깝게 놓는 게 타당한가?
5. 다음 코드 추적에서 3분리(생성/build/enqueue)를 왜 반드시 해야 하나?

## 복습 카드 (Anki 스타일)

- Q: `clCreateProgramWithSource`의 핵심 역할은?  
  A: 소스 코드를 Program 객체에 등록/연결하는 단계.

- Q: `clBuildProgram`의 핵심 역할은?  
  A: 실행 가능한 형태로 준비하는 컴파일/링크/백엔드 준비 단계.

- Q: binary path의 장점은?  
  A: 재컴파일 비용을 줄여 초기 지연을 줄일 수 있음.

- Q: enqueue가 느릴 때 원인은?  
  A: compile/build + pipeline 생성 + JIT 초기비용이 섞일 수 있음.


## 이해 확인 질문 정답 (토글)

### 핵심 정답 요약
<details>
  <summary>정답 보기</summary>
이 노트의 핵심은 **경계 구분**(compile vs submit, layout vs set)과 **연결**(OpenCL→SPIR-V→Vulkan→Dispatch)을 흔들리지 않게 잡는 것이다.
</details>
