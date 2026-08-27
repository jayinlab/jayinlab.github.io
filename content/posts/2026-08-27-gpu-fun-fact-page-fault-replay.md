---
title: "GPU도 page fault가 나면 다시 출발할까"
date: 2026-08-27
slug: "gpu-fun-fact-page-fault-replay"
draft: false
type: "note"
series: "gpu-fun-facts"
tags: ["gpu", "compute", "cuda", "unified-memory", "page-fault"]
difficulty: "beginner"
---

GPU가 필요한 data를 찾으러 서랍을 열었는데, 그 서랍이 다른 방의 CPU memory에 있다고 해 보자. 예전에는 작업을 시작하기 전에 programmer가 `cudaMemcpy`로 서랍 내용을 GPU 쪽에 옮겨 두는 방식이 흔했다. CUDA Unified Memory는 같은 pointer를 CPU와 GPU가 함께 쓰게 했지만, 그렇다고 모든 byte가 언제나 양쪽에 동시에 놓이는 것은 아니다.

지원되는 GPU에서는 thread가 아직 GPU memory에 없는 managed page를 건드리면 **GPU page fault**가 발생할 수 있다. 여기서 서랍은 virtual-memory page, 다른 방은 CPU 또는 다른 processor의 memory다. fault를 받은 runtime과 driver는 접근을 잠시 멈추고 page의 위치와 mapping을 준비한다. 필요한 경우 data를 GPU 쪽으로 migrate하고 GPU page table을 갱신한 뒤, fault를 냈던 접근을 replay해 계산을 이어 간다. CPU의 demand paging과 닮은 생각을 대규모 병렬 processor에 가져온 셈이다.

다만 비유처럼 thread 하나만 조용히 기다렸다가 곧바로 돌아오는 것은 아니다. GPU는 많은 thread가 묶여 실행되고, fault 처리와 migration에는 driver 작업, page 단위 전송, mapping 변경이 따른다. 같은 page를 CPU와 GPU가 번갈아 쓰면 data가 오가며 성능이 크게 흔들릴 수도 있다. Unified Memory가 copy를 없앤다기보다, **copy와 placement의 결정을 system이 필요할 때 수행하게 만든다**고 보는 편이 정확하다.

왜 중요할까? 편한 단일 pointer 뒤에도 memory가 실제로 어디에 있고 언제 옮겨지는지라는 비용은 남는다. page fault replay는 GPU가 계산만 빠르게 반복하는 장치에서, virtual memory의 예외를 처리하고 다시 진행할 수 있는 processor로 확장된 모습을 보여 준다.

Source note: [NVIDIA Pascal Tuning Guide의 Unified Memory 설명](https://docs.nvidia.com/cuda/pascal-tuning-guide/index.html#unified-memory)과 [CUDA Programming Guide의 Unified Memory 장](https://docs.nvidia.com/cuda/cuda-programming-guide/04-special-topics/unified-memory.html)은 page faulting을 지원하는 GPU에서 managed memory를 demand paging으로 migrate할 수 있음을 설명한다. 실제 이동과 성능은 platform, hardware, access pattern 및 memory 정책에 따라 달라진다.
