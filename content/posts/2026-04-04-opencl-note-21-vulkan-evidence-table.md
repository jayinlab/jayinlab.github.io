---
title: "OpenCL Note #21 — D3 시작: Vulkan 객체 생성 근거 표(채우는 법)"
date: 2026-04-04
slug: "opencl-note-21-vulkan-evidence-table"
draft: false
type: "note"
series: "opencl-deep-dive"
tags: ["vulkan", "pipeline", "descriptor"]
difficulty: "advanced"
layer: "VK"
---

이번 노트는 D3(근거 표 작성)의 시작점이다.
핵심은 "어디서 만들었는지"를 코드 근거로 고정하는 것.

## 목표
- ShaderModule / DescriptorSetLayout / PipelineLayout / ComputePipeline
- 각각의 생성 지점과 호출 체인을 근거 라인과 함께 표로 남긴다.

## 지금 바로 쓰는 확정 맵 (API 기준)

- ShaderModule -> `vkCreateShaderModule`
- DescriptorSetLayout -> `vkCreateDescriptorSetLayout`
- PipelineLayout -> `vkCreatePipelineLayout`
- ComputePipeline -> `vkCreateComputePipelines`

위 4개는 **확정**이다. (Vulkan 객체 생성 API 자체는 변하지 않음)

## 근거 표 (파일/라인 채우기용)

| 객체 | 호출 API | 파일 | 라인 | 상태 |
|---|---|---|---:|---|
| ShaderModule | vkCreateShaderModule |  |  | 찾는 중 |
| DescriptorSetLayout | vkCreateDescriptorSetLayout |  |  | 찾는 중 |
| PipelineLayout | vkCreatePipelineLayout |  |  | 찾는 중 |
| ComputePipeline | vkCreateComputePipelines |  |  | 찾는 중 |

## 최소 원칙
1. 추정과 확정을 분리(상태 컬럼)
2. API 이름을 먼저 고정
3. 파일/라인 없이 "안다"고 처리하지 않기

## 빠른 시작
- `~/opencl_study/scripts/15_trace_angle_candidates.sh` 실행
- 키워드 결과에서 위 4개 API를 먼저 찾고 표를 채운다

## 이해 확인 질문

### Q1. D3에서 가장 중요한 산출물은?
<details><summary>정답 보기</summary>객체 생성 근거 표(파일/라인 포함)다.</details>

### Q2. 왜 상태(후보/확정) 분리가 필요한가?
<details><summary>정답 보기</summary>추정과 사실을 분리해 지식 품질을 유지하기 위해서다.</details>
