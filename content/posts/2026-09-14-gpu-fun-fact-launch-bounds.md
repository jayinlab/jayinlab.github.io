---
title: "GPU kernel에 붙는 정원 표시는 누구를 위한 걸까"
date: 2026-09-14
slug: "gpu-fun-fact-launch-bounds"
draft: false
type: "note"
series: "gpu-fun-facts"
tags: ["gpu", "cuda", "compiler", "register", "occupancy"]
difficulty: "beginner"
---

작은 식당의 좌석이 100개라고 해도, 한 손님이 의자를 열 개씩 차지하면 단체를 많이 받을 수 없다. GPU의 register file도 비슷하다. SM 안에는 빠른 register가 아주 많지만 무한하지 않고, 동시에 머무는 thread들이 그것을 나눠 쓴다.

CUDA kernel의 각 thread가 계산 중간값을 많이 간직하면 compiler는 더 많은 register를 배정할 수 있다. 그런데 register는 block 단위로 확보되므로, thread 하나의 몫이 커질수록 같은 SM에 동시에 resident할 수 있는 block 수가 줄 수 있다. 그러면 한 warp가 memory를 기다릴 때 대신 실행할 다른 warp가 부족해져 latency를 숨기기 어려워진다.

여기서 이름부터 흥미로운 `__launch_bounds__`가 등장한다. `__launch_bounds__(maxThreadsPerBlock, minBlocksPerMultiprocessor)`처럼 kernel에 표시하면, programmer가 예상하는 최대 block 크기와 SM마다 원하는 최소 resident block 수를 compiler에 알려 준다. compiler는 이 조건에서 launch가 가능하도록 per-thread register 사용을 조절할 수 있다. 즉 이것은 GPU에게 “무조건 이만큼 동시에 실행하라”는 현장 지시가 아니라, compiler의 register 예산표에 가까운 힌트이자 제약이다.

왜 중요할까? register를 아껴 resident warp를 늘리면 latency hiding에 유리할 수 있지만, 무리하게 줄이면 값이 local memory로 spill되어 오히려 느려질 수 있다. NVIDIA 문서도 높은 occupancy가 언제나 더 높은 성능을 뜻하지는 않는다고 선을 긋는다. 결국 좋은 정원표는 숫자가 큰 표가 아니라, 실제 kernel을 측정해 고른 표다.

다만 식당 비유에는 한계가 있다. 실제 occupancy는 register뿐 아니라 shared memory, block 크기, architecture의 allocation granularity에도 좌우된다. `__launch_bounds__`가 실행 순서나 정확한 성능을 보장하는 것도 아니다.

Source note: [NVIDIA CUDA C++ Best Practices Guide — Registers and Register Pressure](https://docs.nvidia.com/cuda/cuda-c-best-practices-guide/index.html#registers)는 register가 concurrent thread 사이에 분할되며 `__launch_bounds__`로 per-thread register 상한에 영향을 줄 수 있다고 설명한다. [같은 가이드의 Occupancy 절](https://docs.nvidia.com/cuda/cuda-c-best-practices-guide/index.html#occupancy)은 register 사용량이 resident block 수를 제한할 수 있고, 높은 occupancy가 항상 높은 성능을 뜻하지는 않는다고 명시한다.
