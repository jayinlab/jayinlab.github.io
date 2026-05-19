---
title: "OpenCL 드라이버의 fence sequence: event COMPLETE는 어디서 태어나나"
date: 2026-05-19
slug: "opencl-note-fence-sequence-event-completion"
draft: false
type: "note"
series: "opencl-driver-internals"
tags: ["opencl", "driver", "event", "fence", "umd", "kmd", "synchronization", "queue"]
difficulty: "advanced"
---

OpenCL 앱에서 event는 단순하다. 커맨드를 enqueue하면 event가 나오고, 나중에 그 event가 CL_COMPLETE가 된다.
하지만 드라이버 내부에서는 이 상태 전이가 꽤 조심스럽다. 특히 GPU가 실행한 command의 완료를 event 상태로 올리려면, 보통 **fence sequence**라는 숫자 축이 필요하다.

어제는 ring buffer와 doorbell을 통해 submit이 GPU 실행으로 넘어가는 경계를 봤다. 오늘은 그 다음 질문이다.

~~~text
doorbell을 울린 뒤,
드라이버는 어떤 근거로 "이 OpenCL event는 끝났다"고 말할 수 있을까?
~~~

## 왜 이 주제를 오늘 잡았나

최근 노트 흐름은 OpenCL event waitlist, memory visibility, VM bind/residency, ring/doorbell submit 경계로 내려왔다.
이제 빠진 부분은 완료 통지의 **귀속(attribution)** 이다.

GPU가 "어떤 지점까지 실행했다"는 사실을 알려줘도, UMD/KMD는 그 사실을 다시 OpenCL command/event 객체에 붙여야 한다.
이 연결이 약하면 다음 문제가 생긴다.

- clWaitForEvents가 너무 일찍 풀린다.
- clFinish(queue)가 해당 queue의 마지막 command를 정확히 기다리지 못한다.
- fault 로그에서 어떤 submit/event가 마지막으로 완료됐는지 모호하다.
- 여러 queue를 쓸 때 한 queue의 완료를 다른 queue의 완료처럼 오해한다.

즉 fence sequence는 단순 디버그 숫자가 아니라, API-level event 상태와 GPU execution timeline을 이어주는 spine이다.

## fence sequence는 완료 지점의 이름표다

단순화하면 submit마다 증가하는 번호를 붙일 수 있다.

~~~text
submit #41 -> fence seq 1001
submit #42 -> fence seq 1002
submit #43 -> fence seq 1003
~~~

GPU command stream 끝에는 보통 fence write 또는 event write 성격의 packet이 붙는다.
GPU가 그 packet까지 실행하면, 메모리의 fence slot이나 interrupt 경로를 통해 "1002까지 끝났다" 같은 정보가 KMD로 돌아온다.

중요한 점은 fence가 command 자체가 아니라 **command stream의 특정 위치를 대표하는 완료 표식**이라는 것이다.

~~~text
[state setup]
[dispatch A]
[needed cache action]
[fence write seq=1002]
~~~

이 순서라면 seq=1002가 관찰됐을 때 dispatch A와 그 앞의 필요한 action이 완료됐다고 해석할 수 있다.
반대로 fence packet이 너무 앞에 있거나, 필요한 visibility action보다 먼저 signal되면 event COMPLETE가 API 의미보다 먼저 올라갈 수 있다.

## OpenCL event와 fence는 1:1이 아닐 수 있다

초보적으로는 "event 하나 = fence 하나"라고 생각하기 쉽다.
하지만 실제 드라이버는 비용 때문에 더 유연하게 묶을 수 있다.

예를 들어 같은 in-order queue에 command 세 개가 들어왔다고 하자.

~~~text
E1: kernel A
E2: kernel B
E3: read buffer
~~~

드라이버는 내부적으로 아래처럼 처리할 수 있다.

~~~text
submit #10:
  dispatch A
  dispatch B
  copy/readback prep
  fence seq=501
~~~

이 경우 물리 fence는 하나지만, OpenCL event는 세 개다.
UMD는 seq=501이 완료됐다는 소식을 받은 뒤, 그 submit 안에 포함된 command node들을 순서대로 COMPLETE로 전이시킬 수 있다.

반대로 어떤 event는 GPU fence가 필요 없을 수도 있다.

- marker command
- already-complete dependency
- host-side user event
- enqueue 실패로 생성되지 않은 event

그래서 driver event state machine은 "event 객체가 있다"와 "GPU fence가 있다"를 분리해서 봐야 한다.

## interrupt는 완료 사실을 깨우는 경로다

GPU가 fence slot을 썼다고 host thread가 자동으로 깨어나는 것은 아니다.
보통은 interrupt, scheduler poll, wait queue wakeup 같은 경로가 붙는다.

흐름을 단순화하면 이렇다.

~~~text
GPU executes fence write
-> KMD observes completed fence seq
-> KMD wakes waiters or notifies UMD/runtime
-> UMD maps completed seq to command/event nodes
-> OpenCL event status becomes CL_COMPLETE
~~~

