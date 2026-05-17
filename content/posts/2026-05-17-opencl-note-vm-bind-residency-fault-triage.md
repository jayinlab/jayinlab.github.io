---
title: "OpenCL 드라이버의 VM bind와 residency: fault를 동기화 버그와 분리해서 보기"
date: 2026-05-17
slug: "opencl-note-vm-bind-residency-fault-triage"
draft: false
type: "note"
series: "opencl-driver-internals"
tags: ["opencl", "driver", "umd", "kmd", "memory", "vm", "residency", "fault"]
difficulty: "advanced"
---

OpenCL 커널이 어떤 버퍼를 읽고 쓰려면 두 가지가 모두 맞아야 한다.

1. 실행 순서와 memory visibility가 맞아야 한다.
2. 그 버퍼가 GPU VA 공간에 bind되어 있고, 실행 시점에 resident 상태여야 한다.

최근 노트에서는 event waitlist, fence, cache visibility를 중심으로 봤다. 오늘은 그 옆에 있는 다른 축, 즉 **GPU virtual memory와 BO residency**를 따로 떼어 본다. 이 축을 섞어 보면 "event를 기다렸는데도 fault가 난다" 같은 문제를 동기화 버그로만 오해하기 쉽다.

## 왜 이 주제를 오늘 잡았나

최근 반복된 학습 갭은 queue/event lowering, PM4 ordering/cache visibility, UMD/KMD 계약이었다. 그런데 이 흐름에는 아직 빈칸이 있다.

- descriptor가 버퍼를 가리킨다.
- 그 버퍼의 GPU VA가 유효해야 한다.
- 해당 BO가 resident여야 한다.
- page table / VM bind 상태가 submit 시점과 맞아야 한다.
- 그다음에야 dispatch가 안전하게 memory access를 한다.

즉 동기화가 완벽해도, 주소 공간과 residency가 준비되지 않으면 커널은 정상 실행될 수 없다.

## VM bind는 "버퍼 핸들 존재"와 다르다

OpenCL 레벨에서는 `cl_mem` 핸들이 있으면 버퍼가 준비된 것처럼 보인다. Vulkan 경로로 내려오면 앱/런타임은 보통 `VkBuffer`, memory allocation, descriptor binding을 보게 된다.

하지만 드라이버 내부에서 중요한 질문은 더 낮다.

- 이 buffer object(BO)에 GPU virtual address가 할당되었는가?
- 그 VA range가 현재 VM/page table에 bind되어 있는가?
- 해당 BO가 submit 전에 resident list에 들어갔는가?
- eviction/migration 중인 BO를 GPU가 읽으려 하지는 않는가?

여기서 `descriptor set에 buffer를 꽂았다`는 말은 셰이더가 참조할 리소스 주소를 알려줬다는 뜻이지, 그 주소가 언제나 page table 관점에서 접근 가능하다는 뜻은 아니다.

## UMD와 KMD가 나눠 갖는 책임

UMD는 API semantic과 실행 계획을 안다.

- 어떤 `cl_mem`이 어떤 kernel arg로 쓰이는지 추적
- descriptor/update/bind 시점에 필요한 BO 목록 수집
- submit batch별 resource list 구성
- read/write access intent를 KMD에 전달

KMD는 실제 메모리 관리와 스케줄링 경계를 잡는다.

- BO residency 보장
- VM bind/unbind와 page table update
- VRAM/GTT migration
- eviction 압력 처리
- GPU fault 발생 시 faulting address, VMID, engine, fence 위치 기록

핵심은 UMD가 "이번 dispatch는 이 BO들을 쓴다"는 정보를 빠뜨리면, KMD는 resident 보장을 제대로 할 수 없다는 점이다. 반대로 KMD가 eviction이나 VM update 순서를 잘못 잡으면, UMD가 만든 descriptor가 맞아도 GPU fault가 난다.

## fault triage에서 먼저 분리할 질문

GPU fault가 났을 때 바로 "barrier가 빠졌나?"부터 보면 길을 잃기 쉽다. 먼저 fault 종류를 분리해야 한다.

### 1) 주소가 유효한가

faulting VA가 어떤 BO range에 속하는지 확인한다.

- descriptor가 stale GPU VA를 가리키는가?
- buffer destroy/free 이후 command가 늦게 실행됐는가?
- sub-buffer offset 계산이 BO 경계를 넘었는가?

이 경우는 cache visibility가 아니라 lifetime/address bug에 가깝다.

