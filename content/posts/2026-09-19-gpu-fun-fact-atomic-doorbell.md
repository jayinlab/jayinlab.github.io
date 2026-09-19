---
title: "GPU의 atomic은 왜 초인종만 누를까"
date: 2026-09-19
slug: "gpu-fun-fact-atomic-doorbell"
draft: false
type: "note"
series: "gpu-fun-fact"
tags: ["gpu", "cuda", "atomic", "memory-ordering"]
difficulty: "beginner"
---

식당 주방에서 요리가 끝나면 카운터의 숫자를 하나 올린다고 해 보자. 숫자가 손님 수만큼 찼다면 마지막 직원은 “모든 접시가 나왔구나”라고 생각할 것이다. 그런데 GPU에서는 숫자표가 먼저 보이고, 정작 접시는 아직 주방 안에 있을 수 있다.

CUDA kernel에서도 비슷한 일이 생긴다. 여러 thread block이 각자 계산한 partial sum을 global memory에 쓰고, 완료 counter를 atomic increment로 올린다. `atomicInc()`는 여러 block이 같은 counter를 동시에 망가뜨리지 않고 갱신하게 해 준다. 하지만 그 atomic 연산만으로, 그전에 쓴 partial sum까지 다른 thread에게 먼저 관찰된다고 보장되지는 않는다.

이유는 GPU의 memory model이 weakly ordered이기 때문이다. 한 thread가 실행한 memory write의 순서와 다른 thread가 관찰하는 순서는 같지 않을 수 있다. 그래서 NVIDIA의 공식 예제는 결과를 쓴 뒤 `__threadfence()`를 호출하고, 그다음 counter를 올린다. device scope fence는 호출 전 write가 호출 후 write보다 먼저 관찰되도록 순서를 세운다. counter는 “완료를 알리는 초인종”, fence는 “접시를 먼저 내보내라”는 규칙인 셈이다.

다만 초인종 비유의 한계도 있다. fence 자체는 모든 thread를 한곳에 세우는 barrier가 아니며, 혼자서 다른 thread의 대기나 데이터 visibility 전체를 해결하지도 않는다. 올바른 producer-consumer 통신에는 알맞은 scope, visibility 수단, synchronization protocol이 함께 필요하다. atomic이라는 이름이 곧 “주변 memory까지 모두 정리됨”을 뜻하지 않는다는 점이 핵심이다.

출처: [NVIDIA CUDA C++ Programming Guide — Memory Fence Functions](https://docs.nvidia.com/cuda/cuda-c-programming-guide/index.html#memory-fence-functions)
