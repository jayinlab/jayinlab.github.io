---
title: "GPU의 비동기 복사는 왜 모두 함께 외쳐야 할까"
date: 2026-09-15
slug: "gpu-fun-fact-async-copy"
draft: false
type: "note"
series: "gpu-fun-facts"
tags: ["gpu", "opencl", "local-memory", "async-copy", "work-group"]
difficulty: "beginner"
---

창고에서 식재료를 주방으로 옮기는 동안 요리사가 다른 손질을 할 수 있다면 좋다. GPU kernel도 큰 `global memory`의 데이터를 가까운 `local memory`로 가져온 뒤 여러 번 계산하곤 한다. OpenCL의 `async_work_group_copy`는 바로 이 운반을 “비동기 복사”로 요청하는 함수다.

그런데 호출 모습은 배달 앱보다 단체 구호에 가깝다. 이 함수는 work-group의 모든 work-item이 수행하는 집단 연산이다. 일부 work-item만 조건문 안으로 들어가 호출하거나, 서로 다른 인자를 내면 결과가 undefined다. 데이터 한 덩어리를 함께 쓰는 팀이므로 “누가 복사를 시작했지?”라는 모호함을 없앤 계약이다.

복사를 요청하면 완료를 나타내는 `event_t`가 돌아온다. work-group은 당장 독립적인 계산을 진행할 수 있고, 복사된 데이터가 필요해지는 지점에서 `wait_group_events`로 완료를 기다린다. 여러 복사를 하나의 event 사슬에 연결할 수도 있다. 다만 복사 함수 자체에는 source 데이터를 준비시키는 암묵적 barrier가 없다. 다른 work-item이 source를 막 갱신했다면 programmer가 그보다 앞선 동기화를 따로 설계해야 한다.

왜 흥미로울까? 이름의 `async`는 “복사와 계산이 반드시 겹쳐 빨라진다”는 성능 보증서가 아니다. 기다릴 시점을 표현할 수 있게 해 주는 실행 계약에 가깝고, 실제 overlap과 이득은 device, compiler, memory 경로, 복사 크기에 달려 있다.

창고 비유의 한계도 여기에 있다. 현실의 배달원은 요리사와 별개지만, GPU가 전용 copy 장치를 쓰는지, 일반 execution 자원으로 복사를 처리하는지는 이 OpenCL C 함수의 의미만으로 정해지지 않는다. 확실한 것은 팀 전체가 같은 호출을 만나고, event를 통해 완료를 확인해야 한다는 점이다.

Source note: [Khronos OpenCL C Specification 3.0 — Async Copies](https://registry.khronos.org/OpenCL/specs/3.0-unified/html/OpenCL_C.html#async-copies)는 `async_work_group_copy`가 global/local memory 사이를 복사하고 완료 event를 반환한다고 규정한다. 또한 모든 work-item이 같은 인자로 호출해야 하며, source data에 대한 암묵적 synchronization은 수행하지 않는다고 명시한다.
