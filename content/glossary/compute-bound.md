---
title: "compute-bound"
date: 2026-09-26
slug: "compute-bound"
type: "glossary"
term: "compute-bound"
tags: ["performance", "roofline", "flops"]
related: ["memory-bound", "roofline-model", "arithmetic-intensity", "occupancy"]
---

커널 성능이 **연산 처리량 천장**에 막힌 상태. 메모리는 아직 여유가 있다.

## 상세 설명

[[roofline-model]]에서 `Peak BW × AI`가 `Peak FLOPs`보다 크면 이쪽이다. 즉 [[arithmetic-intensity]]가 충분히 높아 데이터를 한 번 가져올 때마다 연산을 많이 하는 커널이다.

### 이 상태에서 먼저 보는 것

- 벡터화 — 한 명령으로 여러 원소를 처리하는가
- 명령 수준 병렬성(ILP) — 의존 연쇄가 길어 파이프가 비지 않는가
- 불필요한 정밀도·초월함수 호출
- [[occupancy]] — 단, 연산 병목에서는 올려도 효과가 작을 수 있다

메모리 접근 최적화(coalescing, LDS 도입)는 여기서 얻는 게 적다.

## 판정 주의

「GFLOP/s가 높다」와 「compute-bound다」는 다르다. 문제 크기나 입출력 바이트가 바뀌면 같은 커널이 [[memory-bound]] 쪽으로 옮겨 간다. 측정 점을 다시 찍어야 한다.

## 비유

자재는 넉넉히 쌓여 있는데 **목수 손이 모자란** 현장.
