---
title: "GPU memory는 왜 여러 계산대로 나뉘어 있을까"
date: 2026-08-21
slug: "gpu-fun-fact-memory-channels"
draft: false
type: "note"
series: "gpu-fun-facts"
tags: ["gpu", "compute", "amd", "memory", "cache", "bandwidth"]
difficulty: "beginner"
---

GPU memory를 거대한 창고 하나라고 상상하기 쉽지만, 실제 data가 지나가는 길은 여러 갈래다. 여러 memory channel과 L2 channel이 동시에 요청을 처리해야 수많은 compute unit을 먹여 살릴 수 있기 때문이다. 넓은 도로 하나보다 계산대가 여러 개인 대형 마트에 가깝다.

AMD의 CDNA 설명을 보면 L2는 독립적인 여러 channel로 나뉘고, 주소는 channel 사이에 interleave된다. 연속된 주소를 읽을 때 traffic이 한곳에만 몰리지 않도록 hardware가 주소 공간을 흩어 놓는 셈이다. 그래서 “VRAM bandwidth가 크다”는 말은 memory chip만 빠르다는 뜻이 아니다. 여러 길에 요청을 고르게 보내고, L2 miss를 거쳐 HBM까지 가는 흐름 전체가 함께 움직여야 그 숫자에 가까워진다.

여기서 재미있는 반전이 생긴다. 주소는 달라도 나쁜 stride나 편향된 배치는 특정 channel에 요청을 몰아 대기열을 만들 수 있다. 반대로 무조건 흩뜨리는 것도 정답은 아니다. MI300 같은 GPU는 memory를 완전히 interleave해 bandwidth를 넓히는 mode와, 가까운 memory 영역을 묶어 locality를 높이는 partition mode를 제공한다. 넓게 나눠 쓰기와 가까이 붙여 쓰기 사이의 선택인 셈이다.

왜 중요할까? 같은 byte 수를 읽는 두 kernel도 주소 배치에 따라 bandwidth가 달라질 수 있다. GPU optimization에서 “얼마나 읽었나”만큼 “그 요청이 몇 개의 계산대로 퍼졌나”가 중요한 이유다.

Source note: [AMD HIP hardware implementation](https://rocm.docs.amd.com/projects/HIP/en/docs-7.2.0/understand/hardware_implementation.html)은 CDNA L2 channel과 address interleaving을 설명한다. [AMD HIP device topology guide](https://rocm.docs.amd.com/projects/HIP/en/docs-7.14.0/how-to/hipDeviceProperties.html)는 HBM의 NPS1 interleaving과 NPS4/NPS8 locality tradeoff를 정리한다.
