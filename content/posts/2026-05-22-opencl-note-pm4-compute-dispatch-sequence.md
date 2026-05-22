---
title: "PM4 compute dispatch sequence: state setup은 왜 DISPATCH보다 먼저 와야 하나"
date: 2026-05-22
slug: "opencl-note-pm4-compute-dispatch-sequence"
draft: false
type: "note"
series: "opencl-driver-internals"
tags: ["opencl", "driver", "pm4", "dispatch", "synchronization", "cache", "isa"]
difficulty: "advanced"
---

어제 노트에서는 kernel dispatch ABI를 봤다. 컴파일러가 만든 ISA와 metadata가 있고, 드라이버는 그 계약을 PM4 dispatch state로 채워야 한다는 이야기였다.

오늘은 그 다음 질문이다.

**그 state는 command stream 안에서 어떤 순서로 놓여야 안전한가?**

OpenCL의 `clEnqueueNDRangeKernel` 하나는 아래처럼 단순한 한 줄 명령이 아니다.

```text
prepare resource/descriptor/kernarg
-> write compute state packets
-> write dispatch packet
-> write visibility/completion packets if needed
-> submit ring and doorbell
```

이 순서가 깨지면 GPU는 정상적인 `DISPATCH` packet을 읽고도 오래된 state, 잘못된 descriptor, 아직 보이지 않는 cache line을 기준으로 실행할 수 있다.

## 왜 이 주제를 오늘 잡았나

최근 driver-dev 노트는 submit 경계와 완료 경계를 많이 다뤘다.

- ring buffer와 doorbell은 command stream이 GPU 실행으로 넘어가는 경계를 설명했다.
- fence sequence는 GPU 완료가 OpenCL event COMPLETE로 올라오는 경로를 설명했다.
- kernel dispatch ABI는 ISA metadata가 dispatch state를 채우는 방식을 설명했다.

남은 빈칸은 **dispatch 앞뒤 packet ordering**이다.

PM4를 공부할 때 `DISPATCH_DIRECT` 같은 packet 이름만 외우면 실제 버그를 잘 못 잡는다. driver-dev에서는 dispatch packet 자체보다, dispatch 전에 어떤 state가 확정되어야 하고 dispatch 뒤에 어떤 cache/fence action이 와야 하는지가 더 자주 문제가 된다.

## compute dispatch를 세 덩어리로 나누기

AMD PM4의 실제 packet 이름과 bitfield는 GPU 세대마다 달라질 수 있다. 그래도 OpenCL compute dispatch를 낮춰 볼 때 필요한 큰 덩어리는 비교적 안정적이다.

```text
[A. state setup]
  - shader program address
  - resource/occupancy 관련 config
  - user data register or descriptor table base
  - kernarg block pointer
  - scratch/LDS/private memory setup
  - grid/workgroup size 관련 state

[B. dispatch trigger]
  - DISPATCH_DIRECT / DISPATCH_INDIRECT 계열 실행 packet

[C. after-dispatch actions]
  - 필요한 cache flush/invalidate or release action
  - timestamp/fence/event write
  - 다음 queue/host wait가 볼 completion point
```

핵심은 B가 A를 참조한다는 점이다.

`DISPATCH`는 "지금 설정된 compute state로 실행을 시작해라"에 가깝다. 따라서 A의 일부가 빠지거나 늦게 오면, B는 새 kernel이 아니라 이전 kernel의 state 일부를 물고 실행될 수 있다.

## state packet은 dispatch의 입력이다

GPU command processor는 command stream을 순서대로 소비한다. 하지만 "순서대로 소비한다"는 말이 "나중 state가 이미 dispatch에 반영된다"는 뜻은 아니다.

예를 들어 아래 순서는 위험하다.

```text
DISPATCH kernel_B
SET user_data for kernel_B
EVENT_WRITE fence_B
```

사람 눈에는 kernel_B 관련 packet이 모여 있는 것처럼 보일 수 있다. 하지만 GPU 입장에서는 dispatch 시점에 user data가 아직 바뀌지 않았다. 그러면 kernel_B ISA는 kernel_A의 descriptor table이나 kernarg pointer를 읽을 수 있다.

