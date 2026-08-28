---
title: "GPU 작업은 왜 순서표로 묶어 두면 빨라질까"
date: 2026-08-28
slug: "gpu-fun-fact-cuda-graph"
draft: false
type: "note"
series: "gpu-fun-facts"
tags: ["gpu", "compute", "cuda", "cuda-graph", "launch-overhead"]
difficulty: "beginner"
---

매일 같은 도시락을 만든다고 해 보자. 주문이 들어올 때마다 “밥을 담고, 반찬 두 개를 동시에 준비한 뒤, 모두 끝나면 뚜껑을 닫아 주세요”라고 처음부터 설명하는 것보다, 한 번 만든 **작업 순서표**를 건네는 편이 빠르다. GPU 계산도 작은 kernel과 memory copy를 같은 순서로 수천 번 반복하면, 계산 자체보다 CPU가 작업을 하나씩 제출하는 시간이 눈에 띌 수 있다.

CUDA Graph는 이 순서표에 가깝다. kernel launch, memory copy 같은 작업을 **node**로 만들고 “A가 끝나야 B 시작” 같은 dependency를 **edge**로 표현한다. 이 graph를 instantiate하면 실행 가능한 `cudaGraphExec_t`가 되고, CPU는 매번 모든 작업을 따로 제출하는 대신 준비된 graph를 다시 launch할 수 있다. 핵심은 GPU 계산을 마법처럼 빠르게 만드는 것이 아니라, 반복되는 제출과 dependency 설정의 CPU overhead를 줄이는 데 있다.

비유와 달리 순서표가 완전히 굳은 종이는 아니다. CUDA는 실행 graph의 일부 parameter나 node를 update할 길을 제공하지만, topology가 크게 달라지면 update가 제한되거나 다시 instantiate해야 할 수 있다. 또한 작업 하나가 이미 매우 길다면 launch overhead를 줄여도 전체 시간 차이는 작다. graph의 이득은 짧고 반복적인 workload일수록 잘 드러난다.

왜 중요할까? GPU 성능은 연산 장치의 속도만으로 정해지지 않는다. CPU가 충분히 빠르게 다음 일을 공급하지 못하면 GPU가 쉬게 된다. CUDA Graph는 “무엇을 계산할까”뿐 아니라 **반복되는 일을 어떻게 싸게 제출할까**도 API design의 일부라는 사례다.

Source note: [NVIDIA CUDA Programming Guide의 CUDA Graphs 장](https://docs.nvidia.com/cuda/cuda-programming-guide/04-special-topics/cuda-graphs.html)은 graph를 dependency로 연결된 operation들의 workflow로 설명하며, graph를 한 번 정의해 반복 launch하면 CPU launch cost를 줄일 수 있다고 설명한다. 실제 이득과 update 가능 범위는 graph topology, node 종류, workload와 platform에 따라 달라진다.
