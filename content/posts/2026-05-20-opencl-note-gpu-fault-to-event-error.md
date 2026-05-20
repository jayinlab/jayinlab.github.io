---
title: "GPU fault는 OpenCL event와 error로 어떻게 올라오나"
date: 2026-05-20
slug: "opencl-note-gpu-fault-to-event-error"
draft: false
type: "note"
series: "opencl-driver-internals"
tags: ["opencl", "driver", "event", "fault", "umd", "kmd", "synchronization", "queue", "memory"]
difficulty: "advanced"
---

OpenCL 앱은 보통 커널 실행 실패를 세 가지 표면에서 만난다.

1. enqueue API가 즉시 에러를 반환한다.
2. event가 정상적으로 `CL_COMPLETE`가 되지 않는다.
3. 이후 API 호출에서 `CL_OUT_OF_RESOURCES`, `CL_OUT_OF_HOST_MEMORY`, `CL_EXEC_STATUS_ERROR_FOR_EVENTS_IN_WAIT_LIST` 같은 에러가 드러난다.

하지만 GPU fault는 이 표면보다 아래에서 생긴다. GPU가 잘못된 VA를 접근했거나, VM bind/residency가 깨졌거나, execution engine이 hang/reset 경로로 들어간 뒤 KMD가 그 사실을 관찰한다. 그 다음 UMD/runtime은 이 낮은 수준의 fault를 OpenCL command queue와 event 상태로 다시 번역해야 한다.

오늘은 그 번역 경로를 본다.

## 왜 이 주제를 오늘 잡았나

최근 노트는 세 축을 따로 잡았다.

- VM bind/residency는 "GPU가 주소를 접근할 수 있는가"를 다뤘다.
- ring buffer/doorbell은 "submit이 GPU 실행으로 넘어가는 경계"를 다뤘다.
- fence sequence는 "어떤 submit 지점까지 완료됐는가"를 OpenCL event로 올리는 방법을 다뤘다.

아직 남은 빈칸은 실패 경로다. 성공 경로에서는 fence가 event COMPLETE의 근거가 된다. 반대로 fault가 나면 드라이버는 "어느 command가 실패했는가", "그 뒤 command들은 어떻게 처리해야 하는가", "기다리던 event waitlist에는 어떤 에러를 돌려줘야 하는가"를 정해야 한다.

이 부분이 약하면 fault는 실제 원인보다 늦게, 다른 API 호출에서, 엉뚱한 queue의 문제처럼 보인다.

## fault는 완료 신호가 아니라 실행 중단 신호다

정상 완료 경로는 단순화하면 이렇다.

~~~text
submit #42
  dispatch A
  cache action
  fence write seq=1002

GPU reaches fence write
-> KMD observes completed seq=1002
-> UMD marks events in submit #42 as COMPLETE
~~~

fault 경로는 다르다.

~~~text
submit #42
  dispatch A
  memory access to bad/stale/unresident VA
  fence write seq=1002

GPU faults before fence write
-> KMD reports fault context
-> fence seq=1002 may never complete
-> UMD must fail affected event(s)
~~~

중요한 점은 fault가 난 command의 fence가 정상적으로 signal되지 않을 수 있다는 것이다. 따라서 "fence가 안 왔다"만 보고 무한 대기하면 OpenCL wait가 영원히 풀리지 않는다. KMD fault 보고는 fence 완료와 별도 wakeup 경로로 waiters를 깨워야 한다.

## KMD가 남겨야 하는 최소 fault context

GPU fault 로그가 `GPU fault at VA 0x...`만 있으면 OpenCL event로 번역하기 어렵다. 드라이버에는 최소한 다음 연결 정보가 필요하다.

- VMID 또는 address space id
- engine/queue id
- submit id 또는 scheduler job id
- submitted fence seq와 last completed fence seq
- faulting VA, access type, fault reason
- submit에 포함된 BO/resource list
- 가능하면 command buffer offset 또는 packet 위치

