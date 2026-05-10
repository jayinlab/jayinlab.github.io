---
title: "PM4 packet ordering과 cache visibility를 분리해서 보기"
date: 2026-05-10
slug: "pm4-ordering-vs-cache-visibility"
draft: false
type: "note"
series: "opencl-deep-dive"
tags: ["opencl", "pm4", "cache", "synchronization", "driver"]
difficulty: "advanced"
---

OpenCL 런타임을 구현하다 보면 `queue에 들어간 순서`와 `데이터가 실제로 보이는 시점`을 같은 것으로 취급하기 쉽다. 하지만 PM4 레벨에서는 이 둘이 다르다.

- **ordering**: 어떤 command가 먼저/나중에 실행되는가
- **visibility**: 먼저 실행된 write 결과가 뒤 command(혹은 다른 engine)에서 실제로 관측 가능한가

즉, packet이 순서대로 소비되더라도 cache 계층이 정리되지 않으면 다음 작업은 이전 write를 못 볼 수 있다.

## 왜 분리해야 하나

드라이버는 보통 다음 두 축을 따로 구성한다.

1. **execution ordering 축**
   - ring에 packet이 enqueue되고 fence/event packet으로 완료 지점을 만든다.
   - in-order queue에서는 기본적으로 제출 순서를 유지한다.

2. **memory visibility 축**
   - 필요한 범위의 cache flush/invalidate를 넣는다.
   - shader write 이후 compute/transfer/graphics가 읽는 경로에 맞춰 cache policy를 맞춘다.

여기서 핵심은: **fence/event는 완료 신호이지, 자동 cache 정합 보장이 아니다** 라는 점이다.

## 자주 생기는 오해

- "이 command가 먼저 끝났다고 event가 떴으니, 다음 kernel이 무조건 최신 데이터를 본다"
  - 반만 맞다. queue ordering은 맞지만, visibility를 위한 cache control packet/정책이 없으면 stale read 가능성이 남는다.

- "OpenCL barrier를 넣었으니 device 전체가 정리된다"
  - barrier의 semantic scope와 실제 하드웨어 cache 계층/engine 경계는 별도 매핑이 필요하다.

## 드라이버 구현 체크리스트 (실전)

- kernel A(write) → kernel B(read) 경로에서
  - 같은 queue, 같은 engine이라도 L1/L2 정책 확인
  - 필요한 최소 flush/invalidate packet 삽입
- SDMA/graphics/compute engine 교차 시
  - ownership 전환 지점에서 visibility 확보
- host readback 직전
  - device→host로 보이는 경계에서 cache 정합 + completion 동시 보장
- 과도한 global flush 남발 금지
  - correctness 먼저 확보 후, 범위를 줄여 성능 회복

## what this means for driver dev

동기화 버그를 줄이려면 로그를 "event timeline"만 보지 말고 **cache-action timeline**까지 같이 남겨야 한다.

- 어떤 API sync가 어떤 PM4 packet 세트(ordering/visibility)로 낮아졌는지
- flush/invalidate가 "왜 여기" 들어갔는지 근거
- 최소 scope로 줄였을 때 깨지는 테스트 케이스

정리하면, 안정적인 UMD/KMD contract는 `완료 신호 모델`과 `가시성 모델`을 분리해 설계할 때 만들어진다.

## app-facing takeaway

앱 개발자 입장에서는 "event가 끝났다 = 언제나 최신 데이터"라고 가정하면 위험하다. 벤더별 드라이버 최적화 차이에서 미묘한 버그가 날 수 있으므로, API 레벨 동기화 의도를 명확히 표현하고(적절한 barrier/event chain), queue 간 데이터 전달 지점을 코드로 드러내는 습관이 성능/이식성 모두에 유리하다.

---

## 관련 글

- [PM4 EVENT_WRITE vs cache flush: 완료 신호와 가시성은 다르다]({{< relref "2026-04-24-opencl-note-pm4-event-write-vs-cache-flush" >}})
- [clWaitForEvents vs clFinish: host wait semantics를 분해해서 보기]({{< relref "2026-05-02-opencl-note-clwaitforevents-vs-clfinish" >}})
- [UMD/KMD sync contract: 누가 무엇을 보장해야 하나]({{< relref "2026-05-09-opencl-note-umd-kmd-sync-contract" >}})

## 관련 용어

- [[pm4-packet]], [[command-queue]], [[barrier]], [[ring-buffer]]
