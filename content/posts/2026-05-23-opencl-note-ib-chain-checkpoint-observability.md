---
title: "PM4 IB chain과 checkpoint: command stream 진행률은 어디서 관찰되나"
date: 2026-05-23
slug: "opencl-note-ib-chain-checkpoint-observability"
draft: false
type: "note"
series: "opencl-driver-internals"
tags: ["opencl", "driver", "pm4", "indirect-buffer", "fence", "debugging", "queue"]
difficulty: "advanced"
---

어제 노트에서는 compute dispatch packet 앞뒤의 state ordering을 봤다.
오늘은 command stream을 한 단계 더 실제 driver debug에 가깝게 보자.

PM4 stream은 항상 긴 선형 packet 배열 하나로만 실행되지 않는다.
Main ring이 있고, 그 안에서 INDIRECT_BUFFER packet이 다른 메모리의 IB를 호출할 수 있다.
여기에 fence, checkpoint, preemption 관련 marker가 섞이면 "GPU가 어디까지 실행했는가"를 해석하는 일이 생각보다 까다로워진다.

~~~text
main ring
  -> IB #10
      -> state setup
      -> dispatch A
      -> checkpoint C1
      -> IB #11
          -> dispatch B
          -> checkpoint C2
      -> fence seq=900
~~~

이 구조에서 fence seq=900이 아직 안 보인다고 해서 dispatch A가 아예 시작하지 않았다고 단정할 수 없다.
반대로 checkpoint C1이 보인다고 해서 IB #11의 dispatch B까지 끝났다고 말할 수도 없다.

## 왜 이 주제를 오늘 잡았나

최근 driver-dev 노트는 아래 순서로 내려왔다.

- ring/doorbell submit boundary
- fence sequence와 OpenCL event COMPLETE 귀속
- kernel dispatch ABI
- dispatch 전후 PM4 packet ordering

남은 빈칸은 **command stream 내부 진행률의 관찰 지점**이다.

PM4 dump를 볼 때 초보적으로는 packet을 위에서 아래로 읽으면 충분해 보인다.
하지만 실제 submit은 IB chain, nested IB, scheduler checkpoint, fence write, fault 지점이 서로 다른 granularity로 남는다.
이 granularity를 구분하지 않으면 driver 로그에서 다음 실수를 하기 쉽다.

- checkpoint가 찍혔으니 submit 전체가 끝났다고 오해한다.
- fence가 안 찍혔으니 앞 dispatch도 실행되지 않았다고 오해한다.
- faulting IB 주소만 보고 어떤 OpenCL command/event에 속한 packet인지 연결하지 못한다.
- preemption/resume 뒤에 같은 IB가 다시 보이는 것을 중복 실행으로 잘못 해석한다.

## IB는 command stream의 함수 호출에 가깝다

Main ring에는 모든 packet을 직접 길게 넣을 수도 있지만, 보통은 IB를 가리키는 packet을 넣고 실제 command payload는 별도 buffer에 둔다.

단순화하면 이런 구조다.

~~~text
ring packet:
  INDIRECT_BUFFER base=0x7000 size=0x200

IB at 0x7000:
  SET_SH_REG ...
  SET_UCONFIG_REG ...
  DISPATCH_DIRECT ...
  EVENT_WRITE ...
~~~

여기서 packet/register 이름은 세대별 ISA/PM4 문서의 정확한 encoding을 고정하려는 것이 아니라, command stream 구조를 설명하기 위한 개념적 label이다.

Command processor 입장에서는 INDIRECT_BUFFER packet을 만나면 PC가 IB 주소로 이동하고, IB 범위를 처리한 뒤 다시 caller stream으로 돌아온다.
그래서 IB chain을 읽을 때는 packet 순서뿐 아니라 **현재 실행 PC가 어느 stream에 있는지**도 봐야 한다.