안전한 순서는 이렇게 봐야 한다.

```text
SET shader program for kernel_B
SET resource config for kernel_B
SET user_data / kernarg / descriptor base for kernel_B
DISPATCH kernel_B
visibility action if kernel_B produced data that a later consumer needs
EVENT_WRITE fence_B
```

여기서 `EVENT_WRITE`도 아무 위치에나 둘 수 없다. fence가 dispatch보다 앞서면 host나 consumer queue는 실행이 끝났다고 믿지만 실제 kernel은 아직 시작하지 않았을 수 있다. visibility action이 필요한 경로라면 fence는 그 action 뒤에 와야 한다.

## ordering과 visibility는 다시 분리해서 봐야 한다

dispatch sequence에는 두 종류의 "앞뒤"가 섞인다.

첫째는 **state ordering**이다.

```text
state setup -> dispatch
```

이 순서는 GPU가 어떤 kernel과 어떤 argument를 실행할지 결정한다.

둘째는 **memory visibility ordering**이다.

```text
dispatch writes data -> cache action -> fence/event visible to waiter
```

이 순서는 뒤 command나 host가 kernel 결과를 최신 값으로 볼 수 있는지 결정한다.

이 둘은 서로 다른 문제다. state ordering이 맞아도 cache action이 빠지면 stale read가 날 수 있고, cache action이 있어도 user data setup이 틀리면 애초에 잘못된 주소에 쓴다.

## in-order queue도 state reuse를 조심해야 한다

OpenCL in-order queue는 command 사이의 실행 순서를 잡아준다. 하지만 driver 내부 state reuse까지 자동으로 안전하게 만들어주지는 않는다.

드라이버는 성능 때문에 같은 pipeline, 같은 descriptor layout, 같은 scratch 설정을 재사용하려고 한다. 이때 fast path 판단이 틀리면 다음 문제가 생긴다.

```text
kernel_A: descriptor table = T0, LDS = 0
kernel_B: descriptor table = T1, LDS = 4KB

잘못된 fast path:
  "같은 pipeline layout이니 user data update 생략"
  "이전 LDS state와 호환된다고 오판"

결과:
  kernel_B dispatch가 T0 또는 잘못된 LDS 설정으로 실행
```

즉 "같은 queue에서 순서대로 실행된다"는 사실은 "필요한 state update를 생략해도 된다"는 뜻이 아니다.

fast path의 기준은 queue ordering이 아니라 **현재 GPU state가 이번 dispatch ABI와 완전히 호환되는가**여야 한다.

## DISPATCH_INDIRECT는 한 가지 입력이 더 늘어난다

직접 dispatch는 grid 크기를 command stream 안에 싣는다. 간접 dispatch는 grid 크기나 일부 실행 인자를 GPU memory에서 읽을 수 있다.

그러면 sequence에 visibility 조건이 하나 더 생긴다.

```text
producer writes indirect args buffer
-> cache/release action so command processor or shader-visible path can read it
-> DISPATCH_INDIRECT reads args
```

여기서도 event COMPLETE만으로는 부족할 수 있다. producer가 indirect args buffer를 썼다면, dispatch packet이 그 buffer를 읽는 경로에 맞는 visibility가 필요하다.

driver-dev 관점에서는 indirect dispatch가 "dispatch packet 하나"가 아니라 "dispatch가 읽는 argument buffer까지 포함한 실행 계약"이라는 점을 로그에 남겨야 한다.

## 로그는 packet list보다 invariant 중심이어야 한다

PM4 dump를 그대로 남기면 양이 많고, 세대별 packet 차이 때문에 해석도 어렵다. driver debug log는 packet 이름만 나열하기보다 invariant를 확인할 수 있어야 한다.

최소한 이런 형태가 쓸 만하다.

