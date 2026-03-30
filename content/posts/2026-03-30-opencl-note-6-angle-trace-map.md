---
title: "OpenCL Note #09 — ANGLE 분리 지도(컴파일 체인 vs 커맨드 제출 체인)"
date: 2026-03-30
slug: "opencl-note-6a-angle-trace-map"
draft: false
---

이번 문서는 네 요청대로 **분리된 지도**를 먼저 제공한다.

(고정 목표: ANGLE OpenCL entry → clspv/SPIR-V → Vulkan dispatch → AMD PM4 mental model)

---

## A) 컴파일 체인 지도 (초안)

> 목적: OpenCL 소스/프로그램이 실행 가능한 형태로 준비되는 경로

```text
clCreateProgramWithSource
  -> Program 객체에 source 등록

clBuildProgram
  -> (구현체 내부) 소스 컴파일/변환 단계
  -> (우리 프레임) clspv 관여 가능 구간
  -> SPIR-V 준비/로드
  -> (필요 시) compute pipeline 준비 단계로 연결
```

핵심: 이 체인은 "실행 준비"에 해당한다.

---

## B) 커맨드 제출 체인 지도 (초안)

> 목적: 준비된 커널/리소스를 실제 실행 명령으로 제출하는 경로

```text
clSetKernelArg
  -> 커널 인자 상태 기록/갱신

clEnqueueNDRangeKernel
  -> 실행 명령 생성
  -> (구현체 내부) command recording
  -> vkCmdBindPipeline / vkCmdBindDescriptorSets / (push constants)
  -> vkCmdDispatch
  -> queue submit
```

핵심: 이 체인은 "실행 제출"에 해당한다.

---

## C) 두 체인을 섞지 않기 위한 체크포인트

- 지금 보는 함수가 "코드 변환"인가, "명령 제출"인가?
- 지금 보는 객체가 "Program/Pipeline 준비"인가, "Descriptor/CommandBuffer 실행"인가?
- 이 지점에서 비용이 나는 이유가 compile/build인지, submit/dispatch인지?

---

## D) 학습용 토글 Q&A (클릭해서 펼치기)

### Q1. 왜 두 체인을 분리해야 할까?
<details>
  <summary>정답 보기</summary>
  문제 원인을 분리하기 위해서다. 느림/오류가 compile/build 때문인지, submit/dispatch 때문인지 구분해야 디버깅과 최적화가 가능하다.
</details>

### Q2. `clEnqueueNDRangeKernel`는 항상 컴파일을 트리거할까?
<details>
  <summary>정답 보기</summary>
  아니다. 일반적으로 enqueue는 실행 제출 단계다. 다만 구현에 따라 지연 초기화로 일부 준비 작업이 동반될 수 있다.
</details>

### Q3. `clSetKernelArg`는 어느 체인에 더 가까울까?
<details>
  <summary>정답 보기</summary>
  커맨드 제출 체인 쪽이다. 실행 시 필요한 인자 바인딩 상태를 준비하는 역할이다.
</details>

### Q4. 지금 단계의 성공 기준은?
<details>
  <summary>정답 보기</summary>
  함수 내부 100% 이해가 아니라, compile 체인과 submit 체인의 1차 지도(호출 흐름)를 분리해서 설명할 수 있는 상태다.
</details>
