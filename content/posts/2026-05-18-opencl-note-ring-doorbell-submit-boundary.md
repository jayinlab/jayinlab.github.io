---
title: "OpenCL 드라이버의 ring buffer와 doorbell: submit이 GPU 실행으로 바뀌는 경계"
date: 2026-05-18
slug: "opencl-note-ring-doorbell-submit-boundary"
draft: false
type: "note"
series: "opencl-driver-internals"
tags: ["opencl", "driver", "umd", "kmd", "pm4", "ring-buffer", "doorbell", "fence", "synchronization"]
difficulty: "advanced"
---

OpenCL 런타임에서 `clEnqueueNDRangeKernel`이 호출되면 UMD는 command node를 만들고, waitlist를 해석하고, descriptor/resource 상태를 준비한다.
하지만 이 모든 준비가 곧 GPU 실행은 아니다. 실제 실행으로 넘어가는 좁은 문은 보통 **PM4 command stream이 ring buffer에 보이고, doorbell로 GPU command processor를 깨우는 순간**이다.

오늘은 이 경계를 따로 떼어 본다. 최근 노트에서 event waitlist, cache visibility, VM bind/residency를 각각 봤다면, 이번 노트는 그 조건들이 submit 시점에 어떻게 하나의 실행 단위로 묶이는지 보는 글이다.

## 왜 이 주제를 오늘 잡았나

최근 학습 흐름은 아래 순서로 내려왔다.

1. OpenCL event waitlist는 dependency graph다.
2. event COMPLETE와 memory visibility는 같은 개념이 아니다.
3. VM bind/residency가 맞지 않으면 동기화가 맞아도 fault가 난다.

아직 남은 빈칸은 “그 모든 조건이 준비된 뒤 GPU가 실제로 일을 시작하는 신호는 무엇인가?”다.

드라이버 개발 관점에서는 이 질문이 중요하다. submit 경계가 흐리면 다음 문제가 섞인다.

- UMD가 command stream을 다 썼다고 생각했지만 KMD/GPU가 아직 못 본다.
- doorbell은 울렸지만 ring write ordering이 보장되지 않는다.
- fence는 signal됐지만 어느 submit batch까지 완료됐는지 로그가 애매하다.
- fault가 났을 때 resource 문제인지, submit ordering 문제인지 분리되지 않는다.

## ring buffer는 GPU가 읽는 작업 대기열이다

PM4 command는 결국 GPU command processor가 읽을 수 있는 메모리 영역에 직렬화된다. 이 영역을 단순화해서 보면 `ring buffer`다.

```text
UMD/KMD가 PM4 packet 작성
-> ring write pointer 갱신
-> 필요한 memory ordering 보장
-> doorbell write
-> GPU command processor가 read pointer부터 packet consume
```

여기서 ring buffer는 일반적인 host-side queue와 다르다. CPU가 쓴 command bytes를 GPU가 직접 읽는다. 그래서 핵심 질문은 “큐에 넣었는가?”가 아니라 “GPU가 그 bytes를 올바른 순서와 내용으로 볼 수 있는가?”다.

특히 command stream은 단순 데이터가 아니라 실행 지시다. 일부 packet만 보이거나, write pointer가 먼저 보이거나, doorbell이 command write보다 먼저 관찰되면 GPU는 아직 완성되지 않은 명령을 읽을 수 있다.

## doorbell은 실행 명령이 아니라 깨우는 신호다

doorbell은 보통 CPU가 특정 MMIO/register 또는 doorbell page에 값을 써서 GPU에게 “새 command가 있다”고 알리는 경로다.
중요한 점은 doorbell 자체가 command stream의 내용을 전달하지 않는다는 것이다.

doorbell은 이런 의미에 가깝다.

```text
새 tail pointer까지 ring에 일이 준비되어 있으니 확인해라.
```

따라서 doorbell write 전에 이미 성립해야 하는 전제들이 있다.

- PM4 packet bytes가 ring memory에 완전히 기록됨
- ring write pointer/tail 값이 올바르게 갱신됨
- GPU가 ring memory를 읽을 때 command stream write를 관찰할 수 있음
- 해당 submit의 BO/VM/residency 조건이 KMD 관점에서 준비됨

doorbell은 마지막 알림이지, 앞 조건을 자동으로 정리해주는 동기화가 아니다.

## submit boundary에서 필요한 ordering

submit 경계에는 최소 세 종류의 ordering이 섞인다.

### 1) CPU write ordering

CPU가 ring memory에 PM4 packet을 쓰고, 그 뒤 doorbell을 써야 한다.
반대로 관찰되면 GPU는 새 tail을 보고 ring을 읽는데 command bytes가 아직 완성되지 않았을 수 있다.

드라이버 코드는 이 경계에서 memory barrier, WC buffer flush, MMIO ordering 규칙을 신경 써야 한다. 특히 write-combined mapping으로 command buffer를 채우는 경로에서는 “CPU 코드 순서”와 “GPU가 보는 순서”를 같은 것으로 보면 위험하다.

### 2) resource readiness ordering

