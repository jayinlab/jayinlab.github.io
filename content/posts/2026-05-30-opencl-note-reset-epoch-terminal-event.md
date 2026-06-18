---
title: "GPU reset 뒤 timeline을 그대로 믿으면 안 되는 이유"
date: 2026-05-30
slug: "opencl-reset-epoch-terminal-event"
draft: false
type: "note"
series: "opencl-driver-internals"
tags: ["opencl", "vulkan", "driver-dev", "kmd", "reset", "event", "timeline-semaphore", "fence", "pm4", "debugging"]
difficulty: "advanced"
layer: "CL"
---

GPU fault나 hang 뒤에 engine reset이 일어나면 driver는 단순히 queue를 다시 실행 가능하게 만드는 것만으로는 부족하다. reset 전에 제출된 작업의 성공 여부를 앱이 잘못 해석하지 않도록 정리해야 한다.

특히 아래 질문이 중요하다.

> reset 전에 기다리던 fence나 timeline semaphore payload를 reset 뒤에도 정상 completion 근거로 믿을 수 있는가?

대답은 보통 "그 숫자만으로는 부족하다"다. timeline payload나 fence sequence는 command-stream progress를 표현하지만, reset으로 실행 문맥이 끊기면 이전 epoch의 submit이 실제로 성공했는지를 별도로 판단해야 한다.

~~~text
OpenCL event E42
  -> Vulkan submit S81 waits/signals timeline payload=120
  -> UMD builds IB and fence metadata
  -> KMD schedules job J900
  -> GPU hangs before completion
  -> KMD resets engine/context
  -> E42 must become terminal error, not silent success
~~~

오늘은 이 실패 경로를 `epoch` 관점에서 본다. 여기서 epoch는 reset 전후의 실행 문맥을 구분하기 위한 논리적 세대 번호다. 실제 driver의 필드 이름은 다를 수 있지만, 디버깅 모델로 유용하다.

## 정상 경로: payload 증가는 성공 근거가 될 수 있다

정상 실행에서는 submit과 completion을 같은 queue timeline 위에 놓을 수 있다.

~~~text
queue=Q0 epoch=7

submit=S80 signal_payload=119 event=E41
submit=S81 signal_payload=120 event=E42

GPU executes S80 -> payload 119 observed -> E41 COMPLETE
GPU executes S81 -> payload 120 observed -> E42 COMPLETE
~~~

OpenCL runtime은 `E42`를 기다리는 host thread를 깨우고 event를 `CL_COMPLETE`로 전이할 수 있다. Vulkan timeline semaphore payload, KMD fence sequence, PM4 fence write 위치가 서로 연결되어 있다면 어느 submit까지 끝났는지도 추적할 수 있다.

문제는 reset이 끼어드는 경우다.

## reset 경로: 같은 숫자라도 의미가 끊긴다

아래처럼 `S81`의 dispatch가 hang을 만들었다고 가정하자.

~~~text
queue=Q0 epoch=7

S80: DISPATCH -> RELEASE_MEM fence=119
S81: DISPATCH -> hang before RELEASE_MEM fence=120
S82: queued, not executed

KMD watchdog timeout
  -> capture fault/checkpoint
  -> reset engine or context
  -> start epoch=8
~~~

이때 `S81`의 fence write는 실행되지 않았을 수 있다. 그런데 reset 복구 코드가 queue를 다시 초기화하면서 내부 timeline 값을 강제로 진행시키거나 pending wait를 일괄 해제하면, 상위 계층은 이를 정상 completion으로 오해할 수 있다.

~~~text
bad recovery:
  wake all fence waiters
  timeline_payload := 120
  UMD sees payload >= 120
  E42 -> CL_COMPLETE   # wrong
~~~

waiter를 깨우는 것 자체는 필요하다. 하지만 wakeup과 success는 같은 뜻이 아니다. reset 경로에서는 wait 결과에 "정상 signal"인지 "reset/error wakeup"인지가 함께 전달되어야 한다.

~~~text
better recovery:
  invalidate epoch=7 pending submissions
  wake all affected fence waiters with reset status
  S81 -> ERROR(reset)
  S82 -> ERROR(cancelled_by_reset)
  E42 -> terminal error
~~~

## timeline semaphore payload와 cache visibility도 분리해야 한다

timeline semaphore payload가 기대값에 도달했다는 사실은 dependency progress를 표현한다. 하지만 그 자체가 cache visibility를 모두 증명하지는 않는다.

정상 경로에서도 producer의 write가 consumer에게 보이려면 올바른 release/acquire와 flush/invalidate가 필요하다.

~~~text
producer dispatch
  -> release/cache action
  -> signal timeline payload=120

consumer wait payload>=120
  -> acquire/invalidate as required
  -> consumer dispatch
~~~

reset 경로에서는 한 단계가 더 필요하다. payload가 어떤 epoch에서 어떤 이유로 관찰됐는지 확인해야 한다.

~~~text
observed payload=120
  + epoch=7 completed normally?       yes/no
  + signal source was GPU fence write? yes/no
  + reset status attached?             yes/no
  + required cache action executed?    yes/no
~~~

즉 `payload >= expected`만 검사하는 fast path는 reset 경계에서 충분하지 않을 수 있다. 정상 실행에서는 빠른 비교가 유효하지만, reset generation이 바뀌었다면 slow path로 내려가 submit 결과와 error state를 다시 확인해야 한다.

## OpenCL event graph에 실패를 올리기

OpenCL event wait-list는 dependency graph다. `E42`를 기다리는 후속 command가 있다면 reset 실패도 graph를 따라 전파되어야 한다.

~~~text
E42: kernel A on Q0
E43: kernel B waits on E42
E44: readback waits on E43
~~~

