---
title: "OpenCL Note #15 — 심화 시작: ANGLE 함수 체인 추적 킥오프"
date: 2026-03-31
slug: "opencl-note-15-angle-deep-dive-kickoff"
draft: false
type: "note"
series: "opencl-deep-dive"
tags: ["angle", "opencl", "vulkan"]
difficulty: "advanced"
layer: "ANGLE"
---

좋아, 여기서부터는 심화 라운드다.
이번 노트는 "실행 방법 안내"가 아니라, 심화 추적 자체를 이해하기 위한 **완결형 노트**다.

(고정 목표: ANGLE OpenCL entry → clspv/SPIR-V → Vulkan dispatch → AMD PM4 mental model)

## 이번 단계의 핵심 질문

1. ANGLE에서 OpenCL 엔트리포인트는 어디서 시작되는가?
2. Build 경로와 Enqueue 경로는 어디서 갈라지는가?
3. 두 경로가 Vulkan 객체 생성/dispatch에 각각 어떻게 연결되는가?

심화는 이 3개를 근거 라인과 함께 답하는 과정이다.

## 심화 1단계 산출물 정의

이번 단계에서 만들어야 하는 산출물은 아래 2개다.

### A) Compile Chain 표
- Entry 함수
- 다음 호출 함수(1~N hop)
- 역할(소스 처리/빌드/변환/파이프라인 준비)
- 근거 파일/라인

### B) Submit Chain 표
- Entry 함수
- 다음 호출 함수(1~N hop)
- 역할(인자 반영/커맨드 기록/dispatch 제출)
- 근거 파일/라인

핵심은 "완전 해부"가 아니라 **분리된 체인 표**를 먼저 완성하는 것.

## 추적 규칙 (심화용)

- 함수를 보는 즉시 라벨부터 붙인다: `compile` or `submit`
- 내부 디테일보다 호출 연결을 먼저 확정한다
- 같은 파일에 섞여 있어도 표는 반드시 분리 작성한다
- 모르면 "후보"라고 명시하고 넘어간다 (추정/확정 구분)

## 자주 막히는 지점

1. "build와 enqueue가 한 함수 안에서 섞여 보이는" 느낌
   - 해결: 호출 목적 기준으로 라벨링 (변환 준비 vs 실행 제출)

2. "Vulkan 호출이 어디서 시작되는지 모호"
   - 해결: 객체 생성 함수와 command recording 함수를 따로 찾기

3. "근거 없이 아는 느낌"
   - 해결: 반드시 파일/라인을 표에 기록

## 다음 노트 예고

Note #16에서는 실제 근거 기반으로
- compile chain / submit chain 표를 채우고,
- 후보를 확정으로 바꾸는 작업을 시작한다.

## 이해 확인 질문

### Q1. 이번 노트의 목표는 완전 해석인가, 분리 체인 표 확보인가?
<details>
  <summary>정답 보기</summary>
  분리 체인 표 확보가 우선이다. 심화는 지도를 정확히 만든 뒤에 디테일로 내려간다.
</details>

### Q2. 왜 함수를 보자마자 compile/submit 라벨을 붙여야 하나?
<details>
  <summary>정답 보기</summary>
  경로 혼선을 막고, 이후 성능/오류 원인 분석의 기준축을 유지하기 위해서다.
</details>

### Q3. 심화에서 "근거 파일/라인"을 강제하는 이유는?
<details>
  <summary>정답 보기</summary>
  느낌 기반 이해를 배제하고, 재현 가능한 지식으로 만들기 위해서다.
</details>
