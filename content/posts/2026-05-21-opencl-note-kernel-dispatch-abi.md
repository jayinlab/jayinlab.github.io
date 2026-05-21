---
title: "OpenCL 드라이버의 kernel dispatch ABI: ISA 메타데이터가 PM4 DISPATCH를 채우는 방식"
date: 2026-05-21
slug: "opencl-note-kernel-dispatch-abi"
draft: false
type: "note"
series: "opencl-driver-internals"
tags: ["opencl", "driver", "isa", "pm4", "dispatch", "compiler", "vulkan"]
difficulty: "advanced"
---

clEnqueueNDRangeKernel이 GPU 실행으로 내려가려면 드라이버는 단순히 "이 kernel을 실행해라"라고만 쓰지 않는다.
컴파일러가 만든 ISA binary와 그 주변 메타데이터를 읽고, hardware dispatch packet이 기대하는 형식으로 실행 조건을 채워야 한다.

이 경계를 여기서는 **kernel dispatch ABI**라고 부르자.
ABI라는 말이 중요한 이유는, ISA 코드와 command stream이 서로 같은 약속을 공유해야 dispatch가 성립하기 때문이다.

## 왜 이 주제를 오늘 잡았나

최근 노트는 submit 이후의 시간축을 많이 다뤘다.

- ring buffer와 doorbell은 command stream이 GPU에 보이는 경계를 설명했다.
- fence sequence는 event COMPLETE가 어디서 올라오는지 설명했다.
- GPU fault 노트는 실패가 OpenCL event/error로 번역되는 경로를 설명했다.

하지만 아직 빈칸이 있다.
**dispatch packet 안에 어떤 값이 들어가야 GPU가 올바른 kernel ISA를 실행하는가?**

이 질문은 로드맵의 SPIR-V -> driver -> ISA와 ISA / wave 실행 사이클 사이에 걸쳐 있다. SPIR-V가 ISA로 낮아졌다는 사실만으로는 부족하다. 드라이버는 그 ISA를 실행하기 위한 resource usage, entry address, workgroup size, user data mapping을 PM4 dispatch 형태로 다시 연결해야 한다.

## ISA binary만으로는 dispatch가 완성되지 않는다

컴파일 결과물은 보통 "명령어 blob" 하나가 아니다. 실행에 필요한 메타데이터가 같이 붙는다.

단순화하면 이런 묶음이다.

~~~text
compiled kernel object
  - ISA code address / code size
  - entry point symbol
  - SGPR/VGPR usage
  - LDS usage
  - scratch/private memory usage
  - user data layout
  - kernel argument mapping
  - required wave size / workgroup constraints
~~~

ISA 명령어는 "어떤 SGPR에 kernarg pointer가 들어온다", "어떤 user SGPR에 descriptor table 주소가 있다", "grid/workgroup id는 어느 register에서 읽는다" 같은 전제를 갖는다.

PM4 dispatch 쪽이 이 전제를 틀리게 채우면 GPU는 실행은 시작할 수 있어도 잘못된 주소를 읽거나, resource limit을 넘기거나, 엉뚱한 work-item 좌표로 계산할 수 있다.

## dispatch packet이 채워야 하는 큰 축

AMD 계열을 개념적으로 단순화하면 compute dispatch에는 아래 정보들이 필요하다. 실제 packet 이름과 bitfield는 세대마다 달라질 수 있지만, 드라이버가 맞춰야 하는 축은 비슷하다.

~~~text
[state setup]
  shader program address
  resource usage config
  user data / descriptor base
  workgroup size and grid size
  scratch/LDS/private memory state

[dispatch]
  DISPATCH_DIRECT or equivalent packet

[completion]
  cache action if needed
  fence/event write
~~~

여기서 핵심은 dispatch packet 하나만 보는 것이 아니라, 그 앞의 state setup까지 함께 봐야 한다는 점이다.

