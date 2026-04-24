---
title: "PM4 EVENT_WRITE는 신호탄이고, 가시성은 FLUSH/INVALIDATE가 만든다"
date: 2026-04-24
slug: "opencl-note-pm4-event-write-vs-cache-flush"
draft: false
type: "note"
series: "opencl-deep-dive"
tags: ["opencl", "vulkan", "pm4", "barrier", "event-write", "daily-facts"]
difficulty: "intermediate"
---

OpenCL/Vulkan 동기화를 PM4 레벨에서 볼 때 자주 생기는 오해가 있다.
`EVENT_WRITE`만 넣으면 앞선 write가 자동으로 "다 보일 것"이라고 생각하는 것이다.

핵심은 단순하다.
**EVENT_WRITE는 신호(signal)이고, 메모리 가시성(visibility)은 cache flush/invalidate 패킷이 만든다.**

---

## 왜 헷갈리나?

상위 API에서는 fence/semaphore/wait를 한 묶음으로 보게 된다.
그래서 "이벤트를 쐈다 = 데이터도 다 정리됐다"처럼 느껴진다.

하지만 PM4 관점에서는 역할이 분리된다.

- 이벤트/인터럽트: "이 시점이 지났다"를 알리는 제어 신호
- 캐시 제어: write-back, invalidate, ordering을 맞춰 실제 관찰 가능 상태를 만듦

둘을 같이 써야 의미가 완성된다.

---

## 최소 모델 (개념 순서)

1. 앞선 compute/transfer가 메모리에 write 수행
2. 필요한 cache flush/invalidate 패킷으로 가시성 정리
3. `EVENT_WRITE`로 완료 지점 신호
4. 이후 queue/엔진에서 wait 또는 후속 작업 진행

즉, **이벤트는 타이밍 기준점**이고,
**flush/invalidate는 데이터 상태 정합성**이다.

---

## 실수 패턴

- "wait만 했는데 값이 가끔 이전 값처럼 보임"
  - 원인: 이벤트 순서는 맞았지만 cache 가시성 제어가 부족
- "barrier를 넣었는데 왜 또 느려졌지?"
  - 원인: stage/access 범위를 과하게 넓혀 불필요한 flush까지 유발

상위 API barrier를 해석할 때도 결국 하위에서는
"어떤 캐시를 언제 비우고/무효화할지"로 내려간다고 보면 이해가 빠르다.

---

## 기억용 한 줄

**EVENT_WRITE는 "끝났다"를 알리고, FLUSH/INVALIDATE는 "보이게" 만든다.**

---

## 관련 글

- [clFinish의 내부 구현 — Fence & Semaphore 관점](/clfinish-internals/)
- [vkCmdPipelineBarrier 깊이 파기](/vulkan-pipeline-barrier/)
- [PM4 제출 흐름 — Vulkan Submit부터 GPU 실행까지](/pm4-submit-flow-animation/)

## 관련 용어

[[pm4-packet]], [[barrier]], [[command-queue]]
