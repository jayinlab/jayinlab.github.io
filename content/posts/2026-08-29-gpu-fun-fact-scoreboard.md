---
title: "GPU는 왜 기다리는 thread를 깨우지 않고 다른 일을 할까"
date: 2026-08-29
slug: "gpu-fun-fact-scoreboard"
draft: false
type: "note"
series: "gpu-fun-facts"
tags: ["gpu", "compute", "scheduler", "scoreboard", "latency-hiding"]
difficulty: "beginner"
---

분식집에서 라면 물이 끓지 않았다고 냄비를 계속 들여다보면 다른 주문까지 늦어진다. 능숙한 주방은 그 주문표에 ‘재료 기다리는 중’ 표시를 해 두고, 당장 만들 수 있는 김밥으로 손을 옮긴다. GPU도 memory에서 data가 도착하지 않은 thread 묶음을 붙잡고 재촉하기보다, 준비된 다른 묶음의 instruction을 실행한다.

이때 주문표 역할을 하는 장치를 흔히 **scoreboard**라고 부른다. NVIDIA GPU를 예로 들면 scheduler는 여러 warp 가운데 다음 instruction의 operand와 실행 자원이 준비된 **eligible warp**를 골라 issue한다. 어떤 warp가 load 결과를 기다리면 dependency가 풀릴 때까지 후보에서 빠지고, 그 사이 다른 warp가 계산을 진행한다. 그래서 GPU에는 같은 일을 하는 thread를 많이 resident 상태로 두는 것이 중요하다. 기다림 자체를 없애지는 못해도 다른 warp의 일로 그 시간을 가리는 **latency hiding**이 가능해지기 때문이다.

다만 ‘주문표 하나’라는 비유는 단순화다. 실제 readiness 추적과 scheduling 구조는 GPU 세대와 제조사마다 다르며, warp가 멈추는 이유도 memory dependency뿐 아니라 execution unit, barrier, instruction fetch 등 다양하다. NVIDIA Nsight Compute의 `long scoreboard` stall도 특히 L1TEX 계열 operation의 data dependency를 기다린다는 진단 이름이지, 모든 GPU stall을 뜻하지는 않는다.

왜 중요할까? 느린 load 하나를 발견했을 때 “memory를 더 빠르게”만 생각하면 절반만 본 셈이다. 충분한 독립 warp가 있었는지, register 사용량 때문에 resident warp 수가 줄지는 않았는지도 함께 봐야 한다. GPU의 빠름은 기다림이 없는 데서가 아니라, **기다리는 동안 다른 일을 꺼내는 능력**에서도 나온다.

Source note: [NVIDIA Nsight Compute Profiling Guide의 Scheduler Statistics](https://docs.nvidia.com/nsight-compute/ProfilingGuide/index.html#scheduler-statistics)는 scheduler가 active warp 중 ready한 eligible warp에서 instruction을 issue한다고 설명한다. 같은 문서의 warp stall 설명은 `long scoreboard`를 L1TEX operation의 data dependency 대기로 정의한다. 정확한 scheduler와 dependency-tracking 구현은 architecture별로 달라질 수 있다.
