---
title: "OpenCL Event Waitlist Lowering — API 의존성을 실제 wait로 낮추는 기준"
date: 2026-05-16
slug: "opencl-note-event-waitlist-lowering"
draft: false
type: "note"
series: "opencl-driver-internals"
tags: ["opencl", "event", "queue", "synchronization", "pm4", "driver-dev", "optimization"]
difficulty: "advanced"
---

OpenCL의 event waitlist는 API 표면에서는 단순한 배열처럼 보인다.  
하지만 드라이버 입장에서는 이 배열을 **host thread를 멈추는 조건**으로 볼지, **GPU command stream 안의 dependency**로 낮출지 결정해야 한다.

이 차이를 놓치면 correctness는 맞아도 parallelism이 사라지거나, 반대로 event COMPLETE만 보고 너무 빨리 실행해서 visibility bug가 생긴다.

## 왜 이 주제를 오늘 잡았나

최근 노트에서 queue/event graph, UMD/KMD sync contract, PM4 ordering/cache visibility를 각각 정리했다.  
다음 빈칸은 그 사이의 변환 단계다.

즉,

```text
OpenCL event waitlist
-> UMD dependency graph
-> KMD/engine sync primitive
-> PM4 wait / event / cache action
```

이 흐름을 잡아야 “event를 기다린다”는 문장이 실제 드라이버 코드에서 어디까지 내려가는지 보인다.

## waitlist는 blocking API가 아니다

`clEnqueueNDRangeKernel(..., waitlist=...)` 같은 호출을 받았다고 해서 UMD가 항상 CPU에서 기다려야 하는 것은 아니다.

더 좋은 기본 모델은 다음과 같다.

1. command node를 만든다.
2. waitlist event들을 dependency edge로 붙인다.
3. 아직 ready가 아니면 내부 ready queue에 올리지 않는다.
4. 선행 event가 complete되면 command를 submit 가능한 상태로 전환한다.

이렇게 하면 host thread는 다음 enqueue를 계속 진행할 수 있고, 독립 command들은 겹쳐 실행될 수 있다.

반대로 enqueue 시점마다 host wait를 걸면 out-of-order queue의 장점뿐 아니라 in-order queue 안의 pipelining 여지도 같이 줄어든다.

## 어디까지 GPU-side wait로 낮출 수 있나

모든 waitlist가 같은 방식으로 내려가지는 않는다.

### 같은 queue 안의 dependency

in-order queue라면 기본 순서 edge가 이미 있다.  
추가 waitlist가 같은 queue의 앞선 command만 가리키면 별도 GPU wait packet 없이 내부 ordering으로 충분할 수 있다.

out-of-order queue에서는 edge를 명시적으로 유지해야 한다.  
다만 같은 engine, 같은 submit batch 안에서 정렬 가능한 경우라면 submit 순서를 조정하는 것만으로도 충분할 수 있다.

### queue 간 dependency

서로 다른 queue 사이에서는 dependency를 실제 sync primitive로 연결해야 한다.

- producer queue가 fence/event 값을 signal
- consumer queue가 그 값을 wait
- 필요한 경우 wait 전후에 cache visibility action 삽입

PM4 관점에서는 단순히 “나중에 packet을 넣었다”가 아니라, consumer engine이 producer의 완료 지점을 관찰할 수 있어야 한다.

### host-visible dependency

`clWaitForEvents`, blocking read/map, `clFinish`처럼 host가 관찰자가 되는 경우에는 GPU-side wait만으로 끝나지 않는다.

- GPU completion을 fence/interrupt/polling으로 host에 전달
- host-visible memory가 최신 값을 보도록 cache/coherency 규칙 적용
- event callback과 상태 전이를 deadlock 없이 실행

즉 host wait 경로는 scheduling 문제와 memory visibility 문제가 같이 붙는다.

## lowering 체크리스트

드라이버에서 waitlist lowering을 볼 때는 아래 질문을 순서대로 던진다.

1. 이 dependency는 같은 queue의 순서만으로 보장되는가?
2. 다른 queue/engine이면 어떤 fence/semaphore/syncobj로 연결되는가?
3. COMPLETE signal 전에 필요한 cache flush/invalidate가 끝나는가?
4. host wait 경로라면 CPU가 보는 memory domain까지 정리되는가?
5. waitlist flattening 때문에 독립 command까지 같이 막고 있지는 않은가?

이 체크가 빠지면 “event wait는 했는데 값이 이상하다” 또는 “불필요하게 느리다”라는 두 종류의 버그가 번갈아 나온다.

## what this means for driver dev

- waitlist 처리는 enqueue thread의 blocking 로직이 아니라 **dependency lowering 로직**으로 설계해야 한다.
- event COMPLETE 전이는 “GPU retire”와 “필요 visibility action 완료”를 분리해서 계측해야 한다.
- queue 간 wait는 fence 값만 맞추는 것으로 끝내지 말고, producer/consumer의 cache domain까지 함께 기록해야 한다.
- 최적화는 host wait 제거부터 시작하되, 제거한 자리에는 GPU-side wait 또는 submit ordering 근거가 남아 있어야 한다.

## app-facing takeaway

앱 개발자는 waitlist를 “정확한 최소 의존성 표현”으로 쓰는 편이 좋다.

- 관련 없는 작업까지 같은 event에 묶으면 드라이버가 병렬 실행할 공간이 줄어든다.
- 반대로 실제 데이터 의존성을 빼먹으면 드라이버가 안전하게 visibility를 보장할 기준이 사라진다.

좋은 waitlist는 앱 코드에서는 의도를 분명하게 만들고, 드라이버에서는 좁은 범위의 wait/cache action으로 낮출 수 있게 해준다.

---

## 관련 글

- [OpenCL Queue/Event Model — 선형 큐가 아니라 dependency graph로 읽기]({{< relref "2026-05-12-opencl-note-queue-event-dependency-graph.md" >}})
- [OpenCL Sync Semantics — event COMPLETE와 memory visibility를 같은 것으로 보면 왜 깨지나]({{< relref "2026-05-13-opencl-note-event-complete-vs-memory-visibility.md" >}})
- [PM4 packet ordering과 cache visibility를 분리해서 보기]({{< relref "2026-05-10-opencl-note-pm4-ordering-vs-cache-visibility.md" >}})
- [OpenCL 드라이버에서 UMD/KMD 동기화 계약]({{< relref "2026-05-09-opencl-note-umd-kmd-sync-contract.md" >}})

## 관련 용어

- [[command-queue]], [[barrier]], [[pm4-packet]], [[ring-buffer]]
