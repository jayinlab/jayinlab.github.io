---
title: "GPU register가 넘치면 어디로 흘러갈까"
date: 2026-08-30
slug: "gpu-fun-fact-register-spill"
draft: false
type: "note"
series: "gpu-fun-facts"
tags: ["gpu", "compute", "register", "local-memory", "compiler"]
difficulty: "beginner"
---

요리사가 자주 쓰는 재료를 작은 조리대 위에 올려 두면 손이 빠르다. 하지만 재료를 너무 많이 펼치면 일부는 멀리 있는 창고로 옮겨야 한다. GPU의 각 thread도 계산 중인 값을 아주 빠른 **register**에 두지만, 필요한 값이 너무 많으면 compiler가 일부를 memory로 내보낼 수 있다. 이것이 **register spilling**이다.

여기서 조리대는 thread가 쓰는 register, 재료는 중간값, 창고 왕복은 spill load/store에 대응한다. CUDA 용어로 spill이 향하는 곳은 **local memory**다. 이름만 보면 GPU 가까이에 붙은 작은 memory 같지만, 이 공간은 각 thread에게 사적으로 보일 뿐 물리적으로는 device memory에 놓인다. 따라서 register 접근보다 훨씬 비싼 memory instruction이 생기며, 실제 비용은 cache hit와 access pattern에 따라 달라진다.

재미있는 점은 “register를 많이 쓰면 spill만 생긴다”가 아니라는 것이다. 한 thread의 register 사용량이 늘면 한 SM에 동시에 resident할 수 있는 warp 수도 줄어 **occupancy**와 latency hiding이 먼저 나빠질 수 있다. Compiler는 code를 register에 담아 빠르게 계산하는 이익과, resident warp 수 및 spill 위험 사이에서 줄타기한다.

다만 창고 비유에는 한계가 있다. compiler가 register 수를 완전히 기계적으로 정하는 것도 아니고, register 사용량이 많다고 언제나 느린 것도 아니다. spill을 피하려고 register를 과하게 제한하면 오히려 재계산이나 추가 memory access가 늘 수 있다. 그래서 좋은 tuning은 숫자를 무조건 줄이는 일이 아니라, compiler의 register·spill 보고서와 실제 profile을 함께 보는 일이다.

Source note: [NVIDIA CUDA C++ Best Practices Guide의 Register Pressure](https://docs.nvidia.com/cuda/cuda-c-best-practices-guide/index.html#register-pressure)는 register pressure가 높으면 occupancy가 제한되거나 register spilling이 발생할 수 있다고 설명한다. [CUDA C++ Programming Guide의 Local Memory](https://docs.nvidia.com/cuda/cuda-c-programming-guide/index.html#local-memory)는 local memory가 device memory에 위치하며 register보다 높은 latency와 낮은 bandwidth를 가진다고 설명한다. 구체적인 배치와 cache 동작은 GPU architecture와 compiler에 따라 달라진다.
