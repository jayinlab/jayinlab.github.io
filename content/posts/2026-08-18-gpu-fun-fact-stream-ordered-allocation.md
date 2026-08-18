---
title: "GPU memory는 왜 줄을 서서 빌리고 반납할까"
date: 2026-08-18
slug: "gpu-fun-fact-stream-ordered-allocation"
draft: false
type: "note"
series: "gpu-fun-facts"
tags: ["gpu", "compute", "cuda", "memory", "runtime"]
difficulty: "beginner"
---

GPU kernel이 몇 microsecond 만에 끝나는 프로그램에서도 memory를 빌리고 반납하는 일이 의외로 큰 손님이 될 수 있다. 전통적인 CUDA의 `cudaMalloc`과 `cudaFree`는 단순한 서랍 열기처럼 보이지만, 실행 중인 여러 stream과 안전하게 맞물리기 위해 GPU 전체의 작업을 동기화할 수 있다. 작은 allocation을 자주 반복하면 계산보다 정리 시간이 더 눈에 띌 수도 있다.

그래서 CUDA에는 `cudaMallocAsync`와 `cudaFreeAsync`가 있다. 핵심은 이름의 “Async”보다 **memory의 수명을 stream의 줄에 함께 세운다**는 데 있다. 같은 stream에서 allocation, kernel, free를 차례로 넣으면 runtime은 “이 memory는 이 지점부터 쓸 수 있고, 저 지점 뒤에는 다시 빌려줘도 된다”는 시간표를 안다. CPU가 매번 GPU 전체를 세워 확인할 필요가 줄어든다.

반납된 memory는 곧바로 OS까지 돌아가는 대신 memory pool에 남아 다음 allocation에 재사용될 수 있다. 식당이 손님 한 명마다 의자를 창고 회사에 돌려보내지 않고, 빈 의자를 다음 손님에게 내주는 것과 비슷하다. 서로 다른 stream 사이에서도 event dependency가 분명하면 allocator가 그 순서를 보고 재사용할 수 있다.

왜 중요할까? GPU memory allocation 성능은 단지 “빠른 malloc 구현”의 문제가 아니다. runtime이 작업의 **순서와 수명**을 얼마나 많이 아느냐의 문제이기도 하다. 다만 다른 stream에서 memory를 쓴다면 allocation 이후, free 이전이라는 순서를 event 등으로 보장해야 한다. 편해진 대신 수명 계약이 사라진 것은 아니다.

Source note: [NVIDIA CUDA Programming Guide](https://docs.nvidia.com/cuda/cuda-programming-guide/04-special-topics/stream-ordered-memory-allocation.html)는 기존 `cudaMalloc`/`cudaFree`가 실행 중인 CUDA stream들을 동기화할 수 있으며, stream-ordered allocator가 allocation과 free를 stream 작업과 함께 순서화하고 memory pool을 통해 반환된 allocation을 재사용한다고 설명한다.
