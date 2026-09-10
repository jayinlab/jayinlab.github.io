---
title: "GPU 컴파일러는 왜 8명, 16명, 32명을 한 줄에 세울까"
date: 2026-09-10
slug: "gpu-fun-fact-simd-subgroup-width"
draft: false
type: "note"
series: "gpu-fun-facts"
tags: ["gpu", "intel", "sycl", "compiler", "simd", "subgroup"]
difficulty: "beginner"
---

놀이공원 안내원이 손님을 한 명씩 데려가기보다 8명, 16명, 32명씩 줄 세워 같은 구호에 맞춰 움직인다고 해 보자. GPU 컴파일러도 수많은 작은 일을 이렇게 **한 줄의 단체 동작**으로 바꾼다. 흥미로운 점은 줄의 폭이 source code에 항상 적혀 있는 것이 아니라, compiler가 고르기도 한다는 것이다.

Intel GPU의 SYCL 설명에서 손님 한 명은 work-item, 한 줄은 sub-group, 안내원의 구호는 SIMD instruction에 해당한다. compiler는 여러 work-item을 vectorize해 하나의 vector engine thread가 동시에 처리하도록 묶는다. Intel 문서의 예에서는 device와 kernel 조건에 따라 SIMD 폭, 즉 최대 sub-group 폭으로 8·16·32가 가능하며, 기본값은 compiler가 device 정보와 heuristic으로 선택한다.

폭이 넓으면 한 명령이 더 많은 일을 맡을 수 있지만, 무조건 큰 줄이 이기는 것은 아니다. 줄 안에서 `if`의 방향이 갈리면 한쪽 lane이 쉬는 동안 다른 경로를 실행하고, 나중에 반대쪽을 처리할 수 있다. 반대로 연속 주소를 함께 읽고 쓰면 vector memory operation을 효율적으로 만들 여지가 있다. 그래서 sub-group 폭은 단순한 숫자가 아니라 **분기 모양과 memory access를 hardware 폭에 맞추는 compiler의 선택**이다.

다만 사람 줄처럼 각 work-item이 완전히 독립적으로 발을 떼는 것은 아니다. 실제 폭과 지원 값은 device에 의존하고, 마지막 sub-group은 work-group 크기에 따라 일부 lane만 찰 수도 있다. 넓은 폭을 강제로 지정한다고 성능이 보장되지도 않는다. 비유의 핵심은 GPU가 작은 일을 없애는 게 아니라, 여러 일을 하나의 SIMD 명령줄에 포장한다는 데 있다.

Source note: [Intel oneAPI GPU Optimization Guide — Sub-Groups and SIMD Vectorization](https://www.intel.com/content/www/us/en/docs/oneapi/optimization-guide-gpu/2024-2/sub-groups-and-simd-vectorization.html)는 compiler가 여러 work-item을 sub-group으로 vectorize하고, device 정보와 heuristic 또는 kernel 요청에 따라 SIMD 폭을 선택한다고 설명한다. 또한 lane divergence가 dynamic instruction 수를 늘릴 수 있고, 지원 sub-group 크기는 device-dependent라고 명시한다.
