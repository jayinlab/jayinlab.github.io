---
title: "GPU occupancy 100%는 왜 만점이 아닐까"
date: 2026-08-09
slug: "gpu-fun-fact-occupancy-score"
draft: false
type: "note"
series: "gpu-fun-facts"
tags: ["gpu", "compute", "occupancy", "register", "performance"]
difficulty: "beginner"
---

GPU profiler에서 `occupancy 100%`를 보면 시험에서 만점을 받은 듯한 기분이 든다. 하지만 occupancy는 성능 점수가 아니라, 한 compute unit에 **최대로 둘 수 있는 wave/warp 가운데 지금 몇 개가 resident인가**를 나타내는 비율이다. 좌석이 얼마나 찼는지를 말할 뿐, 승객이 얼마나 빨리 목적지에 도착하는지는 말하지 않는다.

occupancy가 중요한 이유는 GPU가 기다림을 숨기는 방식에 있다. 어떤 wave가 memory를 기다릴 때 다른 wave의 instruction을 실행할 수 있으므로, 대기 중인 후보가 너무 적으면 실행기가 놀기 쉽다. 그래서 아주 낮은 occupancy는 경고 신호가 된다. 다만 latency를 숨길 만큼의 wave가 이미 있다면 좌석을 더 채워도 빨라질 일이 없을 수 있다.

오히려 100%를 억지로 맞추다가 손해를 보기도 한다. resident wave 수를 늘리려고 thread당 register를 줄이면 중간값이 local/device memory로 spill되어 traffic이 늘 수 있다. 반대로 register를 넉넉히 쓴 kernel은 occupancy가 낮아도 계산을 덜 쪼개고 instruction-level parallelism으로 pipeline을 잘 채울 수 있다. AMD 문서도 matrix 연산 pipeline을 충분히 포화시키는 일부 고성능 kernel은 낮은 occupancy로 잘 달릴 수 있다고 설명한다.

왜 중요할까? occupancy는 “높을수록 무조건 좋다”가 아니라 **latency를 숨길 후보가 충분한가**를 묻는 계기판이다. 최종 판단은 kernel 시간, memory traffic, pipeline 활용률, spill 같은 실제 측정값과 함께 해야 한다. 빈 좌석이 보인다고 버스를 더 붐비게 만드는 것이 언제나 지름길은 아니다.

Source note: NVIDIA CUDA Best Practices Guide는 occupancy를 active warp와 가능한 최대 active warp의 비율로 정의하며, 높은 occupancy가 언제나 높은 성능을 뜻하지 않고 register를 더 허용하면 spill을 줄일 수 있다고 설명한다. AMD HIP performance 문서 역시 occupancy는 CU가 얼마나 차 있는지를 재는 값이지 얼마나 효율적으로 쓰이는지를 직접 나타내지는 않는다고 설명한다.