여기서 흔한 버그는 "fence memory는 갱신됐는데 waiter가 안 깨어남"과 "waiter는 깨어났는데 completed seq를 잘못 해석함"이다.
두 문제는 증상이 비슷하다. 앱에서는 clWaitForEvents가 멈추거나, 반대로 너무 빨리 풀리는 것처럼 보인다.

디버깅할 때는 최소한 아래 값을 함께 봐야 한다.

- submitted fence seq
- last completed fence seq
- interrupt count 또는 wakeup count
- queue id / engine id
- submit id
- event id와 command node id

completed seq만 로그에 찍으면 부족하다. 어떤 queue의 어떤 submit에서 나온 seq인지까지 있어야 OpenCL event에 정확히 귀속할 수 있다.

## queue마다 timeline을 분리해서 봐야 한다

OpenCL의 clFinish(queue)는 해당 command queue의 작업 완료를 기다린다.
따라서 fence sequence도 queue/engine timeline과 분리해서 해석해야 한다.

~~~text
queue Q0: submit #1 seq=10 -> submit #2 seq=11
queue Q1: submit #7 seq=80 -> submit #8 seq=81
~~~

Q1의 seq=81이 끝났다고 해서 Q0의 seq=11이 끝난 것은 아니다.
전역 증가 번호를 쓰더라도, 완료 판단은 "이 event가 어느 queue/engine submit에 속했는가"를 기준으로 해야 한다.

특히 out-of-order queue나 여러 hardware queue를 쓰는 구현에서는 이 점이 더 중요하다.
OpenCL event waitlist는 API dependency graph이고, fence sequence는 실제 GPU timeline의 완료 관찰값이다.
둘은 연결되어야 하지만 같은 자료구조는 아니다.

## user event는 GPU timeline 밖에 있다

OpenCL에는 clCreateUserEvent로 만든 user event도 있다.
이 event는 host가 clSetUserEventStatus로 상태를 바꾼다.
즉 GPU fence sequence에서 태어나지 않는다.

이 차이를 놓치면 waitlist lowering이 지저분해진다.

~~~text
GPU-backed event:
  GPU command retire -> fence seq complete -> event COMPLETE

user event:
  host status update -> dependent command submit allowed
~~~

user event가 waitlist에 있으면, 드라이버는 그 event가 COMPLETE되기 전까지 dependent GPU command를 submit하지 않거나, submit하더라도 실제 wait primitive와 연결해야 한다.
핵심은 "모든 event가 fence로 해결된다"가 아니라, event source별로 완료 신호가 다르다는 것이다.

## what this means for driver dev

- OpenCL event 상태 전이는 GPU fence sequence, host user event, marker command처럼 source별로 분리해야 한다.
- submit마다 submit id, queue id, engine id, fence seq, event range를 함께 기록해야 완료 귀속이 가능하다.
- fence packet은 dispatch와 필요한 cache/visibility action 뒤에 위치해야 한다. 그래야 CL_COMPLETE가 API 의미보다 먼저 올라가지 않는다.
- clFinish(queue) 구현은 "마지막으로 enqueue된 command의 event/fence를 기다린다"는 queue-scope 기준을 유지해야 한다.
- interrupt/wakeup 버그와 fence attribution 버그는 증상이 비슷하므로, completed seq와 waiter wakeup 로그를 분리해서 남겨야 한다.

## app-facing takeaway

앱 개발자는 fence sequence를 직접 보지 않는다.
그래도 이 모델을 알면 event 사용 비용을 더 잘 이해할 수 있다.

- event를 많이 만들수록 드라이버가 추적해야 할 command/event mapping이 늘어난다.
- 작은 command마다 clWaitForEvents를 걸면 fence 관찰과 wakeup 비용이 자주 드러난다.
- 독립 작업은 불필요하게 같은 waitlist로 묶지 않는 편이 드라이버가 batch와 fence를 효율적으로 구성하기 쉽다.

즉 event는 가벼운 문법처럼 보이지만, 내부적으로는 GPU timeline의 완료 지점을 OpenCL 객체로 번역하는 장치다.

---

## 관련 글

- [OpenCL 드라이버의 ring buffer와 doorbell: submit이 GPU 실행으로 바뀌는 경계]({{< relref "2026-05-18-opencl-note-ring-doorbell-submit-boundary.md" >}})
- [OpenCL Sync Semantics — event COMPLETE와 memory visibility를 같은 것으로 보면 왜 깨지나]({{< relref "2026-05-13-opencl-note-event-complete-vs-memory-visibility.md" >}})
- [OpenCL Event Waitlist Lowering — API 의존성을 실제 wait로 낮추는 기준]({{< relref "2026-05-16-opencl-note-event-waitlist-lowering.md" >}})

## 관련 용어

- [[command-queue]], [[pm4-packet]], [[ring-buffer]]

