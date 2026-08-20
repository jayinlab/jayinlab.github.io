---
title: "같은 GPU kernel은 왜 매번 같은 시간이 아닐까"
date: 2026-08-20
slug: "gpu-fun-fact-floating-clock"
draft: false
type: "note"
series: "gpu-fun-facts"
tags: ["gpu", "compute", "nvidia", "clock", "profiling", "power"]
difficulty: "beginner"
---

똑같은 GPU에서 똑같은 kernel을 열 번 돌렸는데 시간이 조금씩 다르다. 측정 코드가 틀린 것 같지만, 범인은 종종 **움직이는 clock**이다. GPU는 일이 없을 때 clock을 낮춰 열과 전력을 아끼고, 작업이 시작되면 여유가 허락하는 만큼 올린다.

여기에는 묘한 준비 운동이 있다. NVIDIA의 CUPTI 문서는 idle 뒤 처음 들어온 작업에서는 clock이 즉시 최고 속도까지 오르지 않을 수 있다고 설명한다. 반대로 긴 작업 중에는 온도나 전력 한도에 닿아 clock이 내려갈 수도 있다. 같은 kernel이라도 ‘막 잠에서 깬 GPU’와 ‘이미 뜨겁게 달리는 GPU’가 서로 다른 stopwatch 기록을 내는 셈이다.

그래서 profiler는 단순히 시간만 재지 않는다. current clock, temperature, power 같은 주변 조건도 함께 본다. 재현성이 중요한 실험에서는 미리 몇 번 실행해 GPU를 warm-up하거나 clock을 고정하기도 한다. 다만 고정 clock은 opportunistic boost를 포기할 수 있어, 가장 빠른 평균값과 가장 안정적인 측정값이 같은 목표는 아니다.

왜 중요할까? 1~2% 차이를 optimization 성과라고 말하려면 kernel 바깥의 날씨부터 확인해야 한다. GPU benchmark는 code 경주인 동시에, 전력과 열을 관리하는 작은 기상 관측이기도 하다.

Source note: [NVIDIA CUPTI reproducibility guide](https://docs.nvidia.com/cupti/main/main.html#reproducibility)는 idle 뒤 clock 상승 지연과 power·thermal 조건에 따른 변동, fixed clock의 재현성 효과를 설명한다. [NVIDIA TensorRT performance guide](https://docs.nvidia.com/deeplearning/tensorrt/latest/performance/benchmarking.html#gpu-clock-locking-and-floating-clock)는 floating clock과 throttling이 짧은 kernel 측정을 흔들 수 있으며, 안정성과 최고 평균 성능 사이에 tradeoff가 있다고 안내한다.
