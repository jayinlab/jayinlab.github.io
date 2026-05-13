---
title: "OpenCL Sync Semantics — event COMPLETE와 memory visibility를 같은 것으로 보면 왜 깨지나"
date: 2026-05-13
slug: "opencl-note-event-complete-vs-memory-visibility"
draft: false
type: "note"
series: "opencl-deep-dive"
tags: ["opencl", "synchronization", "memory-model", "event", "driver-dev"]
difficulty: "advanced"
---

OpenCL에서 event가 COMPLETE가 됐다는 사실과, 모든 메모리 관찰 지점에서 값이 즉시 일관되게 보인다는 사실은 같은 문장이 아니다.  
이 둘을 같은 것으로 취급하면 UMD/KMD 경계에서 cache flush/invalidate 정책이 과하거나(성능 손실), 부족해져서(희귀 데이터 오류) 디버깅 난도가 급격히 올라간다.

## 왜 이 주제를 오늘 잡았나

최근 노트들에서 queue/event dependency graph, PM4 ordering, UMD/KMD sync contract를 각각 분리해 정리했다.  
이제 남은 갭은 **"완료 신호(event)"와 "가시성(memory visibility)"를 드라이버에서 어떻게 분리해 설계할지**를 한 문장으로 묶는 것이다.

## 핵심 구분: completion vs visibility

드라이버 관점에서 최소한 아래 두 층을 분리해서 생각해야 한다.

1. **completion (진행 상태)**
   - 특정 command가 retire되어 event COMPLETE로 전이될 수 있는가?
2. **visibility (관찰 가능 상태)**
   - 그 command가 쓴 데이터가 다음 소비자(다른 queue, host map/read, 또는 다른 엔진)에서 올바르게 보이는가?

completion만 맞고 visibility가 틀리면, API는 "끝났다"고 말하는데 데이터는 옛값처럼 보이는 모순이 생긴다.

## 드라이버에서 흔히 생기는 두 가지 과오

### 1) 과도한 안전: COMPLETE마다 전역 flush

- 장점: 버그가 잘 안 보임
- 단점: queue throughput 급락, tail latency 증가

event COMPLETE마다 모든 cache domain에 강한 flush를 걸면 correctness는 쉬워지지만, 실제로 필요 없는 경로까지 stall을 유발한다.

### 2) 과소한 안전: 신호만 보내고 visibility 계약 누락

- 장점: microbenchmark는 빨라 보임
- 단점: 실앱에서 간헐적 stale read

특히 producer/consumer가 다른 queue 또는 다른 엔진 경로를 타는 경우, 도메인 맞춤형 invalidate/flush가 빠지면 재현 어려운 오류가 난다.

## implementation checklist (driver-dev)

- event COMPLETE 조건을 "retire + 필요한 visibility action 완료"로 명시했는가?
- waitlist 해소 로직과 cache action 로직이 한 함수에 뒤엉키지 않았는가?
- host-visible 경로(`clEnqueueReadBuffer`, map/unmap, `clFinish`)에서 필요한 domain만 정확히 정리하는가?
- PM4 packet ordering 보장과 cache visibility 보장을 서로 다른 축으로 로그/트레이스에서 구분 가능한가?

## what this means for driver dev

- event 상태머신은 **진행 상태 관리기**, cache 정책은 **가시성 계약 이행기**로 역할을 분리해야 한다.
- "COMPLETE를 언제 올릴지" 결정할 때, 단순 retire가 아니라 **소비자 관찰 시점**까지 계약을 포함해야 한다.
- 성능 최적화는 전역 flush 제거부터 시작하되, 제거한 자리에는 **정확한 scope/domain 기반 visibility 액션**이 반드시 들어가야 한다.

## app-facing takeaway

앱 개발자 입장에서는 "event 기다렸는데 왜 값이 이상하지?" 문제를 줄이려면,

- 불필요한 글로벌 동기화(`clFinish` 남발)를 피하고
- 실제 producer/consumer 경계에 맞춘 waitlist와 readback 지점을 설계해야 한다.

결국 앱의 동기화 구조가 명확할수록 드라이버도 좁은 범위의 visibility 보장으로 빠르게 동작할 수 있다.

---

## 관련 글

- [OpenCL Queue/Event Model — 선형 큐가 아니라 dependency graph로 읽기]({{< relref "2026-05-12-opencl-note-queue-event-dependency-graph.md" >}})
- [OpenCL note: PM4 ordering vs cache visibility]({{< relref "2026-05-10-opencl-note-pm4-ordering-vs-cache-visibility.md" >}})
- [OpenCL note: UMD/KMD sync contract]({{< relref "2026-05-09-opencl-note-umd-kmd-sync-contract.md" >}})

## 관련 용어

- [[barrier]], [[command-queue]], [[pm4-packet]]
