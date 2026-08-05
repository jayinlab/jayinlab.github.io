---
title: "GPU register는 왜 개인 수첩이면서 공동 예산일까"
date: 2026-08-05
slug: "gpu-fun-fact-register-budget"
draft: false
type: "note"
series: "gpu-fun-facts"
tags: ["gpu", "cuda", "compute", "register", "occupancy"]
difficulty: "beginner"
---

GPU kernel의 local variable은 흔히 각 thread의 register에 놓인다. 그래서 register를 “thread마다 가진 아주 빠른 개인 수첩”이라고 설명한다. 실제로 thread들은 저마다 자기 register state를 가진다. 여기까지만 보면 한 thread가 수첩을 몇 장 쓰든 다른 thread와는 상관없어 보인다.

하지만 hardware의 장부는 다르다. register file은 SM 안에 있는 유한한 창고이고, 동시에 머무는 수많은 thread가 그것을 나눠 쓴다. 한 thread가 필요한 register 수에 block의 thread 수를 곱하면, 대략 그 block을 들여놓는 데 필요한 register 예산이 된다. 개인 수첩이지만 종이는 공동 창고에서 꺼내 오는 셈이다.

그래서 계산이 복잡한 kernel이 register를 많이 쓰면 뜻밖의 일이 생긴다. instruction 하나하나는 빠른 register를 잘 활용해도, SM에 동시에 올릴 수 있는 block이나 warp 수가 줄 수 있다. 반대로 compiler에게 register 수를 무조건 줄이라고 압박하면 일부 값이 더 느린 memory로 밀려나는 register spilling이 생길 수 있다. “register는 적을수록 좋다”도, “많을수록 좋다”도 정답이 아니다.

이 tradeoff가 흥미로운 이유는 source code의 사소한 임시 변수와 함수 inline 결정이 hardware의 입장권 수를 바꿀 수 있기 때문이다. compiler는 계산을 빠르게 하려고 값을 가까이 붙잡아 두고 싶고, scheduler는 더 많은 warp를 동시에 머물게 해 latency를 숨기고 싶다. 둘이 같은 register 창고를 두고 서로 다른 방식으로 성능을 챙긴다.

왜 중요할까? occupancy가 낮다고 register를 기계적으로 줄이기보다, profiler에서 register 사용량과 spilling, 실제 실행 시간을 함께 봐야 한다. GPU 성능 조정은 개인 수첩의 편리함과 공동 창고의 수용 인원을 맞추는 일에 가깝다.

Source note: NVIDIA CUDA Programming Guide는 각 SM의 32-bit register 집합이 resident warp들 사이에 분배되며, kernel의 register·shared memory 사용량이 동시에 머물 수 있는 block과 warp 수에 영향을 준다고 설명한다. 같은 문서는 register가 thread 단위로 할당되고, register 제한으로 spill이 생기면 성능 특성이 달라질 수 있음을 설명한다.
