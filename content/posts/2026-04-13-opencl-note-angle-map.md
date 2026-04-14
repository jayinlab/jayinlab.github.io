---
title: "ANGLE 분리 지도 — compile chain vs submit chain 개념적 분리"
date: 2026-04-13
slug: "opencl-note-angle-map"
draft: false
type: "note"
series: "opencl-deep-dive"
tags: ["angle", "opencl", "vulkan"]
difficulty: "intermediate"
animation: true
layer: "VK"
---

ANGLE을 추적할 때 가장 먼저 해야 하는 일은 **지도를 나누는 것**이다.  
compile chain과 submit chain을 같은 지도에 그리면 추적 중에 길을 잃는다.

---

## Animation: 두 체인의 분리

{{< chain_anim_v2 >}}

---

## A. Compile Chain — 코드 준비 경로

> 목적: OpenCL 소스/프로그램이 실행 가능한 형태로 준비되는 경로

```
clCreateProgramWithSource
  └─ Program 객체에 source 등록 (컴파일 없음)

clBuildProgram
  └─ clspv 관여 가능 구간
      └─ OpenCL C → SPIR-V 생성
          └─ Vulkan shader module / compute pipeline 준비
```

이 체인은 **실행 준비**다.

---

## B. Submit Chain — 실행 제출 경로

> 목적: 준비된 커널/리소스를 실제 실행 명령으로 제출하는 경로

```
clSetKernelArg
  └─ 커널 인자 상태 기록/갱신

clEnqueueNDRangeKernel
  └─ 실행 명령 생성
      └─ command buffer recording
          └─ vkCmdBindPipeline
          └─ vkCmdBindDescriptorSets
          └─ vkCmdPushConstants
          └─ vkCmdDispatch
              └─ queue submit
```

이 체인은 **실행 제출**이다.

---

## 두 체인 비교

| | Compile Chain | Submit Chain |
|--|--------------|-------------|
| **시작** | clCreateProgramWithSource | clSetKernelArg |
| **핵심 변환** | OpenCL C → SPIR-V → Pipeline | Arg → Command Recording |
| **산출물** | VkShaderModule, VkPipeline | VkCommandBuffer (기록됨) |
| **느리면** | clspv 컴파일 / pipeline 생성 지연 | recording 오버헤드 / submit latency |
| **캐시 대상** | SPIR-V, PipelineCache | — |

---

## 체인 구분 체크포인트

코드를 볼 때 항상 이 질문으로 분류한다:

> "지금 보는 함수가 **코드 변환**인가, **명령 제출**인가?"

- 코드 변환 → compile chain에 기록
- 명령 제출 → submit chain에 기록
- 같은 함수가 두 역할을 하면 → 경계 지점으로 특별 표시

---

## 이해 확인 질문

### Q1. 왜 두 체인을 분리해야 할까?

<details>
<summary>정답 보기</summary>

느림/오류가 compile/build 때문인지, submit/dispatch 때문인지 구분해야  
디버깅과 최적화가 올바른 방향으로 진행된다.  
섞어서 보면 원인 분리가 안 되어 잘못된 최적화를 하게 된다.

</details>

### Q2. `clEnqueueNDRangeKernel`은 항상 컴파일을 트리거할까?

<details>
<summary>정답 보기</summary>

아니다. 일반적으로 enqueue는 실행 제출 단계다.  
다만 구현에 따라 지연 초기화(lazy init)로 일부 pipeline 생성 작업이 동반될 수 있다.  
개념 모델상으로는 submit chain에 배치한다.

</details>

### Q3. `clSetKernelArg`는 어느 체인에 가까울까?

<details>
<summary>정답 보기</summary>

Submit chain 쪽이다.  
실행 시 필요한 인자(descriptor binding 상태)를 준비하는 역할이기 때문이다.  
Compile chain의 SPIR-V나 pipeline 생성과는 관계없다.

</details>

### Q4. 지금 단계의 성공 기준은?

<details>
<summary>정답 보기</summary>

함수 내부 100% 이해가 아니라,  
**compile chain과 submit chain의 1차 지도(호출 흐름)를 분리해서 설명할 수 있는 상태**.

</details>

---

## 관련 글

- [ANGLE 추적 1차](/opencl-note-angle-phase1/) — 이 지도를 바탕으로 코드 레벨 추적 시작
- [ANGLE 추적 2차](/opencl-note-angle-phase2/) — SPIR-V→Vulkan Pipeline 연결점 추적
- [Build/캐시 경계](/opencl-note-build-cache/) — compile chain 내부 세부 분해

## 관련 용어

[[SPIR-V]], [[clspv]], [[ANGLE]], [[command-buffer]], [[pipeline-layout]]