doorbell 전에 submit batch가 참조하는 resource 상태도 준비되어야 한다.

- descriptor가 가리키는 BO 목록
- VM bind/page table update
- residency list
- queue 간 wait primitive
- 필요한 cache action

이 중 하나가 submit 뒤늦게 따라오면, command processor 입장에서는 정상 packet을 읽었는데 dispatch 중 fault 또는 stale read가 날 수 있다.

### 3) completion ordering

submit의 끝에는 보통 fence/event write가 붙는다.
이 fence는 “doorbell을 울렸다”가 아니라 “GPU가 해당 지점까지 실행했다”를 나타내야 한다.

따라서 fence packet은 dispatch와 필요한 visibility action 뒤에 위치해야 한다. 그래야 host wait나 consumer queue가 그 fence를 기준으로 안전하게 다음 작업을 시작할 수 있다.

## UMD/KMD 경계에서 누가 무엇을 책임지나

실제 구현은 드라이버마다 다르지만, 책임을 분리해서 보면 이해가 쉽다.

UMD는 보통 API semantic을 알고 있다.

- OpenCL command/event graph 구성
- kernel arg와 descriptor 상태 추적
- PM4/IB 또는 driver-private command stream 구성
- 어떤 resource가 이번 submit에 필요한지 KMD에 전달

KMD는 GPU에 가까운 제출 경계를 책임진다.

- ring buffer 공간 할당과 tail 관리
- VM/residency 검증 및 scheduler 제출
- doorbell write 또는 doorbell을 안전하게 칠 수 있는 상태 구성
- fence sequence 관리와 interrupt/wakeup
- GPU fault와 last completed fence 기록

핵심은 UMD가 command stream을 만들었다고 submit이 끝난 것이 아니라는 점이다. KMD가 그 command stream을 GPU가 읽을 수 있는 시간축에 올리고, doorbell/fence/VM 상태를 함께 묶어야 submit이 완성된다.

## 디버깅할 때 볼 로그 축

ring/doorbell 경계의 버그는 재현이 어렵다. 그래서 로그를 남길 때 event 이름만으로는 부족하다.

확인해야 할 축은 다음과 같다.

1. submit id와 fence sequence
2. ring tail before/after
3. doorbell write 값과 시각
4. IB GPU VA와 크기
5. batch resource list와 VMID
6. last completed fence
7. faulting VA가 있다면 해당 submit의 BO 목록

이 정보가 있어야 “doorbell 전에 준비가 안 됐나”, “GPU가 packet은 읽었지만 resource가 없었나”, “실행은 끝났지만 visibility action이 부족했나”를 나눌 수 있다.

## what this means for driver dev

- submit path의 마지막 단계는 단순 함수 호출이 아니라 **ring write -> ordering 보장 -> doorbell -> fence 관찰**로 분해해서 봐야 한다.
- doorbell write는 command stream과 resource readiness가 모두 준비된 뒤에만 가능하다는 불변식을 코드와 로그에 남겨야 한다.
- fence sequence는 submit id, ring tail, resource list와 함께 추적해야 fault triage가 가능하다.
- CPU write ordering 문제와 GPU cache visibility 문제를 같은 “동기화 문제”로 뭉개지 말아야 한다. 전자는 GPU가 command를 제대로 읽는 문제이고, 후자는 command가 실행된 뒤 데이터가 보이는 문제다.
- PM4 packet ordering을 검증할 때는 packet 내부 순서뿐 아니라, 그 packet들이 ring에 보이는 시점과 doorbell 시점까지 포함해야 한다.

## app-facing takeaway

앱 개발자는 doorbell이나 ring buffer를 직접 다루지 않는다. 그래도 이 모델을 알면 성능 현상을 더 잘 해석할 수 있다.

- 아주 작은 dispatch를 많이 던지면 각 submit마다 ring/doorbell/fence 비용이 반복된다.
- command를 batch로 묶고 불필요한 `clFinish`를 줄이면 submit boundary 통과 횟수가 줄어든다.
- event waitlist를 정확히 표현하면 드라이버가 독립 작업을 같은 submit 또는 더 느슨한 dependency로 묶을 여지가 생긴다.

즉 앱 레벨 최적화의 “submit을 줄여라”는 조언은 내부적으로 ring/doorbell/fence 경계를 덜 건너게 하라는 뜻에 가깝다.

---

## 관련 글

- [OpenCL 드라이버의 VM bind와 residency: fault를 동기화 버그와 분리해서 보기]({{< relref "2026-05-17-opencl-note-vm-bind-residency-fault-triage.md" >}})
- [OpenCL Event Waitlist Lowering — API 의존성을 실제 wait로 낮추는 기준]({{< relref "2026-05-16-opencl-note-event-waitlist-lowering.md" >}})
- [PM4 packet ordering과 cache visibility를 분리해서 보기]({{< relref "2026-05-10-opencl-note-pm4-ordering-vs-cache-visibility.md" >}})

## 관련 용어

- [[ring-buffer]], [[pm4-packet]], [[command-queue]], [[descriptor-set]]
