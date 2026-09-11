---
title: "GPU가 다음 kernel을 직접 부를 수도 있을까"
date: 2026-09-11
slug: "gpu-fun-fact-device-side-enqueue"
draft: false
type: "note"
series: "gpu-fun-facts"
tags: ["gpu", "opencl", "runtime", "scheduling", "device-enqueue"]
difficulty: "beginner"
---

주방장이 요리를 하나 끝낼 때마다 홀의 매니저에게 달려가 “다음 요리사를 불러 주세요”라고 해야 한다면 꽤 번거롭다. 그런데 재료를 살펴본 주방장이 그 자리에서 다음 조리 팀을 호출할 수 있다면 어떨까? GPU에도 이와 닮은 기능이 있다. OpenCL의 **device-side enqueue**는 실행 중인 kernel의 work-item이 다른 일을 device queue에 넣게 한다.

보통 host program은 입력 크기를 보고 kernel을 enqueue한다. 반면 처리할 데이터의 양이나 모양을 GPU에서야 알 수 있는 알고리즘에서는, parent kernel이 `enqueue_kernel`을 호출해 child 작업의 ND-range를 정하고 block을 queue에 넣을 수 있다. Khronos 명세는 이를 host program의 직접 개입 없이 device에서 kernel을 enqueue하는 **nested parallelism**이라고 설명한다. 한 kernel이 여러 child block을 예약하는 것도 가능하다.

여기에는 진짜 계산대가 딸려 있다. on-device queue는 무한한 추상 목록이 아니라 크기가 정해진 device 자원이고, enqueue는 실패할 수도 있다. child가 언제 시작할지 정하려면 enqueue flag와 event dependency도 필요하다. 즉 CPU 왕복을 줄일 기회와 함께 queue 공간, 동기화, 불규칙하게 늘어나는 작업량을 GPU 쪽에서 관리하는 비용도 따라온다.

다만 “GPU가 혼자 프로그램 전체를 지휘한다”는 뜻은 아니다. 이 기능은 OpenCL 3.0 device에서 선택 사항이며, 지원 여부를 capability로 확인해야 한다. 구현과 workload에 따라 host에서 여러 작업을 묶어 제출하는 편이 더 단순하고 빠를 수도 있다. 주방장 비유의 한계는 child kernel도 결국 지원되는 queue와 execution resource 안에서 runtime의 scheduling을 받는다는 점이다.

Source note: [Khronos OpenCL API Specification — Device-Side Enqueue](https://registry.khronos.org/OpenCL/specs/3.0-unified/html/OpenCL_API.html#_device_side_enqueue)는 host의 직접 개입 없는 nested parallelism과 OpenCL 3.0에서의 optional 지원을 정의한다. [Khronos OpenCL C Specification — `enqueue_kernel`](https://registry.khronos.org/OpenCL/specs/3.0-unified/html/OpenCL_C.html#built-in-kernel-enqueue-functions)는 work-item이 device queue에 block을 넣고 여러 block을 enqueue할 수 있으며, 성공 또는 실패 상태를 반환한다고 명시한다.
