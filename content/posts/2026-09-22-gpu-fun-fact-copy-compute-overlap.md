---
title: "GPU는 계산하면서 짐도 나를 수 있을까"
date: 2026-09-22
slug: "gpu-fun-fact-copy-compute-overlap"
draft: false
type: "note"
series: "gpu-fun-fact"
tags: ["gpu", "cuda", "memory-copy", "stream", "copy-engine"]
difficulty: "beginner"
---

요리사가 불 앞에서 스테이크를 굽는 동안 배달원이 다음 식재료를 가져온다면 주방은 덜 쉰다. GPU에도 비슷한 발상이 있다. 연산을 맡는 실행 자원과 host-device 전송을 처리하는 copy engine을 함께 움직이면, 한 데이터 조각을 계산하는 동안 다음 조각을 옮겨 전송 시간을 일부 숨길 수 있다.

하지만 `cudaMemcpyAsync()`라고 쓰는 순간 자동으로 두 일이 겹치는 것은 아니다. NVIDIA CUDA 문서가 제시하는 기본 조건은 꽤 구체적이다. GPU가 concurrent copy and compute를 지원해야 하고, host memory는 pinned memory여야 하며, 복사와 kernel을 서로 다른 non-default stream에 넣어야 한다. `asyncEngineCount`는 장치가 이런 비동기 copy engine 능력을 얼마나 갖췄는지 알려 주는 속성이다.

여기서 stream은 GPU에게 건네는 순서표다. 같은 stream 안의 작업은 순서대로 진행되므로 `복사 → 계산`을 한 줄에 놓으면 기다린다. 데이터를 여러 chunk로 나누고 서로 다른 stream에 배치하면, 첫 chunk의 kernel과 다음 chunk의 복사를 두 레인에서 진행할 여지가 생긴다. 충분히 큰 전송과 계산이 반복되는 pipeline에서 이 방식이 특히 쓸모 있다.

주방 비유의 한계도 분명하다. copy engine은 무제한 배달원이 아니며, PCIe 같은 전송 경로와 memory bandwidth를 다른 작업과 공유한다. `Async`는 host thread가 즉시 돌아올 수 있다는 뜻이지, GPU 내부에서 반드시 동시 실행된다는 보증이 아니다. 데이터 의존성, stream 동기화, 장치 능력, 작업 크기에 따라 실제로는 직렬화되거나 overlap 이득이 거의 없을 수도 있다.

출처: [NVIDIA CUDA C++ Best Practices Guide — Asynchronous and Overlapping Transfers with Computation](https://docs.nvidia.com/cuda/cuda-c-best-practices-guide/index.html#asynchronous-and-overlapping-transfers-with-computation), [NVIDIA CUDA C++ Programming Guide](https://docs.nvidia.com/cuda/cuda-c-programming-guide/index.html)
