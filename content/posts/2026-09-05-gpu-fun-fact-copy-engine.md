---
title: "GPU는 계산하면서 짐도 나를 수 있을까"
date: 2026-09-05
slug: "gpu-fun-fact-copy-engine"
draft: false
type: "note"
series: "gpu-fun-facts"
tags: ["gpu", "cuda", "copy-engine", "stream", "data-transfer"]
difficulty: "beginner"
---

식당 주방에서 요리사가 매번 창고까지 재료를 가지러 간다면 불 앞은 자꾸 비게 된다. 그래서 큰 주방은 재료를 나르는 직원과 요리사를 따로 둔다. GPU에도 비슷한 분업이 있다. 계산 core가 kernel을 실행하는 동안, **copy engine**이 CPU memory와 GPU memory 사이의 data transfer를 맡을 수 있다.

여기서 요리사는 GPU의 compute engine, 운반 직원은 DMA 계열 copy engine, 주문표는 stream이다. CUDA에서 `cudaMemcpyAsync()`와 kernel을 서로 다른 non-default stream에 넣고, host 쪽 memory를 pinned memory로 준비하면, 이를 지원하는 GPU는 복사와 계산을 겹쳐 실행할 수 있다. 큰 입력을 여러 chunk로 나눠 “다음 chunk를 옮기는 동안 현재 chunk를 계산”하는 pipeline을 만들면 전송 시간이 계산 뒤에 일부 숨는다. CUDA는 이런 capability를 `asyncEngineCount`로도 알린다.

왜 중요할까? GPU의 연산량만 줄이지 않아도, 놀고 있던 복사 통로와 계산 통로를 함께 쓰면 전체 처리 시간이 짧아질 수 있다. 영상 frame, simulation batch, 대규모 tensor처럼 데이터가 계속 들어오고 나가는 작업에서 특히 떠올릴 만한 구조다.

다만 직원이 둘이라고 통로까지 둘인 것은 아니다. PCIe나 memory bandwidth를 함께 다투거나, chunk가 너무 작아 scheduling overhead가 커지면 기대한 overlap이 나오지 않는다. `Async`라는 이름도 자동 동시 실행 보증이 아니다. hardware capability, pinned memory, stream 배치, dependency가 모두 맞아야 한다. 식당 비유와 달리 실제 engine 수와 양방향 복사 가능 여부도 GPU마다 다르다.

Source note: [NVIDIA CUDA C++ Best Practices Guide의 asynchronous transfer 절](https://docs.nvidia.com/cuda/cuda-c-best-practices-guide/index.html#asynchronous-and-overlapping-transfers-with-computation)은 `cudaMemcpyAsync()`가 stream을 받는 non-blocking variant이며 pinned host memory를 요구한다고 설명한다. 또한 concurrent copy-and-compute 지원은 `asyncEngineCount`로 확인하며, device 위에서 transfer와 kernel을 겹치려면 서로 다른 non-default stream이 필요하다고 명시한다.