이 정보가 있어야 UMD가 "이 fault는 Q0의 submit #42에서 난 것이고, event E17 이후가 완료되지 않았다"처럼 판단할 수 있다.

반대로 이 연결이 없으면 앱에는 이런 식으로 보일 수 있다.

~~~text
clWaitForEvents(E17) hangs
or
clFinish(Q0) returns generic failure
or
next clEnqueue* call fails after device-lost-like state
~~~

문제는 실제 원인이 E17의 dispatch였는데, 에러가 다음 API에서 보이면 앱 개발자도 드라이버 개발자도 엉뚱한 지점을 의심하게 된다는 점이다.

## UMD는 fault를 event state machine에 붙여야 한다

OpenCL event는 성공만 표현하지 않는다. event의 command execution status는 음수 에러 상태가 될 수 있다. 그리고 어떤 command가 waitlist에 실패 event를 받으면, 그 command의 enqueue 또는 실행도 실패해야 한다.

단순한 state machine은 이렇게 볼 수 있다.

~~~text
QUEUED
  -> SUBMITTED
  -> RUNNING
  -> COMPLETE

또는

QUEUED/SUBMITTED/RUNNING
  -> ERROR(status < 0)
~~~

fault가 submit #42에 속한다고 판단되면 UMD/runtime은 보통 아래를 처리해야 한다.

1. faulting command event를 error 상태로 전이한다.
2. 같은 submit 안에서 fault 뒤에 있다고 볼 수 있는 command를 error/cancel 상태로 정리한다.
3. 그 event를 waitlist로 기다리던 dependent command에 실패를 전파한다.
4. queue/device가 계속 사용 가능한지, reset/device lost 수준인지 결정한다.
5. wait 중인 host thread를 깨운다.

여기서 핵심은 "실패 event도 terminal state"라는 점이다. 성공은 아니지만 더 기다릴 상태도 아니다. `clWaitForEvents`는 실패를 관찰하고 돌아와야지, 완료 fence가 안 왔다고 계속 잠들면 안 된다.

## waitlist 실패 전파는 그래프 문제다

OpenCL event waitlist는 dependency graph다.

~~~text
E1: kernel A
E2: kernel B waits on E1
E3: read buffer waits on E2
~~~

만약 E1이 GPU fault로 error 상태가 되면, E2와 E3는 정상 실행될 수 없다. 이때 runtime은 waitlist를 검사하는 시점에 실패를 감지하고 `CL_EXEC_STATUS_ERROR_FOR_EVENTS_IN_WAIT_LIST` 성격의 에러를 돌려줘야 한다.

driver-dev 관점에서 까다로운 부분은 실패가 항상 enqueue 시점에 알려지는 것이 아니라는 점이다.

~~~text
t0: E2 enqueue succeeds because E1 is not done yet
t1: E1 dispatch faults
t2: E1 becomes ERROR
t3: E2 must not run as if dependency succeeded
~~~

따라서 dependent command는 "wait 대상이 complete되었는가"만 보면 부족하다. wait 대상이 terminal success인지 terminal failure인지 구분해야 한다.

## fault 뒤 queue policy를 명확히 해야 한다

fault 하나가 항상 전체 device lost를 뜻하지는 않는다. 구현과 fault 종류에 따라 다르지만, 드라이버는 최소한 policy를 분리해야 한다.

### recoverable command failure

특정 command만 실패로 표시하고 queue를 계속 사용할 수 있는 경우다. 예를 들어 잘못된 주소 접근이 해당 process/context 안에서 격리되고, engine reset 후 다른 작업을 계속 받을 수 있다면 이 모델에 가깝다.

이 경우에도 해당 command의 event와 dependent commands는 실패로 정리해야 한다.

### queue-level failure

