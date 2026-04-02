---
title: "OpenCL Note #17 — D1 초안: ANGLE 함수 체인 표(compile vs submit)"
date: 2026-04-02
slug: "opencl-note-17-angle-chain-table-draft"
draft: false
---

이번 노트는 심화 D1의 첫 산출물: **함수 체인 표 초안**이다.

(고정 목표: ANGLE OpenCL entry → clspv/SPIR-V → Vulkan dispatch → AMD PM4 mental model)

## 범위와 주의

- 이 표는 "후보 중심 1차 맵"이다.
- 아직 확정되지 않은 항목은 후보로 표시한다.
- 목적은 디테일 완주가 아니라 체인 분리 정확도 확보.

---

## 1) Compile Chain (초안)

| 단계 | 후보 함수/지점 | 역할 | 상태 |
|---|---|---|---|
| C1 | `clCreateProgramWithSource` entry | 소스 기반 Program 객체 생성 시작 | 확정 |
| C2 | Program 내부 source 보관 지점 | 소스 텍스트/메타 상태 보관 | 후보 |
| C3 | `clBuildProgram` entry | 빌드 트리거 | 확정 |
| C4 | build 내부 컴파일 경로 | 소스 -> (중간표현/SPIR-V) 준비 | 후보 |
| C5 | SPIR-V 보관/로드 지점 | backend 전달 준비 | 후보 |
| C6 | Vulkan shader/pipeline 준비 지점 | 실행 객체 준비 | 후보 |

핵심: C3 이후 경로가 compile 체인의 중심.

---

## 2) Submit Chain (초안)

| 단계 | 후보 함수/지점 | 역할 | 상태 |
|---|---|---|---|
| S1 | `clSetKernelArg` entry | 커널 인자 상태 반영 | 확정 |
| S2 | 인자 상태 저장 구조 | descriptor/push constant 재료 준비 | 후보 |
| S3 | `clEnqueueNDRangeKernel` entry | 실행 제출 시작 | 확정 |
| S4 | command recording 후보 지점 | bind/dispatch 명령 기록 | 후보 |
| S5 | `vkCmdBindPipeline` 연결 지점 | pipeline 바인딩 | 후보 |
| S6 | `vkCmdBindDescriptorSets` 연결 지점 | 리소스 세트 바인딩 | 후보 |
| S7 | `vkCmdDispatch` 연결 지점 | compute dispatch 트리거 | 후보 |

핵심: S3 이후 경로가 submit 체인의 중심.

---

## 3) 체인 분리 체크

- `clBuildProgram` 주변은 compile 체인
- `clSetKernelArg`/`clEnqueueNDRangeKernel` 주변은 submit 체인
- 같은 파일에 있어도 라벨을 섞지 않는다

---

## 4) 다음 단계 (Note #18 예고)

다음 노트에서 할 일:
1. 위 후보 지점을 실제 파일/라인으로 확정
2. 후보/확정 표기 분리
3. 첫 Vulkan 객체 생성 근거와 첫 dispatch 근거를 명시

---

## 이해 확인 질문

### Q1. 이번 노트의 성격은 "확정본"인가 "초안 맵"인가?
<details>
  <summary>정답 보기</summary>
  초안 맵(후보 중심 1차 체인 분리)이다.
</details>

### Q2. 왜 `clSetKernelArg`는 submit 체인으로 보는가?
<details>
  <summary>정답 보기</summary>
  실행 시점에 필요한 인자/바인딩 상태를 준비하는 단계이기 때문이다.
</details>

### Q3. 후보를 후보라고 명시하는 이유는?
<details>
  <summary>정답 보기</summary>
  추정과 확정을 구분해 지식 품질과 추적 정확도를 유지하기 위해.
</details>
