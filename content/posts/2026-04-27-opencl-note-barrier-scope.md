---
title: "OpenCL barrier는 왜 work-group 내부에서만 동작할까"
date: 2026-04-27
slug: "opencl-note-barrier-scope"
draft: false
type: "note"
series: "opencl-deep-dive"
tags: ["opencl", "synchronization", "work-group", "barrier", "performance"]
difficulty: "beginner"
---

질문 핵심: **barrier는 work-group 간 동기화가 아닌가?**
정답: **아니다. barrier는 같은 work-group 내부에서만 유효**하다.

{{< opencl_barrier_scope_anim >}}

## 왜 group 간 barrier가 없을까

- 서로 다른 work-group은 실행 순서/타이밍이 보장되지 않는다.
- 어떤 group은 아직 시작도 안 했고, 어떤 group은 이미 끝났을 수 있다.
- 그래서 커널 내부에서 전역 동기화 포인트를 만들면 데드락/비결정성 위험이 커진다.

즉 OpenCL은 커널 내부 barrier 범위를 **group 내부**로 제한한다.

## API 연결: `barrier()` vs `clFinish()` vs 이벤트 wait

헷갈리기 쉬운 포인트를 API 기준으로 분리하면:

- `barrier()`
  - 커널 코드 내부에서 사용
  - 같은 work-group 내부 work-item 동기화

- `clFinish(queue)`
  - 호스트 API
  - **해당 queue에 이미 들어간 작업이 전부 끝날 때까지 CPU가 기다림**
  - 즉 "group 간 barrier"가 아니라 "커널 경계에서 전체 완료를 기다리는 방식"

- event wait (`clWaitForEvents`, enqueue wait list)
  - `clFinish`보다 더 정밀하게 특정 작업 의존성만 걸 수 있음
  - 실무에서는 전체 stall을 줄이기 위해 event 기반 동기화를 선호하는 경우가 많다

## 그럼 group 간 동기화는 어떻게 하나

1. 커널 A 실행
2. 이벤트/큐 완료 대기 (`clWaitForEvents` 또는 필요 시 `clFinish`)
3. 커널 B 실행

즉 **커널 경계 + 이벤트 의존성**으로 단계 동기화를 만든다.

## 기억 문장

- `barrier()` = work-group 내부 동기화
- group 간 동기화 = 커널 경계 + 이벤트/큐 동기화

---

## 관련 글

- [OpenCL GWS/LWS가 Vulkan Dispatch로 내려갈 때]({{< relref "2026-04-21-opencl-note-gws-lws-to-vulkan-dispatch.md" >}})
- [Tiny Dispatch에서 진짜 병목: GPU 연산보다 Submit 경로]({{< relref "2026-04-20-opencl-note-small-dispatch-submit-overhead.md" >}})

## 관련 용어

- [[barrier]], [[work-group]], [[work-item]], [[command-queue]]