예를 들어 DISPATCH_DIRECT가 grid 크기를 싣더라도, 실제 kernel이 접근할 buffer descriptor table이나 kernarg 주소는 앞선 register write/user data setup에 의해 정해질 수 있다. 따라서 "dispatch packet은 정상인데 값이 틀림" 같은 버그는 앞쪽 state packet에서 시작되는 경우가 많다.

## compiler metadata와 PM4 state의 대응

드라이버가 컴파일 결과를 받으면 대략 이런 대응을 만든다.

| compiler/ISA metadata | dispatch state에서의 의미 |
|---|---|
| code object address | shader program address로 설정 |
| entry offset | 실제 kernel 시작 지점 선택 |
| SGPR/VGPR count | occupancy/resource limit 계산 |
| LDS size | workgroup당 local memory 할당 |
| scratch size | private memory backing/scratch state 준비 |
| kernarg layout | kernel argument block 주소와 offset 계약 |
| descriptor/user data map | buffer/image/sampler table을 ISA가 읽을 위치에 연결 |
| workgroup size | dispatch geometry와 wave decomposition의 기준 |

이 표에서 중요한 행은 SGPR/VGPR count다. 이것은 단순 성능 힌트가 아니라 실행 가능성과 occupancy를 동시에 건드린다.

레지스터를 많이 쓰는 ISA는 한 CU에 동시에 올릴 수 있는 wave 수가 줄어든다. 반대로 metadata를 낮게 잘못 기록하면 하드웨어가 필요한 resource를 충분히 예약하지 못해 실행 오류로 이어질 수 있다.

## OpenCL kernel arg는 user data 계약으로 내려간다

OpenCL에서는 앱이 clSetKernelArg로 kernel argument를 채운다. 하지만 GPU ISA는 OpenCL API 객체를 모른다.

중간에는 보통 이런 변환이 있다.

~~~text
clSetKernelArg
-> runtime kernel arg storage
-> descriptor / kernarg block 구성
-> user data SGPR 또는 descriptor table base 설정
-> ISA가 약속된 register/주소에서 argument를 읽음
~~~

즉 clSetKernelArg의 결과는 submit 시점에 dispatch ABI의 일부가 된다.

이때 흔한 실수는 "descriptor set binding만 맞으면 끝"이라고 보는 것이다. binding이 맞아도 kernel ISA가 기대하는 user data slot, kernarg offset, address space, alignment가 맞지 않으면 dispatch는 깨질 수 있다.

## workgroup geometry도 ABI의 일부다

OpenCL의 global/local work size는 driver backend에서 dispatch geometry로 바뀐다.

~~~text
global size = 1024
local size  = 256

-> workgroup count = 4
-> workgroup size metadata/state = 256
-> each wave gets work-item ids from hardware-provided ids
~~~

여기서 local size는 단지 API 숫자가 아니다. compiler는 local size가 고정되어 있거나 추론 가능하면 barrier, LDS allocation, index 계산을 더 강하게 최적화할 수 있다.

반대로 runtime local size와 compiler가 가정한 조건이 충돌하면 다음 문제가 생긴다.

- workgroup당 LDS 사용량 계산이 틀어짐
- barrier가 기대한 work-item 범위와 실제 실행 범위가 달라짐
- occupancy 추정이 빗나감
- get_local_id, get_group_id 기반 주소 계산이 잘못됨

그래서 driver-dev 관점에서는 enqueue 시점의 NDRange 값도 "그냥 dispatch count"가 아니라 compiled kernel metadata와 호환되는지 확인해야 하는 입력이다.

## dispatch ABI 버그는 fault, hang, wrong result로 다 보일 수 있다

dispatch ABI가 깨졌을 때 증상은 하나로 고정되지 않는다.

~~~text
wrong user data pointer
-> kernel reads wrong descriptor
-> bad VA access
-> GPU fault