~~~text
ring[20] -> IB_A[0] -> IB_A[1] -> IB_B[0] -> IB_B[1] -> IB_A[2] -> ring[21]
~~~

로그가 ring offset만 남기면 IB 안에서 멈춘 fault를 설명하기 어렵다.
반대로 IB offset만 남기면 그 IB가 어떤 queue submit에서 호출됐는지 잃어버린다.

## checkpoint는 완료가 아니라 위치 표식이다

Driver나 scheduler는 command stream 중간에 checkpoint 성격의 packet 또는 marker를 넣을 수 있다.
목적은 보통 "GPU가 적어도 여기까지 왔다"를 관찰하기 위해서다.

이때 checkpoint는 fence와 의미가 다르다.

~~~text
dispatch A
checkpoint C1
dispatch B
cache/release action
fence seq=900
~~~

C1이 관찰됐다는 것은 dispatch A 뒤의 특정 지점까지 도달했다는 강한 힌트다.
하지만 API-level completion은 대개 fence seq=900 같은 submit 말단의 완료 표식에 붙는다.
특히 dispatch B의 결과를 host가 읽어야 한다면, C1은 그 readback의 안전성을 증명하지 않는다.

driver-dev 관점에서는 checkpoint를 이렇게 분류해야 한다.

| 표식 | 말할 수 있는 것 | 말하면 안 되는 것 |
|---|---|---|
| IB enter | CP가 해당 IB 호출 지점에 도달함 | IB 안의 dispatch가 완료됨 |
| mid checkpoint | 특정 packet 위치까지 진행함 | submit/event 전체가 COMPLETE임 |
| fence write | fence 위치 앞 command가 retire됨 | 별도 visibility action이 필요 없었다는 뜻 |
| fault record | fault가 관찰된 engine/VA/시점 | 원인 command가 자동으로 단일 packet이라는 뜻 |

checkpoint는 디버깅에 매우 유용하지만, OpenCL event COMPLETE의 대체물은 아니다.

## nested IB에서는 attribution이 더 중요해진다

IB가 중첩되면 "어느 command가 fault를 냈는가"를 찾는 과정이 계층형이 된다.

~~~text
submit #77, queue Q0
  ring tail 0x1000
    IB_A: command buffer chunk
      kernel A dispatch
      IB_B: reusable state bundle
        descriptor/user data update
      kernel B dispatch
      fence seq=1840
~~~

fault record가 IB_B + 0x40만 알려준다면 아직 부족하다.
그 IB_B가 어떤 submit에서, 어떤 parent IB를 통해, 어떤 OpenCL command node 사이에서 호출됐는지 연결해야 한다.

실전 로그는 최소한 아래 축을 같이 남겨야 한다.

~~~text
submit=77 queue=Q0 engine=compute0 fence=1840
  ring_range=[0x1000,0x1080)
  ib_stack:
    L0 ring offset=0x1028
    L1 ib=IB_A va=0x7000 offset=0x90
    L2 ib=IB_B va=0x9000 offset=0x40
  command_node=kernel_B
  checkpoint=cp_77_14
  last_completed_fence=1839
  fault_va=0x...
~~~

이 정도가 있어야 "fault가 난 주소가 kernel_B의 descriptor table에서 나온 것인지", "IB_B가 재사용 bundle이라서 여러 command가 공유하는 것인지", "fence 1840 앞에서 멈춘 것인지"를 분리할 수 있다.

## preemption/resume은 로그를 더 헷갈리게 만든다

GPU scheduler가 긴 command stream을 중간에 preempt했다가 나중에 resume할 수 있다면, 같은 IB 주소와 checkpoint가 로그에 다시 보일 수 있다.
이때 단순히 "같은 checkpoint가 두 번 찍혔다"만 보면 중복 실행처럼 보인다.

하지만 실제로는 아래 상황일 수 있다.

~~~text
run IB_A until checkpoint C3
-> preempt
-> later resume near C3
-> continue to dispatch B
-> fence seq=900
~~~

