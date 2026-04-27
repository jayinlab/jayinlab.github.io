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

## 그럼 group 간 동기화는 어떻게 하나

1. 커널 A 실행
2. 이벤트/큐 완료 대기 (`clFinish` 또는 event wait)
3. 커널 B 실행

이렇게 **커널 경계**로 단계 분리해서 동기화한다.

## 기억 문장

- `barrier()` = work-group 내부 동기화
- group 간 동기화 = 커널 경계 + 이벤트/큐 동기화

---

## 관련 글

- [OpenCL GWS/LWS가 Vulkan Dispatch로 내려갈 때]({{< relref "2026-04-21-opencl-note-gws-lws-to-vulkan-dispatch.md" >}})
- [Tiny Dispatch에서 진짜 병목: GPU 연산보다 Submit 경로]({{< relref "2026-04-20-opencl-note-small-dispatch-submit-overhead.md" >}})

## 관련 용어

- [[barrier]], [[work-group]], [[work-item]], [[command-queue]]
