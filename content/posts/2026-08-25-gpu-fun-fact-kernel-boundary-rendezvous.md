---
title: "GPU 계산은 왜 kernel 밖에서 단체 사진을 찍을까"
date: 2026-08-25
slug: "gpu-fun-fact-kernel-boundary-rendezvous"
draft: false
type: "note"
series: "gpu-fun-facts"
tags: ["gpu", "compute", "cuda", "kernel", "synchronization"]
difficulty: "beginner"
---

GPU kernel 안에는 수천 개의 thread가 있지만, 모두가 한순간에 모이는 것은 의외로 까다롭다. 같은 block의 thread라면 `__syncthreads()`로 기다릴 수 있지만, 서로 다른 block은 어느 SM에 언제 올라갈지 정해져 있지 않다. 먼저 실행된 block이 아직 출발하지도 못한 block을 기다리면, 기다리는 쪽이 GPU 자리를 차지한 채 길을 막을 수도 있다.

그래서 오랫동안 가장 단순하고 안전한 **전체 합류점**은 kernel의 끝이었다. 1번 kernel이 중간 결과를 쓰고 완전히 끝난 뒤 2번 kernel을 실행하면, 2번은 모든 block의 작업이 끝났다는 전제에서 다음 단계를 시작할 수 있다. reduction이나 여러 단계 simulation이 작은 kernel 여러 개로 나뉘는 데에는 이런 사정도 있다. kernel launch가 함수 호출이라기보다 “전원이 일을 마치면 다음 팀을 투입한다”는 경계 역할까지 맡은 셈이다.

물론 경계에는 비용이 있다. 다음 kernel을 준비하고, 이전 실행 상태가 주던 locality를 잃을 수 있다. CUDA의 Cooperative Groups가 `grid.sync()`를 제공한 이유도 resident block들이 kernel을 끝내지 않고 단계 사이에서 만날 수 있게 하려는 것이었다. 대신 모든 block이 함께 resident할 수 있도록 cooperative launch와 실행 규모 제약을 지켜야 한다. 공짜 장벽이 아니라, **안전하게 모두 도착할 자리까지 예약한 장벽**에 가깝다.

왜 중요할까? GPU program에서 kernel을 여러 개로 쪼갠 모습은 단순한 코드 정리만이 아니다. 때로는 hardware scheduler가 보장하지 않는 전역 rendezvous를 kernel 경계가 대신 표현한 흔적이다.

Source note: [NVIDIA CUDA Programming Guide의 Cooperative Groups 설명](https://docs.nvidia.com/cuda/cuda-programming-guide/04-special-topics/cooperative-groups.html)은 전통적으로 block 사이 synchronization이 kernel completion boundary에서 가능했으며, grid-wide synchronization에는 Cooperative Groups가 쓰인다고 설명한다. 같은 문서는 cooperative kernel이 모든 block의 동시 resident 가능성을 고려해 launch되어야 함도 안내한다.
