---
title: "OpenCL GWS/LWS가 Vulkan Dispatch로 내려갈 때 (택배 비유 포함)"
date: 2026-04-21
slug: "opencl-note-gws-lws-to-vulkan-dispatch"
draft: false
type: "note"
series: "opencl-deep-dive"
tags: ["opencl", "vulkan", "dispatch", "work-group", "performance"]
difficulty: "beginner"
---

오늘 목표: 네가 헷갈린 딱 그 지점, **GWS/LWS와 Vulkan dispatch xyz의 관계**를 숫자로 고정한다.

## 분류체계 (CL/VK/ANGLE/SPV/PM4/PERF)

- CL: 직접
- VK: 직접
- ANGLE: 간접
- SPV: 참고
- PM4: 간접
- PERF: 직접

## 한 줄 핵심

- **GWS** = 전체 문제 크기
- **LWS** = work-group 크기
- Vulkan에서는 보통
  - `local_size`(셰이더에 박힌 그룹 크기)
  - `vkCmdDispatch(groupCountX, groupCountY, groupCountZ)`
  로 표현된다.

즉,

`groupCount = ceil(GWS / LWS)`

---

## 택배 비유로 연결

- GWS = 오늘 처리할 전체 박스 수 (예: 64x64 박스)
- LWS = 한 팀(트럭 1대)이 한 번에 처리하는 박스 블록 (예: 8x8)
- Dispatch groupCount = 오늘 필요한 트럭 대수 (예: 8x8대)

### 예시 1) GWS=64x64, LWS=8x8

- X축 그룹 수: 64/8 = 8
- Y축 그룹 수: 64/8 = 8
- 따라서 Vulkan dispatch는 개념적으로 `dispatch(8, 8, 1)`
- 각 그룹 내부 local size는 `(8,8,1)`

즉 총 work-item 수는
`8*8 groups * 8*8 items/group = 4096 = 64*64`

### 예시 1-2) GWS=64x64, LWS=16x4

- X축 그룹 수: 64/16 = 4
- Y축 그룹 수: 64/4 = 16
- dispatch는 `dispatch(4,16,1)`
- 그룹 모양이 달라졌으므로 메모리 접근/coalescing/점유율 특성이 달라질 수 있다.

둘 다 총 work-item은 4096으로 같지만, **실행 조직이 달라서 성능은 달라질 수 있음**.

---

## 예시 2) GWS=64x64, LWS=NULL이면?

네 질문 핵심 그대로:
- API에서 LWS를 NULL로 줬다면 "사용자가 팀 크기를 안 정한 상태"
- 하지만 실제 실행에는 팀 크기(=LWS)가 필요
- 그래서 런타임/드라이버 경로가 내부적으로 local size를 정한다.

즉 내부 결정이
- 8x8이면 예시 1과 같은 dispatch 형태가 되고,
- 16x4면 예시 1-2와 같은 dispatch 형태가 된다.

결론:
- **NULL은 "미정"이지 "불필요"가 아니다.**
- 실행 직전엔 반드시 숫자로 확정된다.

---

## 어디에서 정하나?

구현마다 다르지만 개념적으로는:
1. OpenCL 런타임 계층이 후보를 정하거나
2. 그 아래 드라이버/백엔드가 하드웨어 제약(최대 work-group 크기 등)을 반영해 확정

ANGLE/OpenCL-on-Vulkan 경로에서도 최종적으로는
"셰이더 local size + dispatch groupCount"로 환산 가능한 숫자가 필요하다.

---

## 자주 하는 오해

- 오해 1: LWS NULL이면 group 개념 없이 알아서 실행된다
  - ❌ 아니고, 내부에서 group 크기 반드시 정함

- 오해 2: 총 work-item 수만 같으면 성능도 같다
  - ❌ group 모양(예: 8x8 vs 16x4)에 따라 성능 달라질 수 있음

- 오해 3: Vulkan dispatch xyz가 곧 total thread 수다
  - ❌ dispatch는 group 수, 실제 thread 수는 `groupCount * local_size`

---

## 초압축 암기 카드

- `GWS = 전체`, `LWS = 그룹`
- `dispatch = 그룹 개수`
- `총 work-item = 그룹 개수 × 그룹 크기`
- `LWS=NULL -> 내부 자동 결정 -> 그래도 최종 숫자 필요`

---

## 관련 글

- [Tiny Dispatch에서 PM4가 얼마나 늘어나는지 직관적으로 보기]({{< relref "2026-04-18-opencl-note-tiny-dispatch-pm4-scale.md" >}})
- [Tiny Dispatch에서 진짜 병목: GPU 연산보다 Submit 경로]({{< relref "2026-04-20-opencl-note-small-dispatch-submit-overhead.md" >}})

## 관련 용어

- [[NDRange]], [[work-group]], [[work-item]], [[command-buffer]], [[queue-family]]