### 2) bind는 되어 있는가

VA range가 VM page table에 실제로 bind되어 있는지 확인한다.

- submit 전에 VM bind packet/update가 완료됐는가?
- queue 간 VM update와 dispatch 순서가 연결되어 있는가?
- sparse/resizable resource라면 필요한 page만 빠져 있지 않은가?

여기서는 event dependency가 있어도, VM update dependency가 별도 경로라면 깨질 수 있다.

### 3) resident 상태인가

BO가 실행 시점에 GPU가 접근 가능한 물리 메모리에 있는지 확인한다.

- resident list 누락
- memory pressure로 인한 eviction
- migration 중 dispatch 시작
- CPU map/unmap과 GPU access가 겹친 경로

이 경우는 "제출은 됐는데 실행 순간 자원이 없었다"에 가깝다.

### 4) 그 다음에 visibility를 본다

주소도 맞고 bind/residency도 맞는데 값만 오래된 경우라면, 그때 cache flush/invalidate와 memory visibility를 본다.

이 순서가 중요하다. fault는 대개 "접근 자체가 불가능"한 문제이고, stale data는 "접근은 됐지만 최신 값이 안 보임" 문제다.

## submit 직전 체크리스트

드라이버에서 dispatch submit을 만들 때는 아래 항목을 event/fence 체크와 함께 본다.

1. kernel arg에서 참조되는 BO 목록이 모두 resource list에 들어갔는가?
2. descriptor가 들고 있는 GPU VA가 현재 BO의 유효 range와 일치하는가?
3. VM bind/page table update가 dispatch보다 먼저 관찰되도록 ordering이 잡혔는가?
4. resident 보장이 fence signal보다 앞선 실행 전제 조건으로 처리되는가?
5. fault 로그에 VA, BO id, VMID, engine, submit fence, last completed fence를 같이 남기는가?

특히 5번은 디버깅 효율을 크게 바꾼다. faulting VA만 있고 submit/resource context가 없으면, 원인을 descriptor stale, VM bind 누락, eviction, visibility 중 어디로 좁힐지 어렵다.

## what this means for driver dev

- event/fence timeline만으로 correctness를 판단하면 부족하다. **resource residency timeline**을 별도로 기록해야 한다.
- descriptor update 경로와 submit resource list 경로가 갈라져 있으면, 두 경로의 BO 추적 결과가 일치하는지 검증해야 한다.
- VM bind/update는 "메모리 관리 작업"이지만, dispatch와 순서 관계가 필요한 command dependency이기도 하다.
- GPU fault triage 로그는 최소한 faulting VA와 submit batch의 BO 목록을 함께 묶어야 한다.
- cache visibility 문제와 VM/residency 문제를 분리해서 봐야 불필요한 barrier를 추가하는 식의 잘못된 해결을 피할 수 있다.

## app-facing takeaway

앱 개발자 입장에서는 큰 버퍼를 자주 만들고 버리거나, 여러 queue에서 같은 리소스를 넘겨 쓰거나, sparse/resource aliasing을 쓰는 코드에서 이런 문제가 겉으로 드러난다.

실전 최적화 관점에서는 다음 습관이 도움이 된다.

- 리소스 lifetime을 dispatch 완료보다 짧게 잡지 않는다.
- 불필요한 allocate/free 반복 대신 buffer reuse를 우선한다.
- queue 간 리소스 전달 지점은 event/barrier로 명확히 표현한다.
- fault나 device lost가 나면 "동기화 누락"과 "주소/residency 문제"를 나눠서 본다.

즉 앱에서는 리소스 생명주기와 dependency를 명확히 표현하고, 드라이버에서는 그 정보를 VM bind/residency 보장으로 정확히 낮춰야 한다.

---

## 관련 글

- [OpenCL Event Waitlist Lowering — API 의존성을 실제 wait로 낮추는 기준]({{< relref "2026-05-16-opencl-note-event-waitlist-lowering.md" >}})
- [OpenCL 드라이버에서 UMD/KMD 동기화 계약]({{< relref "2026-05-09-opencl-note-umd-kmd-sync-contract.md" >}})
- [PM4 packet ordering과 cache visibility를 분리해서 보기]({{< relref "2026-05-10-opencl-note-pm4-ordering-vs-cache-visibility.md" >}})

## 관련 용어

- [[descriptor-set]], [[command-queue]], [[pm4-packet]], [[ring-buffer]]