`E42`가 reset 때문에 terminal error가 되었다면 `E43`, `E44`를 정상 dispatch하면 안 된다.

~~~text
epoch 7 invalidated
  -> E42 ERROR(reset)
  -> E43 ERROR(dependency_failed)
  -> E44 ERROR(dependency_failed)
  -> host waiter wakes
~~~

여기서 terminal error는 "아직 완료되지 않음"과 다르다. 더 기다릴 상태가 아니므로 `clWaitForEvents`나 `clFinish`가 무한정 잠들지 않아야 한다. 후속 enqueue나 wait-list 검사는 dependency가 terminal success인지 terminal failure인지 구분해야 한다.

## trace walkthrough: watchdog timeout부터 event error까지

하나의 reset을 trace로 이어 보자.

~~~text
t0 UMD submit
  queue=Q0 submit=S81 job=J900 epoch=7
  vk_timeline_signal=120 opencl_events=[E42]
  ib=IB77 checkpoint_before_dispatch=330

t1 PM4 execution
  IB77 packet=330 CHECKPOINT
  IB77 packet=341 DISPATCH_DIRECT
  # expected RELEASE_MEM fence=120 at packet=355 is not reached

t2 KMD watchdog
  engine=compute0 job=J900 epoch=7 timeout=true
  last_checkpoint=330 last_completed_fence=119 expected_fence=120

t3 KMD reset
  reset_scope=context epoch_old=7 epoch_new=8
  invalidated_jobs=[J900]
  cancelled_jobs=[J901,J902]
  wake_waiters status=reset

t4 UMD/runtime propagation
  S81 result=ERROR(reset)
  E42 status=ERROR
  dependent_events=[E43,E44] result=ERROR(dependency_failed)
~~~

이 trace가 있으면 다음을 분리해서 볼 수 있다.

- `last_checkpoint=330`이면 적어도 dispatch 직전까지 command stream이 진행했다.
- `expected_fence=120`이 관찰되지 않았으므로 `S81`을 정상 완료로 볼 수 없다.
- `epoch_old=7`이 무효화되었으므로 이전 epoch의 pending submit은 다시 판정해야 한다.
- waiter wakeup은 hang 방지 수단이지 성공 판정이 아니다.
- reset 뒤 context를 재사용할 수 있는지는 별도 policy다.

## 어느 범위까지 실패시킬 것인가

reset 범위에 따라 실패 전파 범위도 달라진다.

| reset 범위 | 먼저 실패시킬 대상 | 이후 정책 |
|---|---|---|
| job-level cancel 가능 | faulting job과 dependent events | queue 재사용 가능 여부 확인 |
| queue/context reset | 해당 epoch의 pending jobs와 dependent events | 새 epoch로 재초기화 |
| device-wide reset | 여러 queue/context의 pending work | device-lost 성격의 정책 필요 |

무조건 모든 작업을 성공 처리하는 것도 틀리고, 항상 device 전체를 영구 실패시키는 것도 과할 수 있다. 중요한 것은 reset 범위, 무효화된 submit 범위, event error 범위를 같은 metadata로 연결하는 것이다.

## what this means for driver dev

- fence/timeline waiter를 깨우는 경로와 command 성공 판정 경로를 분리해야 한다. reset wakeup은 정상 signal이 아니다.
- queue 또는 context에 reset generation/epoch를 두고, generation이 바뀌면 payload fast path만으로 completion을 판정하지 않는 편이 안전하다.
- trace에는 submit id, job id, epoch, expected fence/payload, last completed fence, last checkpoint, reset scope, affected OpenCL event를 함께 남겨야 한다.
- PM4 fence write 전에 hang이 났다면 상위 event를 `CL_COMPLETE`로 만들면 안 된다. terminal error로 전이하고 host waiter를 깨워야 한다.
- timeline semaphore payload progress, cache visibility, descriptor correctness, VA validity는 서로 다른 증거다. reset 분석에서도 한 축으로 뭉개지 말아야 한다.
- reset 뒤 queue/context 재사용 가능 여부를 명시적인 policy로 가져야 한다. 재사용한다면 새 epoch에서만 새 submit을 받는 편이 추적하기 쉽다.

## app-facing takeaway

앱 개발자는 보통 reset epoch나 PM4 checkpoint를 직접 보지 않는다. 대신 `clWaitForEvents` 실패, `clFinish` 실패, 이후 enqueue 실패처럼 관찰한다.

- 비동기 queue를 많이 쓸수록 event wait-list를 명확히 유지해야 어느 작업의 실패가 어디까지 번졌는지 좁힐 수 있다.
- hang 재현을 줄일 때는 kernel뿐 아니라 queue 수, buffer lifetime, dependency edge도 같이 줄이는 편이 좋다.
- reset 뒤 결과 buffer를 그대로 신뢰하지 말아야 한다. event가 정상 성공인지 확인한 뒤 소비해야 한다.

성능 최적화 관점에서도 tiny dispatch를 과도하게 쪼개면 submit과 sync bookkeeping이 늘어난다. 먼저 batching으로 overhead를 줄일 수 있는지 측정하고, dependency graph는 정확하게 유지해야 한다.

---

## 관련 글

- [GPU fault는 OpenCL event와 error로 어떻게 올라오나]({{< relref "2026-05-20-opencl-note-gpu-fault-to-event-error.md" >}})
- [dispatch 전에 page table과 residency 순서를 고정하기]({{< relref "2026-05-29-opencl-note-page-table-residency-ordering.md" >}})
- [OpenCL 드라이버의 fence sequence: event COMPLETE는 어디서 태어나나]({{< relref "2026-05-19-opencl-note-fence-sequence-event-completion.md" >}})

## 관련 용어

- [[command-queue]], [[pm4-packet]], [[ring-buffer]], [[descriptor-set]]
