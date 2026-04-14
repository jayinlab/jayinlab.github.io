---
title: "Vulkan 객체 근거 표 — 4개 API의 파일/라인 근거 수집"
date: 2026-04-13
slug: "opencl-note-vulkan-evidence"
draft: false
type: "note"
series: "opencl-deep-dive"
tags: ["vulkan", "pipeline", "descriptor"]
difficulty: "advanced"
layer: "VK"
---

[체인 표 초안](/opencl-note-angle-chain-table/)에서 "후보"로 표시한 Vulkan 객체 생성 지점.  
이 노트는 실제 파일/라인으로 **확정**하는 과정과 결과를 기록한다.

---

## 목표: 4개 API를 코드에서 직접 찾기

아래 4개는 Vulkan compute에서 변하지 않는 확정 API다.

| 객체 | 호출 API |
|------|---------|
| ShaderModule | `vkCreateShaderModule` |
| DescriptorSetLayout | `vkCreateDescriptorSetLayout` |
| PipelineLayout | `vkCreatePipelineLayout` |
| ComputePipeline | `vkCreateComputePipelines` |

---

## 근거 표 (직접 채우는 형식)

| 객체 | 호출 API | 파일 | 라인 | 상태 |
|------|---------|------|:----:|------|
| ShaderModule | `vkCreateShaderModule` | | | 찾는 중 |
| DescriptorSetLayout | `vkCreateDescriptorSetLayout` | | | 찾는 중 |
| PipelineLayout | `vkCreatePipelineLayout` | | | 찾는 중 |
| ComputePipeline | `vkCreateComputePipelines` | | | 찾는 중 |

---

## 추적 방법

```bash
# 1. 각 API를 소스에서 검색
grep -r "vkCreateShaderModule" --include="*.cpp" -n
grep -r "vkCreateDescriptorSetLayout" --include="*.cpp" -n
grep -r "vkCreatePipelineLayout" --include="*.cpp" -n
grep -r "vkCreateComputePipelines" --include="*.cpp" -n

# 2. 결과에서 ANGLE OpenCL path 관련 파일 필터
# (렌더링 path와 compute path 구분)
```

---

## 확인 원칙

### 1. 추정과 확정을 구분한다

| 상태 | 의미 |
|------|------|
| 찾는 중 | 아직 파일/라인 미확인 |
| 후보 | API 이름은 찾았지만 경로 연결 미확인 |
| 확정 | 파일/라인 + compile chain 연결 확인 |

### 2. Vulkan 객체 의존 순서

```
vkCreateShaderModule
    ↓ (SPIR-V module 준비)
vkCreateDescriptorSetLayout
    ↓ (binding 규격 준비)
vkCreatePipelineLayout
    ↓ (= ShaderModule + setLayouts + pushConstants)
vkCreateComputePipelines
    ↓ (= PipelineLayout + ShaderModule + entrypoint)
```

이 순서로 코드를 찾으면 의존 관계가 자연스럽게 따라온다.

### 3. dispatch 체인도 함께 기록

| 단계 | API | 파일 | 라인 |
|------|-----|------|:----:|
| Pipeline bind | `vkCmdBindPipeline` | | |
| Descriptor bind | `vkCmdBindDescriptorSets` | | |
| Push constants | `vkCmdPushConstants` | | |
| Dispatch | `vkCmdDispatch` | | |

---

## 이해 확인 질문

### Q1. D3에서 가장 중요한 산출물은?

<details>
<summary>정답 보기</summary>

**객체 생성 근거 표** — 파일/라인이 포함된, 재현 가능한 추적 결과.

</details>

### Q2. 왜 상태(후보/확정) 분리가 필요한가?

<details>
<summary>정답 보기</summary>

추정과 사실을 구분해 **지식 품질을 유지**하기 위해서다.  
"아는 것 같다"를 "확정"으로 처리하면 이후 추적에서 잘못된 방향으로 빠진다.

</details>

### Q3. `vkCreateComputePipelines`를 찾기 전에 먼저 찾아야 하는 것은?

<details>
<summary>정답 보기</summary>

`vkCreateShaderModule`, `vkCreateDescriptorSetLayout`, `vkCreatePipelineLayout`.  
Pipeline 생성은 이 세 객체가 준비된 이후에 가능하기 때문에, 의존 순서대로 추적하면 경로가 자연스럽게 연결된다.

</details>

---

## 관련 글

- [ANGLE 체인 표 초안](/opencl-note-angle-chain-table/) — 이 표를 채우기 위한 출발점
- [ANGLE 추적 2차](/opencl-note-angle-phase2/) — 연결 논리 프레임
- [SPIR-V↔Vulkan 매핑](/opencl-note-spirv-vulkan-mapping/) — 이론적 매핑 참조

## 관련 용어

[[ANGLE]], [[descriptor-set]], [[pipeline-layout]], [[SPIR-V]], [[command-buffer]]