```text
submit=77 queue=Q0 kernel=blur_x
  state_epoch=315
  pipeline/code_object=0x...
  user_data_epoch=912 descriptor_table=0x...
  kernarg=0x...
  grid=(4096,1,1) local=(256,1,1)
  pre_dispatch_state_valid=true
  indirect_args_va=none
  post_dispatch_visibility=L2_release
  fence_seq=1840 after_visibility=true
```

중요한 질문은 다음이다.

- dispatch 전에 이번 kernel의 code object와 user data가 모두 설정됐는가?
- 생략한 state update가 있다면 왜 호환된다고 판단했는가?
- indirect args buffer를 읽는 dispatch라면 producer write가 보이는가?
- fence/event write가 dispatch와 필요한 visibility action 뒤에 있는가?
- fault가 났다면 faulting VA가 이번 descriptor/kernarg/user data에서 파생되는가?

## 흔한 버그 패턴

### 1) stale user data

```text
state reuse 판단이 너무 느슨함
-> user data update 생략
-> 새 kernel이 이전 descriptor table을 읽음
-> wrong result or GPU fault
```

### 2) early fence

```text
EVENT_WRITE가 cache action보다 앞에 있음
-> host wait는 풀림
-> host readback은 오래된 값을 볼 수 있음
```

### 3) indirect args visibility 누락

```text
kernel_A writes dispatch args
-> DISPATCH_INDIRECT reads args without proper visibility
-> old grid size로 실행되거나 out-of-range dispatch
```

### 4) partial state update

```text
pipeline/code object는 바뀜
descriptor table은 이전 값 유지
-> ISA와 argument layout이 서로 다른 계약을 봄
```

이 네 가지는 모두 "packet 순서" 문제처럼 보이지만, 실제로는 state contract와 visibility contract를 동시에 확인해야 잡힌다.

## what this means for driver dev

- compute dispatch를 `state setup -> dispatch trigger -> visibility/completion` 세 덩어리로 로그화해야 한다.
- `DISPATCH` packet dump만으로는 부족하다. 직전 state packet과 생략된 state update의 fast path 근거가 같이 있어야 한다.
- fence/event write는 dispatch 뒤, 필요한 cache/release action 뒤에 놓이는지 검증해야 한다.
- in-order queue라도 stale GPU state 재사용 버그는 가능하다. queue ordering과 state compatibility를 분리해 판단해야 한다.
- indirect dispatch는 indirect args buffer의 producer/consumer visibility까지 dispatch sequence의 일부로 봐야 한다.

## app-facing takeaway

앱 개발자는 PM4 packet 순서를 직접 제어하지 않는다. 그래도 이 모델은 성능 해석에 도움이 된다.

- kernel argument와 local size가 자주 바뀌면 드라이버가 갱신해야 할 state가 늘어난다.
- 독립적인 작은 kernel을 많이 쪼개면 dispatch 전후 state setup/fence/cache action 비용이 반복된다.
- indirect dispatch나 producer-consumer kernel chain을 쓸 때는 event/waitlist로 데이터 의존성을 명확히 표현해야 드라이버가 올바른 visibility action을 넣을 수 있다.

결국 `clEnqueueNDRangeKernel`의 비용은 실행할 ISA만의 문제가 아니다. 그 ISA가 기대하는 state를 GPU 앞에 정확한 순서로 깔고, 실행 뒤 결과가 보이는 지점까지 닫아야 하나의 dispatch가 완성된다.

---

## 관련 글

- [OpenCL 드라이버의 kernel dispatch ABI: ISA 메타데이터가 PM4 DISPATCH를 채우는 방식]({{< relref "2026-05-21-opencl-note-kernel-dispatch-abi.md" >}})
- [PM4 packet ordering과 cache visibility를 분리해서 보기]({{< relref "2026-05-10-opencl-note-pm4-ordering-vs-cache-visibility.md" >}})
- [OpenCL 드라이버의 ring buffer와 doorbell: submit이 GPU 실행으로 바뀌는 경계]({{< relref "2026-05-18-opencl-note-ring-doorbell-submit-boundary.md" >}})

## 관련 용어

- [[pm4-packet]], [[command-queue]], [[descriptor-set]], [[SPIR-V]]
