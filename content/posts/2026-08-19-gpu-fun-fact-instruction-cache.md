---
title: "GPU도 code가 너무 길면 길을 잃을까"
date: 2026-08-19
slug: "gpu-fun-fact-instruction-cache"
draft: false
type: "note"
series: "gpu-fun-facts"
tags: ["gpu", "compute", "amd", "architecture", "cache", "compiler"]
difficulty: "beginner"
---

GPU cache라고 하면 보통 kernel이 읽는 array부터 떠올린다. 그런데 GPU에는 **실행할 명령 자체를 보관하는 instruction cache**도 있다. 수많은 thread가 같은 kernel code를 따라가는 동안, compute unit이 매번 먼 memory에서 명령을 가져온다면 계산 장치가 code 배달을 기다리게 된다.

AMD 문서에서 L1I는 kernel instruction을 저장해 fetch latency와 L2 cache traffic을 줄이는 곳으로 소개된다. profiler에도 instruction cache hit rate가 따로 있다. GPU에게 code는 추상적인 주문서만이 아니라, 실제로 공급되어야 하는 데이터이기도 하다.

여기서 반전이 생긴다. compiler가 loop를 많이 펼치거나 여러 함수를 한 kernel에 합치면 branch나 호출은 줄어들지만, binary는 커질 수 있다. 자주 쓰는 code가 cache에 머물지 못하면 miss가 늘어난다. AMD profiler 문서도 낮은 hit rate가 큰 kernel code나 divergent control flow와 관련될 수 있다고 설명한다.

왜 중요할까? “큰 kernel 하나로 합치면 launch가 줄어 무조건 빠르다”는 공식은 없다. fusion과 unrolling은 memory traffic이나 제어 비용을 아끼지만, register와 code 크기라는 계산서도 만든다. 그래서 GPU 최적화는 profiler를 보기 전에 결론 내리기 어렵다.

Source note: [AMD HIP hardware implementation](https://rocm.docs.amd.com/projects/HIP/en/develop/understand/hardware_implementation.html)은 L1I가 kernel instruction을 저장해 fetch latency와 L2 pressure를 줄인다고 설명한다. [ROCm Compute Profiler](https://rocm.docs.amd.com/projects/rocprofiler-compute/en/develop/conceptual/rdna/system-speed-of-light.html)는 instruction cache hit rate가 낮을 때 큰 kernel code 또는 divergent control flow를 살펴볼 수 있다고 안내한다.
