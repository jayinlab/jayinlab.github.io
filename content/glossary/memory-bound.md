---
title: "memory-bound"
date: 2026-09-26
slug: "memory-bound"
type: "glossary"
term: "memory-bound"
tags: ["performance", "roofline", "memory", "bandwidth"]
related: ["compute-bound", "roofline-model", "arithmetic-intensity", "memory-bandwidth"]
---

커널 성능이 **메모리 전송 천장**에 막힌 상태. 연산 유닛은 데이터를 기다리며 비어 있다.

## 상세 설명

[[roofline-model]]에서 `Peak BW × AI`가 `Peak FLOPs`보다 작으면 이쪽이다. [[arithmetic-intensity]]가 낮은 커널 — 가져온 바이트당 연산이 몇 번뿐인 커널 — 이 대개 여기 속한다.

### 이 상태에서 먼저 보는 것

1. 접근 패턴 — 인접 work-item이 인접 주소를 읽는가
2. 재사용 — [[local-memory]]에 올려 여러 번 쓸 수 있는가
3. 옮기는 바이트 자체 줄이기 — 자료형·중복 로드

### 흔한 오판

- 「LDS를 썼으니 탈출했다」 — bank conflict가 크면 효과가 거의 사라진다.
- 「[[occupancy]]를 올리면 된다」 — 대역폭이 이미 포화면 상주 wave를 늘려도 대기열만 길어진다.

## 비유

목수는 서 있는데 **자재 트럭이 아직 안 온** 현장. 목수를 더 불러도 공사가 빨라지지 않는다.
