---
title: "GPU kernel은 왜 퇴근하지 않고 기다릴까"
date: 2026-08-10
slug: "gpu-fun-fact-persistent-kernel"
draft: false
type: "note"
series: "gpu-fun-facts"
tags: ["gpu", "compute", "kernel", "scheduling", "performance"]
difficulty: "beginner"
---

보통 GPU kernel은 맡은 grid를 처리하면 끝난다. 다음 일이 생기면 CPU가 또 kernel을 launch한다. 그런데 어떤 kernel은 일을 마쳐도 퇴근하지 않고 GPU에 계속 머문다. queue에서 다음 작업을 꺼내 처리하는 **persistent kernel**이다. 매번 새 직원을 부르는 대신, 이미 작업장에 있는 팀에게 다음 작업표를 건네는 셈이다.

이 방식이 등장하는 이유는 아주 작은 작업이 자주 올 때 드러난다. kernel 자체는 순식간에 끝나는데 CPU runtime과 driver가 launch를 준비하고 GPU에 전달하는 시간이 상대적으로 커질 수 있다. 오래 살아 있는 thread block이 device-side queue를 확인하면 반복 launch를 줄이고, register나 shared memory에 둔 일부 상태도 다음 작업에 재사용할 여지가 생긴다.

하지만 공짜 점심은 아니다. 일반 grid에서는 GPU scheduler가 많은 block을 알아서 배치한다. persistent kernel은 흔히 GPU를 채울 만큼만 block을 띄우고, 어떤 block이 어떤 일을 가져갈지 kernel 안에서 직접 조율한다. queue 동기화가 필요하고, 일이 고르지 않으면 어떤 팀은 바쁜데 다른 팀은 기다릴 수 있다. 오래 resident한 block이 GPU resource를 붙잡아 다른 kernel과의 동시 실행을 방해할 수도 있다.

CUDA Cooperative Groups 문서에는 여러 작은 pipeline stage를 persistent thread block으로 재구성해 device 안에서 동기화하는 예가 나온다. 이때 모든 block이 함께 resident해야 하는 grid-wide synchronization 같은 조건 때문에 launch 크기도 조심해서 정해야 한다.

왜 중요할까? persistent kernel은 “kernel을 크게 만들면 빠르다”는 요령이 아니라, **작업을 매번 제출할지, 상주 worker에게 배달할지**를 바꾸는 scheduling 선택이다. launch overhead를 아끼는 대신 queue, 공정성, resource 점유를 application이 더 책임진다.

Source note: NVIDIA CUDA Programming Guide의 Cooperative Groups 절은 작은 kernel stage가 많은 pipeline을 persistent thread block과 device-side grid synchronization으로 재구성하는 사례, 그리고 co-residency를 위해 block 수를 신중히 정해야 한다는 제약을 설명한다. NVIDIA의 CUDA Graphs 자료는 짧은 kernel 사이의 빈 구간에 CPU/GPU launch overhead가 관여할 수 있음을 profiler timeline으로 보여준다.
