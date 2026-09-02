---
title: "GPU atomic은 왜 단체 주문을 할까"
date: 2026-09-02
slug: "gpu-fun-fact-warp-aggregated-atomics"
draft: false
type: "note"
series: "gpu-fun-facts"
tags: ["gpu", "cuda", "atomic", "warp", "optimization"]
difficulty: "beginner"
---

축제 매점에서 서른두 명이 음료를 하나씩 주문한다. 모두 계산대에 따로 서면 “다음 번호 주세요”를 서른두 번 처리해야 한다. 한 명이 대표로 가서 32잔을 한꺼번에 주문하고, 받은 번호표 묶음을 일행에게 나눠 주면 계산대는 한 번만 거치면 된다. GPU의 **warp-aggregated atomic**도 이와 비슷하다.

여기서 일행은 함께 실행되는 warp의 thread들, 계산대는 여러 thread가 동시에 고치는 counter, 번호표는 각 thread가 결과를 쓸 array 위치다. 단순한 filtering kernel이라면 조건을 통과한 thread마다 `atomicAdd(counter, 1)`을 호출할 수 있다. 하지만 모두 같은 counter에 몰리면 atomic 연산이 그 지점에서 순서를 정해야 하므로 경합이 커진다.

대신 warp가 먼저 참여 thread 수를 세고 leader 한 명만 `atomicAdd(counter, count)`를 수행한다. leader가 받은 시작 번호를 warp 안에 공유한 뒤, 각 thread는 자신의 순위만 더해 서로 다른 위치를 얻는다. 예를 들어 19명이 참여했다면 전역 counter 갱신은 최대 19번이 아니라 한 번으로 줄 수 있다. NVIDIA는 이 기법을 2014년에 소개했고, CUDA 9 이후 compiler가 많은 atomic 패턴을 자동으로 warp 단위로 묶을 수 있다고 설명했다.

다만 “항상 32개가 하나로 합쳐진다”는 뜻은 아니다. 실제 참여 thread 수, 모든 thread가 같은 counter를 갱신하는지, 연산 결과가 어떻게 쓰이는지에 따라 적용 가능성이 달라진다. 또 최신 compiler가 자동 최적화할 수 있어 손으로 구현한 코드가 반드시 더 빠르지도 않다. 재미있는 핵심은 **atomic 자체를 없애지 않고, 계산대에 찾아가는 횟수를 줄인다**는 데 있다.

Source note: [NVIDIA의 Warp-Aggregated Atomics 글](https://developer.nvidia.com/blog/cuda-pro-tip-optimized-filtering-warp-aggregated-atomics/)은 leader election, 참여 thread 수 계산, 한 번의 atomic, 결과 broadcast와 thread별 rank 계산 과정을 설명한다. 글은 2014년에 처음 게시되었고, CUDA 9 이후 compiler가 많은 경우 이 최적화를 자동 수행한다고 덧붙인다.
