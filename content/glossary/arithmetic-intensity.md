---
title: "arithmetic intensity"
date: 2026-09-26
slug: "arithmetic-intensity"
type: "glossary"
term: "arithmetic intensity"
tags: ["performance", "roofline", "memory", "flops"]
related: ["roofline-model", "memory-bandwidth", "compute-bound", "memory-bound"]
---

커널이 **메모리에서 옮긴 1바이트당 몇 번 연산하는지**를 나타내는 비율. AI라고 줄여 쓴다.

## 상세 설명

```
AI = FLOPs / Bytes      (단위: FLOP/Byte)
```

같은 알고리즘이라도 문제 크기·데이터 재사용·캐시 적중에 따라 값이 달라진다. 그래서 AI는 하드웨어 상수가 아니라 **커널 하나를 특정 입력으로 돌렸을 때의 성질**이다.

### 추정할 때의 관례

- FMA 1회는 보통 2 FLOPs로 센다.
- 바이트는 `__global` load/store 총량부터 세고, 캐시 적중은 처음엔 무시해 **상한**으로 시작한다.
- 분기 안쪽은 평균 실행 비율이나 worst-case로 따로 적어 둔다.

## 왜 중요한가

AI 하나만으로 [[roofline-model]]에서 이 커널이 [[memory-bound]] 쪽인지 [[compute-bound]] 쪽인지 방향을 가를 수 있다. AI가 낮으면 연산 자원을 늘려도 소용이 없고, 메모리 접근 패턴부터 손봐야 한다.

## 비유

트럭 한 대분 자재를 실어 와서 **몇 번 망치질을 하는가**. 자재만 계속 나르고 망치질은 한 번씩이면, 목수를 더 불러도 공사가 빨라지지 않는다.
