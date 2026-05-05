---
title: "OpenCL Wrong Note — In-Order Queue에서도 커널이 겹쳐 실행된다고 착각했던 이유"
date: 2026-05-05
slug: "opencl-wrong-note-in-order-queue-overlap"
draft: false
type: "wrong-note"
series: "opencl-deep-dive"
tags: ["opencl", "wrong-note", "command-queue", "profiling", "synchronization"]
difficulty: "beginner"
---

처음엔 in-order command queue에 kernel A, B를 연속 enqueue하면 드라이버가 알아서 일부를 겹쳐 실행할 수 있다고 생각했다.
하지만 기본 in-order queue에서는 **enqueue 순서가 실행 순서**가 된다.

핵심 정정:

- 같은 in-order queue에 들어간 커널은 앞선 커맨드가 완료되어야 다음 커맨드가 실행된다.
- host가 non-blocking enqueue를 했더라도, 그것은 host thread가 즉시 돌아온다는 뜻이지 GPU 실행 중첩을 뜻하지 않는다.
- 실행 중첩을 원하면 보통
  - out-of-order queue를 쓰거나,
  - 여러 queue로 분리하고 이벤트 의존을 최소화해야 한다.

짧은 체크 포인트:

1. Queue 속성(`CL_QUEUE_OUT_OF_ORDER_EXEC_MODE_ENABLE`)을 먼저 확인한다.
2. 프로파일 타임라인에서 kernel interval이 실제로 겹치는지 본다.
3. wait list를 과하게 연결해 병렬성을 스스로 잠그지 않았는지 점검한다.

이 오해를 풀고 나면, “enqueue를 많이 하면 빨라진다”가 아니라 “의존 그래프를 어떻게 짜야 겹칠 수 있는가”가 핵심이라는 걸 바로 체감하게 된다.

---

## 관련 글

- [OpenCL Wrong Note — event wait list를 걸면 GPU가 더 똑똑하게 병렬화해줄 거라고 믿었던 실수]({{< relref "2026-05-04-opencl-wrong-note-event-waitlist-parallelism" >}})
- [OpenCL Note — clWaitForEvents vs clFinish: host 동기화 지점의 비용 차이]({{< relref "2026-05-02-opencl-note-clwaitforevents-vs-clfinish" >}})

## 관련 용어

- [[command-queue]], [[barrier]], [[work-group]]
