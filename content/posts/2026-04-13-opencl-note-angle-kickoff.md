---
title: "ANGLE 심화 킥오프 — compile/submit 체인 표 산출물 정의"
date: 2026-04-13
slug: "opencl-note-angle-kickoff"
draft: false
type: "note"
series: "opencl-deep-dive"
tags: ["angle", "opencl", "vulkan"]
difficulty: "advanced"
layer: "ANGLE"
---

여기서부터는 "이론"이 아니라 **근거 기반 추적**이다.  
이 노트는 심화 추적의 목표와 산출물 형식을 명확히 정의한다.

---

## 심화 추적의 핵심 질문 3개

1. ANGLE에서 OpenCL entrypoint는 어디서 시작되는가?
2. Build 경로와 Enqueue 경로는 어디서 갈라지는가?
3. 두 경로가 Vulkan 객체 생성/dispatch에 각각 어떻게 연결되는가?

심화는 이 3개를 **근거 파일/라인과 함께** 답하는 과정이다.

---

## 산출물 A: Compile Chain 표

| 단계 | 후보 함수/지점 | 역할 | 상태 |
|------|-------------|------|------|
| C1 | `clCreateProgramWithSource` entry | 소스 기반 Program 객체 생성 시작 | 확정 |
| C2 | Program 내부 source 보관 지점 | 소스 텍스트/메타 상태 보관 | 후보 |
| C3 | `clBuildProgram` entry | 빌드 트리거 | 확정 |
| C4 | build 내부 컴파일 경로 | 소스 → SPIR-V 준비 | 후보 |
| C5 | SPIR-V 보관/로드 지점 | backend 전달 준비 | 후보 |
| C6 | Vulkan shader/pipeline 준비 지점 | 실행 객체 준비 | 후보 |

`파일/라인` 컬럼을 실제로 채워야 **확정**이 된다.

---

## 산출물 B: Submit Chain 표

| 단계 | 후보 함수/지점 | 역할 | 상태 |
|------|-------------|------|------|
| S1 | `clSetKernelArg` entry | 커널 인자 상태 반영 | 확정 |
| S2 | 인자 상태 저장 구조 | descriptor/push constant 재료 준비 | 후보 |
| S3 | `clEnqueueNDRangeKernel` entry | 실행 제출 시작 | 확정 |
| S4 | command recording 후보 지점 | bind/dispatch 명령 기록 | 후보 |
| S5 | `vkCmdBindPipeline` 연결 지점 | pipeline 바인딩 | 후보 |
| S6 | `vkCmdBindDescriptorSets` 연결 지점 | 리소스 세트 바인딩 | 후보 |
| S7 | `vkCmdDispatch` 연결 지점 | compute dispatch 트리거 | 후보 |

---

## 추적 규칙

- 함수를 보는 즉시 **compile / submit** 라벨부터 붙인다
- 내부 디테일보다 **호출 연결**을 먼저 확정한다
- 같은 파일에 섞여 있어도 표는 반드시 분리 작성한다
- 모르면 **"후보"**라고 명시하고 넘어간다 (추정/확정 구분)

---

## 자주 막히는 지점

**막힘 1**: "build와 enqueue가 한 함수 안에서 섞여 보이는" 느낌  
→ 호출 **목적** 기준으로 라벨링 (변환 준비 vs 실행 제출)

**막힘 2**: "Vulkan 호출이 어디서 시작되는지 모호"  
→ 객체 **생성** 함수와 **command recording** 함수를 따로 찾는다

**막힘 3**: "근거 없이 아는 느낌"  
→ 반드시 파일/라인을 표에 기록한다

---

## 이해 확인 질문

### Q1. 이번 노트의 목표는 완전 해석인가, 분리 체인 표 확보인가?

<details>
<summary>정답 보기</summary>

**분리 체인 표 확보**가 우선이다.  
심화는 지도를 정확히 만든 뒤에 디테일로 내려간다.  
완전 해석은 표가 완성된 이후에 진행한다.

</details>

### Q2. 함수를 보자마자 compile/submit 라벨을 붙여야 하는 이유는?

<details>
<summary>정답 보기</summary>

경로 혼선을 막고, 성능/오류 원인 분석의 **기준축을 유지**하기 위해서다.  
라벨 없이 추적하면 compile chain을 분석하다가 submit chain으로 빠지는 상황이 반복된다.

</details>

### Q3. "근거 파일/라인"을 강제하는 이유는?

<details>
<summary>정답 보기</summary>

느낌 기반 이해를 배제하고, **재현 가능한 지식**으로 만들기 위해서다.  
"아는 것 같다"와 "파일 X의 라인 Y에서 확인했다"는 완전히 다른 수준의 이해다.

</details>

---

## 관련 글

- [ANGLE 분리 지도](/opencl-note-angle-map/) — 두 체인의 개념적 분리
- [ANGLE 추적 1차](/opencl-note-angle-phase1/) — breadth-first 지도 작성
- [ANGLE 체인 표 초안](/opencl-note-angle-chain-table/) — 이 표의 첫 번째 채우기 결과

## 관련 용어

[[ANGLE]], [[SPIR-V]], [[clspv]], [[pipeline-layout]], [[command-buffer]]