따라서 checkpoint 로그에는 가능하면 scheduler context나 preemption epoch가 붙어야 한다.

~~~text
ctx=5 submit=77 epoch=12 checkpoint=C3
ctx=5 submit=77 epoch=13 resume_from=C3
~~~

핵심은 같은 IB VA가 같은 "실행 시도"를 뜻하지 않을 수 있다는 점이다.
IB는 메모리 객체이고, 실행은 queue/context/epoch 위에서 일어나는 시간축이다.

## fence 위치는 IB chain 전체의 의미를 닫는다

OpenCL event를 COMPLETE로 올리려면 보통 command stream 안의 어떤 retire 지점이 필요하다.
IB chain이 있어도 원칙은 같다.

~~~text
IB_A:
  dispatch A
  IB_B:
    dispatch B
  needed cache/release action
  fence write seq=900
~~~

이 경우 seq=900은 IB_A 안에서 IB_B까지 돌아온 뒤, 필요한 visibility action까지 지난 위치에 있어야 한다.
만약 fence가 parent IB에서 너무 앞에 있거나, child IB dispatch보다 먼저 실행 가능한 위치에 있다면 event COMPLETE가 너무 일찍 올라갈 수 있다.

driver에서 확인할 invariant는 단순하다.

~~~text
all commands represented by event range
-> all child IBs needed by those commands
-> required visibility action
-> fence/event write used for completion
~~~

이 순서가 깨지면 packet dump는 그럴듯해 보여도 OpenCL event 의미가 깨진다.

## what this means for driver dev

- PM4 log는 flat packet list만으로 부족하다. submit id, queue, ring offset, IB stack, command node, fence seq를 함께 묶어야 한다.
- checkpoint는 progress marker이지 API completion marker가 아니다. event COMPLETE는 fence 위치와 필요한 visibility action까지 확인한 뒤 올려야 한다.
- nested IB fault triage에서는 faulting VA뿐 아니라 faulting packet의 IB call stack을 남겨야 한다.
- preemption/resume이 가능한 경로에서는 checkpoint 로그에 context/epoch를 붙여 같은 IB 재등장을 중복 실행으로 오해하지 않게 해야 한다.
- fence write는 event가 대표하는 command range와 child IB 실행 뒤에 있어야 한다. parent/child IB 경계를 넘어 completion 위치를 검증해야 한다.

## app-facing takeaway

앱 개발자는 IB chain이나 checkpoint를 직접 다루지 않는다.
그래도 이 모델은 성능과 디버깅 해석에 도움이 된다.

- command buffer나 kernel dispatch를 잘게 쪼개면 내부적으로 더 많은 command stream 조각과 완료 표식이 필요할 수 있다.
- profiling trace에서 "중간 marker가 보임"은 "결과가 host에 안전하게 보임"과 다르다.
- 긴 kernel/긴 command stream에서 preemption이 끼면 trace가 선형 한 줄처럼 보이지 않을 수 있다.

결국 command stream 진행률은 하나의 숫자가 아니다.
IB call stack, checkpoint, fence sequence, event mapping을 함께 봐야 OpenCL command가 실제 GPU 시간축에서 어디까지 갔는지 말할 수 있다.

---

## 관련 글

- [PM4 compute dispatch sequence: state setup은 왜 DISPATCH보다 먼저 와야 하나]({{< relref "2026-05-22-opencl-note-pm4-compute-dispatch-sequence.md" >}})
- [OpenCL 드라이버의 fence sequence: event COMPLETE는 어디서 태어나나]({{< relref "2026-05-19-opencl-note-fence-sequence-event-completion.md" >}})
- [PM4 Indirect Buffer — 커맨드 스트림 안의 커맨드 스트림]({{< relref "2026-04-13-pm4-indirect-buffer.md" >}})

## 관련 용어

- [[pm4-packet]], [[ring-buffer]], [[command-buffer]], [[command-queue]]
