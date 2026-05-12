---
title: "OpenCL Queue/Event Model — 선형 큐가 아니라 dependency graph로 읽기"
date: 2026-05-12
slug: "opencl-note-queue-event-dependency-graph"
draft: false
type: "note"
series: "opencl-deep-dive"
tags: ["opencl", "queue", "event", "synchronization", "driver-dev", "optimization"]
difficulty: "intermediate"
---

OpenCL command queue를 in-order / out-of-order 두 단어로만 외우면, 실제 드라이버 구현에서 자주 틀린다.  
핵심은 **queue는 제출 통로**, 실행 순서는 결국 **event waitlist가 만든 dependency graph**로 결정된다는 점이다.

## 왜 이걸 다시 보나

최근까지 `in-order queue = 앞 커맨드가 끝나야 뒤 커맨드가 시작`으로 단순화해서 생각했는데, 실제로는 다음이 섞인다.

- queue 자체 순서 제약
- 각 command의 waitlist 제약
- runtime이 삽입하는 marker/barrier 제약
- host API (`clFlush`, `clFinish`, `clWaitForEvents`)가 만드는 관찰 시점

이걸 분리하지 않으면 UMD에서 불필요한 전역 stall을 넣거나, 반대로 completion 전파를 너무 늦게 해서 host-visible latency를 키우기 쉽다.

## mental model: "줄"이 아니라 "그래프"

command A, B, C가 같은 queue에 enqueue되더라도, 드라이버가 내부적으로 보는 것은 아래와 가깝다.

- 노드: command
- 엣지: "이 command는 저 event가 complete되어야 실행 가능"
- ready 조건: 모든 선행 엣지가 해소됨

in-order queue는 기본적으로 `A -> B -> C` 엣지를 자동으로 추가하는 모드이고, out-of-order는 이 자동 엣지가 약해진다고 보는 편이 구현 감각에 맞다.

## driver 구현에서 자주 갈리는 지점

1. **signal 시점 정의**  
   event COMPLETE를 "packet submit 완료"로 볼지 "GPU retire 완료"로 볼지 흐려지면 즉시 버그가 난다. host 계약상 completion은 후자 기준이어야 안전하다.

2. **waitlist flattening**  
   여러 event를 기다리는 command를 만났을 때, UMD가 즉시 block하지 말고 dependency로 기록해 ready 큐에서만 제외해야 parallelism을 살릴 수 있다.

3. **callback/host wakeup 경로**  
   event 완료 통지를 어느 스레드에서, 어떤 락 순서로 올릴지 정해두지 않으면 tail latency가 튄다.

## app-facing takeaway

앱 개발자 관점에서도 이 모델은 바로 성능으로 연결된다.

- 커맨드마다 무조건 `clFinish`를 넣으면 그래프가 매번 끊겨 파이프라이닝이 사라진다.
- 독립 작업은 event waitlist로 최소 제약만 걸어야 런타임이 겹쳐 실행할 여지가 생긴다.

## what this means for driver dev

- queue/event 처리 코드를 "FIFO 소비기"로 보지 말고 "dependency scheduler"로 설계해야 한다.
- event 상태 전이는 submit/retire/host-notify 세 단계를 분리 계측해야 디버깅이 된다.
- 최적화 우선순위는 보통 **(1) 과도한 전역 wait 제거 → (2) completion 전파 지연 축소 → (3) lock contention 완화** 순서가 ROI가 크다.

---

## 관련 글

- [OpenCL wrong-note: in-order queue에서도 overlap 가능]({{< relref "2026-05-05-opencl-wrong-note-in-order-queue-overlap.md" >}})
- [OpenCL note: clWaitForEvents vs clFinish]({{< relref "2026-05-02-opencl-note-clwaitforevents-vs-clfinish.md" >}})
- [OpenCL note: UMD/KMD sync contract]({{< relref "2026-05-09-opencl-note-umd-kmd-sync-contract.md" >}})

## 관련 용어

- [[command-queue]], [[barrier]], [[pm4-packet]]
