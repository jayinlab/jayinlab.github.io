---
title: "ANGLE 체인 표 초안 — compile/submit 함수 체인 1차 맵"
date: 2026-04-13
slug: "opencl-note-angle-chain-table"
draft: false
type: "note"
series: "opencl-deep-dive"
tags: ["angle", "vulkan", "pipeline"]
difficulty: "advanced"
---

[심화 킥오프](/opencl-note-angle-kickoff/)에서 정의한 산출물 형식대로  
compile chain과 submit chain을 **후보 중심 1차 맵**으로 작성한 문서다.

> 이 표는 초안이다. 후보로 표시된 항목은 실제 파일/라인 확인으로 확정한다.

---

## Animation: 두 체인의 함수 흐름

{{< chain_anim_v2 >}}

---

## Compile Chain 표 (초안)

| 단계 | 후보 함수/지점 | 역할 | 상태 |
|------|-------------|------|------|
| C1 | `clCreateProgramWithSource` | 소스 기반 Program 객체 생성 시작 | 확정 |
| C2 | Program 내부 source 보관 지점 | 소스 텍스트/메타 상태 보관 | 후보 |
| C3 | `clBuildProgram` | 빌드 트리거 | 확정 |
| C4 | build 내부 컴파일 경로 | 소스 → SPIR-V 변환 | 후보 |
| C5 | SPIR-V 보관/로드 지점 | backend 전달 준비 | 후보 |
| C6 | Vulkan ShaderModule 준비 지점 | `vkCreateShaderModule` 경로 | 후보 |
| C7 | Descriptor Set Layout 준비 지점 | `vkCreateDescriptorSetLayout` | 후보 |
| C8 | Pipeline Layout 준비 지점 | `vkCreatePipelineLayout` | 후보 |
| C9 | Compute Pipeline 준비 지점 | `vkCreateComputePipelines` | 후보 |

핵심: **C3 이후 경로**가 compile chain의 중심. C6~C9는 Vulkan 객체 생성 구간.

---

## Submit Chain 표 (초안)

| 단계 | 후보 함수/지점 | 역할 | 상태 |
|------|-------------|------|------|
| S1 | `clSetKernelArg` | 커널 인자 상태 반영 | 확정 |
| S2 | 인자 상태 저장 구조 | descriptor/push constant 재료 준비 | 후보 |
| S3 | `clEnqueueNDRangeKernel` | 실행 제출 시작 | 확정 |
| S4 | command buffer recording 시작 지점 | bind/dispatch 명령 기록 시작 | 후보 |
| S5 | `vkCmdBindPipeline` 연결 지점 | pipeline 바인딩 | 후보 |
| S6 | `vkCmdBindDescriptorSets` 연결 지점 | 리소스 세트 바인딩 | 후보 |
| S7 | `vkCmdPushConstants` 연결 지점 | push constant 값 기록 | 후보 |
| S8 | `vkCmdDispatch` 연결 지점 | compute dispatch 트리거 | 후보 |
| S9 | Queue submit 지점 | 드라이버에 실제 제출 | 후보 |

핵심: **S3 이후 경로**가 submit chain의 중심. S5~S8은 Vulkan command recording 구간.

---

## 체인 분리 규칙 요약

```
clBuildProgram 주변 → compile chain
clSetKernelArg / clEnqueueNDRangeKernel 주변 → submit chain

같은 파일에 있어도 라벨을 섞지 않는다.
```

---

## 다음 단계: 후보 → 확정

이 표의 후보 항목들을 실제 파일/라인으로 채우는 작업:

```bash
grep -r "vkCreateShaderModule" --include="*.cpp" -n
grep -r "vkCreateComputePipelines" --include="*.cpp" -n
grep -r "vkCmdDispatch" --include="*.cpp" -n
```

찾은 결과를 각 표의 **파일/라인** 컬럼에 기록한다.

---

## 이해 확인 질문

### Q1. 이번 표의 성격은 "확정본"인가, "초안 맵"인가?

<details>
<summary>정답 보기</summary>

**초안 맵(후보 중심 1차 체인 분리)**이다.  
후보로 표시된 항목은 실제 파일/라인 확인 후 확정으로 바뀐다.

</details>

### Q2. `clSetKernelArg`는 왜 submit chain으로 분류하는가?

<details>
<summary>정답 보기</summary>

실행 시점에 필요한 인자/descriptor 바인딩 상태를 준비하는 단계이기 때문이다.  
코드 생성/빌드 산출물 자체를 바꾸는 compile 단계와는 다르다.

</details>

### Q3. 후보를 후보라고 명시하는 이유는?

<details>
<summary>정답 보기</summary>

추정과 확정을 구분해 **지식 품질과 추적 정확도**를 유지하기 위해서다.  
"안다"는 느낌과 "파일/라인에서 확인했다"는 완전히 다른 수준의 이해다.

</details>

---

## 관련 글

- [ANGLE 심화 킥오프](/opencl-note-angle-kickoff/) — 표 형식 정의
- [ANGLE 추적 2차](/opencl-note-angle-phase2/) — SPIR-V→Vulkan 연결 추적
- [Vulkan 객체 근거 표](/opencl-note-vulkan-evidence/) — C6~C9 항목을 실제로 채운 결과

## 관련 용어

[[ANGLE]], [[SPIR-V]], [[pipeline-layout]], [[descriptor-set]], [[command-buffer]]
