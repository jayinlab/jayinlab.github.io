---
title: "submit overhead"
date: 2026-09-26
slug: "submit-overhead"
type: "glossary"
term: "submit overhead"
tags: ["performance", "dispatch", "pm4", "driver"]
related: ["dispatch", "tiny-dispatch", "command-buffer", "command-queue", "ring-buffer"]
---

커널 계산이 아니라 **명령을 포장하고 제출하고 맞추는 데 드는 비용**.

## 상세 설명

한 번의 [[dispatch]]에는 계산 말고도 이만큼이 붙는다.

- 커맨드 기록 — 상태 설정·바인딩·동기화 패킷 생성
- 제출 — [[ring-buffer]]에 쓰고 GPU에 알리기
- 완료 처리 — 이벤트·펜스 신호와 호스트 쪽 대기

이 비용은 **작업량에 비례하지 않고 호출 횟수에 비례한다.** 그래서 커널이 작아질수록 전체에서 차지하는 비중이 커진다.

### 감각 식

```
총 제출 비용 ~ dispatch 횟수 × (기본 패킷 묶음 + 상태변경 추가 패킷)
```

### 줄이는 기본 3개

1. **배치화** — dispatch를 묶어 submit 횟수를 줄인다
2. **재사용** — [[command-buffer]]·파이프라인·레이아웃을 매번 새로 만들지 않는다
3. **상태 churn 축소** — 매 dispatch마다 바뀌는 바인딩을 줄인다

실제 크기는 드라이버·상태 변경량에 따라 크게 달라지므로, 고정 비율로 외우지 말고 **호출 횟수와 함께 측정**하는 편이 맞다.

## 비유

**택배 포장비**. 물건이 작아도 상자·테이프·송장은 매번 든다. 작은 물건을 따로따로 보내면 물건값보다 포장비가 커진다.
