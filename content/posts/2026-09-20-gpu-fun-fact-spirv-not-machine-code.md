---
title: "SPIR-V는 왜 GPU의 기계어가 아닐까"
date: 2026-09-20
slug: "gpu-fun-fact-spirv-not-machine-code"
draft: false
type: "note"
series: "gpu-fun-fact"
tags: ["gpu", "spir-v", "compiler", "vulkan", "opencl"]
difficulty: "beginner"
---

해외여행 때 쓰는 공항 환승표를 떠올려 보자. 한국어로 여행 계획을 적어 가는 것보다 정해진 코드가 붙은 표를 건네면 여러 공항 시스템이 다루기 쉽다. 그렇다고 그 표가 비행기 조종 장치에 바로 들어가는 명령은 아니다. SPIR-V도 이름과 `.spv`라는 binary 모습 때문에 GPU 기계어처럼 보이지만, 실제로는 compiler와 driver 사이에서 건네는 **binary intermediate representation**이다.

shader language나 compute language를 만드는 앞단 compiler는 코드를 SPIR-V module로 바꿀 수 있다. module에는 `OpLoad`, `OpIAdd` 같은 instruction뿐 아니라 entry point, execution model, storage class 같은 정보가 함께 들어간다. Vulkan이나 OpenCL 쪽 driver는 이 중간 표현을 받아 대상 GPU의 실제 ISA와 실행 방식에 맞게 더 낮춘다. 그래서 같은 SPIR-V가 여러 GPU 계열로 향할 수 있지만, 어느 GPU에서나 그대로 실행되는 공통 기계어인 것은 아니다.

재미있는 장치는 `OpCapability`다. module은 자신이 쓰는 기능을 앞부분에서 선언하고, validator는 실제 사용이 선언 범위 안인지 확인할 수 있다. 하지만 탑승권에 목적지가 적혀 있어도 모든 공항에 들어갈 수는 없듯, 최종 허용 범위는 client API의 execution environment가 정한다. Khronos 사양도 client API가 추가 규칙·제한·capability를 지정하며, 지원하지 않는 capability를 선언한 module은 거부할 수 있다고 설명한다.

이 비유의 한계는 SPIR-V가 단순한 운송 포장지가 아니라 SSA 형태의 값, control flow, memory semantics까지 담는 정식 언어라는 점이다. 또한 binary라고 해서 runtime compile 작업이 사라진다는 뜻도 아니다. SPIR-V는 서로 다른 언어와 도구가 만나는 표준화된 환승 지점이지, 모든 GPU가 직접 읽는 마지막 종착역은 아니다.

출처: [Khronos SPIR-V Specification](https://registry.khronos.org/SPIR-V/specs/unified1/SPIRV.html), [Khronos SPIR-V Guide — What is SPIR-V](https://github.com/KhronosGroup/SPIRV-Guide/blob/main/chapters/what_is_spirv.md)
