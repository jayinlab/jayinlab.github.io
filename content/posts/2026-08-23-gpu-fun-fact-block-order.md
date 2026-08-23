---
title: "GPU block은 왜 번호순으로 출발하지 않을까"
date: 2026-08-23
slug: "gpu-fun-fact-block-order"
draft: false
type: "note"
series: "gpu-fun-facts"
tags: ["gpu", "compute", "cuda", "thread-block", "scheduling"]
difficulty: "beginner"
---

CUDA kernel을 수천 개의 thread block으로 나누면, `block 0`부터 차례로 달릴 것 같은 인상을 준다. 하지만 번호는 작업의 주소표일 뿐 출발 순번표가 아니다. GPU는 어느 block을 먼저 실행할지 약속하지 않으며, 여러 block을 동시에 돌리거나 하나씩 처리해도 프로그램의 답이 같아야 한다.

이 무심한 규칙에는 꽤 실용적인 이유가 있다. GPU마다 SM 수가 다르고, 한 block이 쓰는 register와 shared memory 양도 다르다. 실행 순서를 고정하지 않으면 scheduler는 그날의 빈 자리에 맞춰 block을 배치할 수 있다. 같은 kernel이 작은 GPU에서는 여러 차례에 걸쳐, 큰 GPU에서는 더 많이 겹쳐 실행되어도 코드는 그대로다. 거대한 grid가 세대와 제품 크기를 넘어 확장되는 비결이기도 하다.

반대로 `block 1`이 `block 0`의 결과를 기다리는 식으로 짜면 위험하다. 기다리는 block들이 SM을 차지한 채, 정작 결과를 만들 block의 입장을 막을 수도 있다. block 안에서는 `__syncthreads()`로 협력할 수 있지만, 보통 block 사이의 확실한 경계가 필요하면 kernel을 끝내고 다음 kernel을 제출한다. 최신 CUDA에는 cooperative launch 같은 예외적 도구도 있지만, 필요한 조건을 명시적으로 갖춰야 한다.

왜 중요할까? “순서를 보장하지 않는다”는 제약은 GPU가 제멋대로라는 뜻이 아니다. **작업 조각을 독립적으로 만들면 hardware가 크기와 상황에 맞게 마음껏 재배치할 수 있다**는 확장성 계약에 가깝다.

Source note: [NVIDIA CUDA Programming Guide의 Programming Model](https://docs.nvidia.com/cuda/cuda-programming-guide/01-introduction/programming-model.html)은 thread block 사이 scheduling 순서가 보장되지 않으며, block들이 어떤 순서·병렬도·직렬 실행에서도 동작 가능해야 한다고 설명한다.
