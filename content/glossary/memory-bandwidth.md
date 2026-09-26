---
title: "memory bandwidth"
date: 2026-09-26
slug: "memory-bandwidth"
type: "glossary"
term: "memory bandwidth"
tags: ["memory", "performance", "bandwidth", "gpu"]
related: ["memory-bound", "roofline-model", "arithmetic-intensity", "local-memory"]
---

단위 시간에 메모리와 주고받을 수 있는 **데이터 양**(보통 GB/s).

## 상세 설명

두 숫자를 구분해서 써야 한다.

| | 무엇 | 성질 |
|---|---|---|
| **Peak BW** | 메모리 클럭·버스 폭으로 계산한 이론 상한 | 스펙 시트 값 |
| **Effective BW** | 실제로 커널이 얻은 전송량 | 접근 패턴·캐시 적중·클럭 상태에 좌우 |

Effective BW가 Peak에 얼마나 붙는지는 **접근 패턴이 결정한다.** 인접한 work-item이 인접한 주소를 읽으면 메모리 트랜잭션이 합쳐지고(coalescing), 흩어져 읽으면 같은 바이트 수를 옮기는 데 트랜잭션이 더 든다.

`__global` 대신 [[local-memory]]에 한 번 올려 여러 번 재사용하면, 옮기는 바이트 자체를 줄여 [[arithmetic-intensity]]를 올릴 수 있다.

## 왜 중요한가

[[roofline-model]]의 메모리 천장 기울기가 바로 이 값이다. Peak BW를 모르면 「지금 성능이 나쁜 편인가」를 판정할 기준이 없다.

## 비유

**수도관의 굵기**. 관이 굵어도 물을 여러 갈래로 조금씩 흘리면 굵기만큼 나오지 않는다.
