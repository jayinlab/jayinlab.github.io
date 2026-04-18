---
title: "Tiny Dispatch에서 PM4가 얼마나 늘어나는지 직관적으로 보기"
date: 2026-04-18
slug: "opencl-note-tiny-dispatch-pm4-scale"
draft: false
type: "note"
series: "opencl-deep-dive"
tags: ["opencl", "vulkan", "pm4", "performance", "dispatch", "driver-backend"]
difficulty: "beginner"
---

작은 커널을 매우 자주 dispatch할 때,
"PM4가 도대체 얼마나 많이 생기나?"를 직관적으로 보는 노트.

## 분류체계 (CL/VK/ANGLE/SPV/PM4/PERF)

- CL: 간접
- VK: 직접
- ANGLE: 참고
- SPV: 참고
- PM4: 직접
- PERF: 직접

## 한 줄 핵심

**dispatch 1회 = PM4 1개가 아니라, 보통 여러 패킷 묶음**이다.
그래서 tiny dispatch를 많이 하면 계산보다 "명령 포장/제출" 비용이 먼저 커질 수 있다.

## 직관 애니메이션

{{< pm4_submit_anim >}}

## 빠른 감각표 (아주 거친 추정)

> 아래 수치는 구현/드라이버/상태변경량에 따라 크게 달라질 수 있다.
> 목표는 "정확한 카운트"가 아니라 "증가 방향"을 잡는 것.

| 패턴 | dispatch 수 | dispatch당 PM4 감각 | 총 PM4 감각 |
|---|---:|---:|---:|
| 큰 커널 드물게 | 10 | 수~수십 | 수십~수백 |
| 중간 커널 반복 | 1,000 | 수~수십 | 수천~수만 |
| tiny kernel 과다 | 10,000 | 수~수십(상태변경 크면 증가) | 수만~수십만 |

## 왜 dispatch 1번에 여러 패킷이 생기나

보통 한 번의 dispatch에도 아래가 따라온다.

- 실행 상태 설정(파이프라인/리소스)
- 필요한 동기화/캐시 관련 제어
- 실제 dispatch 트리거 패킷

즉, dispatch는 "하나의 호출"이지만,
하부 커맨드 스트림에서는 "여러 패킷 시퀀스"로 전개된다.

## 실전에서 제일 먼저 보는 지표

- dispatch 횟수(프레임/초당)
- command buffer 재사용 여부
- 매 dispatch마다 바뀌는 상태량(바인딩 churn)

### 감각 식

`총 PM4 트래픽 ~ dispatch 횟수 × (기본 패킷 묶음 + 상태변경 추가 패킷)`

## tiny dispatch 병목을 줄이는 기본 3개

1. **배치화**: 가능한 dispatch를 묶어서 submit 횟수 줄이기
2. **재사용**: command buffer/pipeline/layout 재생성 최소화
3. **상태 churn 축소**: 불필요한 descriptor/pipeline 변경 줄이기

## 체크리스트

- [ ] 내 워크로드는 dispatch를 몇 번/프레임 호출하는가?
- [ ] dispatch당 상태변경이 큰가(바인딩/동기화 과다)?
- [ ] 재사용 가능한 명령 기록을 매번 새로 만들고 있지 않은가?
- [ ] "커널 계산 시간"보다 "제출 오버헤드"가 더 큰 구간이 있는가?

---

## 관련 글

- [AMD PM4 Indirect Buffer 직관](https://jayinlab.github.io/pm4-indirect-buffer/)
- [OpenCL/Vulkan/PM4 Daily Facts 위키](/wiki/opencl-daily-facts/)

## 관련 용어

- [[pm4]], [[dispatch]], [[command-buffer]], [[driver-backend]], [[submit-overhead]], [[tiny-dispatch]]
