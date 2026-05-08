---
title: "Roofline 모델 첫 실전 체크 — 지금 커널은 Compute-bound인가, Memory-bound인가"
date: 2026-05-08
slug: "opencl-roofline-first-practical-check"
draft: false
type: "note"
series: "opencl-performance"
tags: ["opencl", "performance", "roofline", "memory-bandwidth", "daily-facts"]
difficulty: "intermediate"
---

Roofline은 커널 최적화에서 "어디를 먼저 건드려야 하는지"를 빠르게 결정하는 기준선이다.
핵심은 **Arithmetic Intensity (AI)** 하나다.

- AI = FLOPs / Bytes moved from global memory
- AI가 낮으면 보통 memory-bound
- AI가 높으면 보통 compute-bound

## 1) 30초 판별 루틴

1. 커널 1회 실행 기준으로 FLOPs 대략 계산
2. global memory read/write 바이트 대략 계산
3. `AI = FLOPs / Bytes` 계산
4. 측정 성능(GFLOP/s)와 대역폭(GB/s) 중 어느 ceiling에 가까운지 비교

실무에서는 정확한 절대값보다도,
"최적화 전/후에 AI와 달성 성능이 어느 방향으로 움직였는지"가 더 중요하다.

## 2) SAXPY로 감각 잡기

`saxpy: y[i] = a * x[i] + y[i]`

- FLOPs: 곱셈 1 + 덧셈 1 = 2 FLOPs
- Bytes(단정도): `x` read 4B + `y` read 4B + `y` write 4B = 12B
- AI ≈ 2/12 = 0.167 FLOPs/Byte

AI가 매우 낮아서 보통 memory-bound에 가깝다.
즉 이 커널은 연산 최적화(수학식 미세 튜닝)보다
**메모리 접근 패턴(coalescing, 캐시 친화성)** 개선이 우선순위가 된다.

## 3) 이 판단이 주는 즉시 액션

### memory-bound 신호일 때

- 연속 접근으로 coalescing 개선
- 불필요한 global read/write 제거
- 재사용 데이터는 `__local`/레지스터로 끌어올리기
- 데이터 레이아웃 재정렬(SoA/AoS 검토)

### compute-bound 신호일 때

- instruction mix 정리(FMA 활용 가능성)
- register pressure 과다 여부 확인
- occupancy와 spill trade-off 점검

## 4) 자주 하는 실수

- "GPU 사용률 높다"를 compute-bound로 오해
- AI 계산 없이 감으로 최적화 우선순위 결정
- 작은 입력 1회 측정값만 보고 결론 고정

Roofline은 정답표가 아니라, **실험 방향을 빠르게 정하는 나침반**으로 쓰는 게 맞다.

## 한 줄 정리

커널 최적화 첫 질문은 항상 이것이다:
**"이 커널은 연산이 막히는가, 메모리가 막히는가?"**
Roofline은 그 질문에 가장 빠르게 답해준다.
