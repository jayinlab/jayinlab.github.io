---
title: "OpenCL Wrong Note: event wait list를 많이 걸면 더 안전하고 빠르다?"
date: 2026-05-04
slug: "opencl-wrong-note-event-waitlist-parallelism"
draft: false
type: "wrong-note"
series: "opencl-deep-dive"
tags: ["opencl", "synchronization", "event", "command-queue", "wrong-note"]
difficulty: "intermediate"
---

한동안 `clEnqueueNDRangeKernel(..., wait_list=...)`를 넉넉하게 걸수록 “안전하고 효율적”이라고 생각했다.

실제로는 반대가 되기 쉽다. event wait list는 **GPU가 알아서 최적 순서를 찾는 힌트**가 아니라, host가 만든 **명시적 실행 의존성**이다.

즉 필요 없는 이벤트까지 wait list에 넣으면, 원래 병렬로 돌 수 있던 커널까지 직렬화될 수 있다.

핵심 정리:

- event wait list = 실행 순서 제약을 추가하는 장치
- “안전빵”으로 과하게 묶으면 병렬성이 줄어듦
- 의존성은 데이터/리소스 충돌이 있는 지점에만 최소로 선언하는 편이 좋음

실무 체크 포인트:

1. 정말 같은 버퍼/이미지 영역을 읽고 쓰는가?
2. queue가 in-order인지 out-of-order인지 구분했는가?
3. host 편의 때문에 불필요한 전역 이벤트를 재사용하고 있지 않은가?

의존성을 정확히 좁히면, correctness를 유지하면서도 queue overlap과 디바이스 활용률을 더 쉽게 확보할 수 있다.

---

## 관련 글

- [OpenCL Wrong Note: clFinish는 디바이스 전체 idle 보장이 아니다]({{< relref "2026-04-28-opencl-wrong-note-clfinish-device-idle" >}})
- [OpenCL wrong-note: barrier scope 오해 정정]({{< relref "2026-04-13-opencl-wrong-note-barrier-scope" >}})

## 관련 용어

- [[command-queue]], [[barrier]], [[work-group]]
