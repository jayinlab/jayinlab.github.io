---
title: "OpenCL Note #1 — 객체 라이프사이클과 컴파일/디스패치 시점"
date: 2026-03-26
slug: "opencl-note-1-lifecycle"
draft: false
---

이번 노트의 목표는 **OpenCL API 호출 순서**와 **실제 내부 작업 시점**을 분리해서 이해하는 것이다.

## 1) 큰 그림: API 순서 vs 내부 시점은 다르다

보통 앱 코드는 이렇게 보인다.

1. platform/device 조회
2. context 생성
3. queue 생성
4. program 생성 (source/binary)
5. build/compile
6. kernel 생성 + arg 설정
7. enqueue (NDRange)
8. finish/read

여기서 핵심은: **enqueue 시점에 모든 것이 새로 컴파일되는 건 아니다.**

- 이미 build된 program이면 enqueue는 주로 실행 제출 단계
- 캐시 hit이면 build 비용이 작거나 거의 없음
- finish는 결과 수신 API라기보다 큐 동기화 보장 API에 가깝다

## 2) 객체별 책임(첫 정리)

- **Platform/Device**: “어떤 구현/하드웨어를 쓸지” 선택
- **Context**: 리소스/객체가 공유되는 논리적 영역
- **Command Queue**: 실행 명령이 들어가는 순서/동기화 단위
- **Program**: 커널 코드의 컴파일 대상 단위
- **Kernel**: 실행 엔트리(함수) + argument 바인딩 대상

## 3) 컴파일/디스패치 경계 (현재 프레임)

현재 목표 프레임(ANGLE + clspv + Vulkan)에서, 개념적으로는 아래처럼 본다.

- OpenCL C 소스 입력
- (build 단계) clspv를 통해 SPIR-V 생성 가능
- (런타임 단계) Vulkan compute pipeline 준비
- enqueue 시점에 `vkCmdDispatch` 성격의 제출이 발생

주의: 실제 구현은 캐시/지연 초기화/파이프라인 생성 타이밍 때문에 더 복잡할 수 있다.

## 4) 네가 이미 맞게 잡은 부분 / 보정할 부분

맞게 잡은 부분:
- OpenCL 객체 흐름을 알고 있음
- clspv→SPIR-V→Vulkan backend compile의 큰 방향을 알고 있음
- enqueue 이후 dispatch 감각이 있음

보정할 부분:
- `clEnqueueNDRangeKernel` = 항상 compile 아님
- `clFinish` = 결과 API보다 동기화 API
- descriptor set/pipeline layout은 “커널 인자/리소스 바인딩 모델”의 핵심

## 5) 다음 노트 예고

**Note #2**에서 다룰 것:
- `clCreateProgramWithSource` vs `clBuildProgram` vs binary path
- 캐시가 어디에 개입할 수 있는지
- “언제 clspv가 관여하는가”를 구현 관점에서 더 명확히

---

## 이해 확인 질문 (Self-check)

1. enqueue가 항상 compile을 의미하지 않는 이유는?
2. Program과 Kernel의 책임 차이는?
3. `clFinish`를 동기화 관점에서 설명해보면?
4. build 단계와 dispatch 단계를 분리하면 어떤 이점이 있나?
5. 다음으로 descriptor set을 공부해야 하는 이유는?

## 복습 카드 (Anki 스타일, 초안)

- Q: OpenCL Queue의 핵심 역할은?
  A: 명령 제출 순서/동기화 단위 관리.

- Q: Program과 Kernel의 관계는?
  A: Program은 코드 단위, Kernel은 실행 엔트리 단위.

- Q: `clEnqueueNDRangeKernel`는 항상 컴파일을 트리거한다?  
  A: 아니다. 보통은 실행 제출이며 컴파일은 선행/캐시 가능.

- Q: `clFinish`의 핵심 의미는?  
  A: 큐에 제출된 이전 작업 완료 보장(동기화).
