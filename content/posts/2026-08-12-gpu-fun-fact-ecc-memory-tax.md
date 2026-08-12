---
title: "GPU memory는 왜 ECC를 켜면 조금 줄어들까"
date: 2026-08-12
slug: "gpu-fun-fact-ecc-memory-tax"
draft: false
type: "note"
series: "gpu-fun-facts"
tags: ["gpu", "compute", "memory", "ecc", "reliability"]
difficulty: "beginner"
---

긴 계산을 돌린 GPU에게 가장 무서운 일은 느려지는 것보다 **조용히 틀리는 것**일 수 있다. memory에 저장된 bit 하나가 뒤집혔는데 program이 눈치채지 못하면, 며칠짜리 simulation의 마지막 숫자만 그럴듯하게 잘못될 수도 있다. 그래서 datacenter GPU는 흔히 ECC(Error-Correcting Code)로 memory data에 여분의 검사 정보를 붙인다.

ECC는 단순한 오류 알람이 아니다. 보통 작은 오류는 어느 bit가 잘못됐는지 찾아 고칠 수 있고, 더 큰 오류는 적어도 감지해 “이 결과를 믿으면 안 된다”고 알린다. 마치 화물 상자마다 내용물이 온전한지 확인할 수 있는 봉인을 함께 싣는 셈이다. 다만 그 봉인도 공짜로 저장되지는 않는다.

특히 ECC용 공간을 일반 DRAM에서 함께 쓰는 GDDR 계열 GPU에서는 사용 가능한 memory가 줄고, 검사 bit를 함께 옮기느라 bandwidth에도 부담이 생길 수 있다. NVIDIA의 CUDA Best Practices Guide는 이런 경우 가용 DRAM이 6.25% 줄 수 있으며, 과거 측정에서 effective bandwidth가 약 20% 낮아진 사례를 설명한다. 반면 HBM2처럼 ECC용 자원을 따로 둔 memory는 같은 식의 용량 손실을 피할 수 있다. 즉 “ECC를 켜면 무조건 20% 느리다”가 아니라 memory 구조와 access pattern에 따라 비용이 달라진다.

왜 중요할까? ECC로 사라진 몇 GB는 낭비가 아니라, 긴 scientific computing과 AI training에서 결과를 다시 믿기 위해 지불한 보험료다. GPU 사양의 memory 용량과 bandwidth를 볼 때도 chip 숫자만큼이나 ECC의 저장 방식과 workload의 access pattern을 함께 봐야 한다.

Source note: NVIDIA CUDA C++ Best Practices Guide의 bandwidth 절은 GDDR memory에서 ECC bit 저장으로 가용 DRAM이 6.25% 감소할 수 있고, ECC traffic이 effective bandwidth에 access-pattern-dependent overhead를 만들 수 있다고 설명한다. 같은 문서는 HBM2가 dedicated ECC resources를 제공해 용량 측면의 ECC overhead를 피한다고 구분한다.