특정 queue timeline이 더 이상 신뢰할 수 없는 경우다. 마지막 완료 fence 이후에 걸린 command들을 실패로 처리하고, queue를 flush/reset하거나 더 이상 submit하지 않게 막아야 할 수 있다.

### device/context lost

GPU reset, context eviction failure, unrecoverable VM fault처럼 context 전체를 신뢰할 수 없는 경우다. 이때는 이후 API들이 generic resource/device failure로 이어질 수 있다.

정책이 모호하면 앱에서는 같은 버그가 어떤 날은 hang, 어떤 날은 enqueue failure, 어떤 날은 stale data처럼 보인다.

## 디버깅 로그는 성공 timeline과 실패 timeline을 같이 찍어야 한다

fault triage 로그는 fence 로그와 분리되어 있으면 안 된다. 적어도 같은 submit id로 묶여야 한다.

~~~text
queue=Q0 submit=42 engine=compute0
  submitted_seq=1002
  last_completed_seq=1001
  events=[E17 kernel A, E18 readback]
  resources=[BO7 VA 0x100000..0x180000, BO9 VA 0x200000..0x240000]
  fault_va=0x180100 reason=page_not_present access=read
  event_result=E17 ERROR, E18 ERROR
~~~

이 정도가 있으면 원인 좁히기가 훨씬 빨라진다.

- `fault_va`가 BO range 밖이면 descriptor/offset/lifetime 문제일 가능성이 크다.
- range 안인데 page가 없으면 VM bind/residency 문제를 본다.
- fault 없이 값만 틀리면 cache visibility 문제를 본다.
- completed seq가 faulting submit보다 앞에서 멈췄으면 wait wakeup과 error propagation을 본다.

## what this means for driver dev

- fault 보고 경로는 fence completion 경로와 별도로 waiters를 깨워야 한다. 그래야 `clWaitForEvents`와 `clFinish`가 hang으로 남지 않는다.
- event state machine은 COMPLETE뿐 아니라 terminal error 상태를 명확히 가져야 한다.
- submit id, queue id, fence seq, event range, resource list, fault context를 한 로그 단위로 묶어야 한다.
- waitlist lowering은 dependency event의 terminal success/failure를 구분해야 한다. "완료됐는가"보다 "성공으로 완료됐는가"가 중요하다.
- recoverable command failure, queue-level failure, context/device lost 정책을 나눠야 한다. 이 경계가 흐리면 앱 표면의 에러가 비결정적으로 보인다.

## app-facing takeaway

앱 개발자에게 GPU fault는 보통 직접적인 "fault packet"으로 보이지 않는다. 대신 event wait 실패, `clFinish` 실패, 이후 enqueue 실패, device reset 같은 형태로 늦게 보인다.

그래서 디버깅할 때는 다음을 분리해서 보는 편이 좋다.

- 특정 event wait에서만 실패하는가?
- 같은 buffer lifetime/offset에서 반복되는가?
- queue를 나눠도 같은 context 전체가 깨지는가?
- 작은 재현 케이스에서 faulting buffer와 command 순서를 줄일 수 있는가?

앱은 dependency와 resource lifetime을 명확히 표현해야 하고, 드라이버는 그 실패를 최대한 정확한 event/error로 되돌려줘야 한다.

---

## 관련 글

- [OpenCL 드라이버의 fence sequence: event COMPLETE는 어디서 태어나나]({{< relref "2026-05-19-opencl-note-fence-sequence-event-completion.md" >}})
- [OpenCL 드라이버의 VM bind와 residency: fault를 동기화 버그와 분리해서 보기]({{< relref "2026-05-17-opencl-note-vm-bind-residency-fault-triage.md" >}})
- [OpenCL Event Waitlist Lowering — API 의존성을 실제 wait로 낮추는 기준]({{< relref "2026-05-16-opencl-note-event-waitlist-lowering.md" >}})

## 관련 용어

- [[command-queue]], [[pm4-packet]], [[ring-buffer]], [[descriptor-set]]