wrong LDS/scratch setup
-> execution resource mismatch
-> hang or device fault

wrong workgroup geometry
-> bounds logic mismatch
-> wrong result or out-of-range write
~~~

그래서 fault triage에서 fault VA만 보면 부족하다. 그 VA가 왜 나왔는지를 보려면 descriptor table, kernarg block, user data register setup, compiled metadata를 같은 submit id로 묶어 봐야 한다.

## driver 로그에 남겨야 할 최소 단위

실전 로그는 너무 장황하면 못 쓴다. 그래도 dispatch ABI 문제를 좁히려면 최소한 아래 축은 필요하다.

~~~text
queue=Q0 submit=42 kernel=saxpy
  code_object=0x... entry=0x...
  grid=(1024,1,1) local=(256,1,1)
  sgpr=40 vgpr=32 lds=0 scratch=0
  kernarg_gpu_va=0x...
  user_data=[slot0=..., slot1=..., descriptor_table=0x...]
  resources=[BO7, BO9, BO11]
  fence_seq=1002
~~~

이 정도가 있으면 다음 질문에 답할 수 있다.

- 실행한 ISA가 의도한 kernel과 같은가?
- NDRange가 compiler metadata와 호환되는가?
- descriptor/kernarg 주소가 submit resource list 안에 있는가?
- fault VA가 user data에서 파생된 값인가?
- 레지스터/LDS/scratch 사용량 때문에 occupancy가 예상보다 낮아졌는가?

## what this means for driver dev

- 컴파일 결과물은 ISA blob이 아니라 dispatch ABI metadata까지 포함한 실행 계약으로 다뤄야 한다.
- clSetKernelArg, descriptor table, kernarg block, user data SGPR mapping을 하나의 추적 가능한 경로로 로그화해야 한다.
- PM4 dispatch packet만 덤프하지 말고, 앞선 state setup packet과 compiler metadata를 같이 봐야 한다.
- SGPR/VGPR/LDS/scratch 값은 성능 정보이면서 resource 예약 정보다. 잘못 낮추면 실행 오류, 높게 잡으면 occupancy 손실로 이어진다.
- fault triage에서는 fault VA를 submit resource list뿐 아니라 user data/kernarg/descriptor setup과 대조해야 한다.

## app-facing takeaway

앱 개발자는 dispatch ABI를 직접 만들지 않는다. 그래도 이 모델을 알면 성능과 버그를 더 잘 해석할 수 있다.

- kernel argument 타입, 개수, alignment를 자주 흔들면 backend의 descriptor/kernarg 계약도 흔들린다.
- local size 선택은 단순 튜닝 값이 아니라 LDS 사용량, occupancy, wave decomposition에 영향을 준다.
- 같은 SPIR-V라도 드라이버가 만든 ISA metadata가 다르면 occupancy와 scratch 사용량이 달라져 성능 차이가 날 수 있다.

결국 "kernel 하나 enqueue"는 내부적으로 code object, resource metadata, argument block, dispatch geometry를 한 번에 맞추는 작업이다. 이 계약을 안정적으로 유지할수록 드라이버도 fast path와 정확한 fault attribution을 유지하기 쉽다.

---

## 관련 글

- [SPIR-V에서 ISA까지: 드라이버 백엔드가 실제로 하는 일]({{< relref "2026-04-26-opencl-note-spirv-to-isa-driver-path.md" >}})
- [OpenCL 드라이버의 ring buffer와 doorbell: submit이 GPU 실행으로 바뀌는 경계]({{< relref "2026-05-18-opencl-note-ring-doorbell-submit-boundary.md" >}})
- [GPU fault는 OpenCL event와 error로 어떻게 올라오나]({{< relref "2026-05-20-opencl-note-gpu-fault-to-event-error.md" >}})

## 관련 용어

- [[SPIR-V]], [[pm4-packet]], [[descriptor-set]], [[wavefront]]
