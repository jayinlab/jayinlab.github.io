---
title: "tiny dispatch"
date: 2026-09-26
slug: "tiny-dispatch"
type: "glossary"
term: "tiny dispatch"
tags: ["performance", "dispatch", "pm4", "opencl", "vulkan"]
related: ["dispatch", "submit-overhead", "pm4-packet", "occupancy"]
---

작업량이 작은 커널을 **아주 많이 실행하는 패턴**. 계산보다 제출 비용이 먼저 커지는 구간을 가리킨다.

## 상세 설명

사양 용어가 아니라 이 블로그에서 쓰는 호칭이다. 문제는 두 갈래로 나타난다.

- **제출 쪽** — [[dispatch]] 횟수만큼 [[submit-overhead]]가 선형으로 쌓인다
- **실행 쪽** — work-item 수가 적어 CU 슬롯을 못 채우고, 커널이 짧아 [[occupancy]]로 지연을 숨길 시간도 없다

### 먼저 보는 지표

- 프레임/초당 dispatch 횟수
- [[command-buffer]] 재사용 여부
- 매 dispatch마다 바뀌는 상태량(바인딩 churn)

「커널 계산 시간」보다 「제출 비용」이 큰 구간이 있으면 그 구간이 tiny dispatch다. 몇 회부터 그렇게 되는지는 드라이버·상태 변경량에 따라 달라 **측정으로 찾을 값**이다.

## 비유

한 사람이 한 숟갈씩 **만 번 나르는** 일. 숟갈질 자체는 가볍지만 왕복이 만 번이다.
