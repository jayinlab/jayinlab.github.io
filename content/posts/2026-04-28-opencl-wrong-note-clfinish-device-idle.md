---
title: "OpenCL Wrong Note: clFinish는 디바이스 전체 idle 보장이 아니다"
date: 2026-04-28
slug: "opencl-wrong-note-clfinish-device-idle"
draft: false
type: "wrong-note"
series: "opencl-deep-dive"
tags: ["opencl", "synchronization", "command-queue", "clfinish", "wrong-note"]
difficulty: "beginner"
---

`clFinish(queue)`를 오래 헷갈렸던 지점은 이거였다: **GPU 전체가 멈출 때까지 기다리는 함수**라고 생각한 것.

정확히는, `clFinish(queue)`는 **해당 queue에 enqueue된 커맨드가 끝날 때까지** host를 block한다.

즉 queue A에 `clFinish`를 걸어도, queue B의 작업은 계속 진행될 수 있다. 여러 queue를 쓰는 코드에서 완료 판단을 "디바이스 전체"로 뭉뚱그리면 타이밍 버그를 만들기 쉽다.

핵심 정리:

- `clFinish(queue)` = queue 단위 completion wait
- 디바이스 전역 idle 보장 아님
- 멀티-queue에서는 이벤트 체인(`clEnqueue*` + event wait)으로 의존성을 명시하는 습관이 안전함

---

## 관련 글

- [OpenCL wrong-note: barrier scope 오해 정정]({{< relref "2026-04-13-opencl-wrong-note-barrier-scope" >}})
- [OpenCL wrong-note: descriptor layout vs binding update 오해]({{< relref "2026-04-23-opencl-wrong-note-layout-vs-binding-update" >}})

## 관련 용어

- [[command-queue]], [[barrier]], [[work-group]]
