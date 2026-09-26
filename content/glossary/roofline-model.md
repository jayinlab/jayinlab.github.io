---
title: "roofline model"
date: 2026-09-26
slug: "roofline-model"
type: "glossary"
term: "roofline model"
tags: ["performance", "roofline", "bandwidth", "flops"]
related: ["arithmetic-intensity", "memory-bandwidth", "compute-bound", "memory-bound", "occupancy"]
---

커널이 도달할 수 있는 성능 상한을 **연산 천장과 메모리 천장 중 낮은 쪽**으로 잡는 판정 그림.

## 상세 설명

```
도달 가능 성능 ≤ min( Peak FLOPs,  Peak BW × AI )
```

- x축은 [[arithmetic-intensity]], y축은 측정 성능(GFLOP/s).
- AI가 낮으면 `BW × AI`가 작아 **메모리 천장**에 먼저 막힌다.
- AI가 충분히 크면 **연산 천장**에 가까워진다.

두 천장이 만나는 AI를 넘는지 여부가 「어디부터 고칠지」를 정한다.

### 적용 4단계

1. 커널의 FLOPs 추정
2. 커널이 옮기는 바이트 추정
3. 디바이스의 Peak BW·Peak FLOPs 확보 — 같은 GPU라도 클럭·전력 상태에 따라 실측 피크는 달라진다
4. 실측 점을 찍고, 어느 천장 근처인지로 다음 작업을 고른다

## 자주 하는 오판

- AI가 매우 낮은데 [[occupancy]]부터 올리려 한다 — 메모리 접근 개선이 먼저다.
- 문제 크기나 입출력 바이트가 바뀌면 같은 커널도 다른 지점으로 이동한다.

## 비유

**천장이 두 개인 방**이다. 키가 아무리 커도 더 낮은 천장에 먼저 머리가 닿는다. 어느 천장에 닿았는지 모르면 엉뚱한 쪽을 뜯는다.
