---
title: "GPU 작업은 왜 잠깐 멈추기도 어려울까"
date: 2026-08-22
slug: "gpu-fun-fact-preemption-granularity"
draft: false
type: "note"
series: "gpu-fun-facts"
tags: ["gpu", "compute", "scheduling", "preemption", "cuda", "wddm"]
difficulty: "beginner"
---

CPU 프로그램은 운영체제가 잠깐 멈췄다가 다른 프로그램을 실행하는 일이 자연스럽다. GPU도 비슷할 것 같지만, 오래전에는 실행 중인 kernel을 아무 지점에서나 끊기가 쉽지 않았다. 수많은 thread의 register와 shared memory, 실행 위치를 모두 보존해야 다시 이어 달릴 수 있기 때문이다.

그래서 GPU의 **preemption granularity**는 “어디에서 끊을 수 있나”를 말한다. Windows가 공개하는 단계만 봐도 compute packet, dispatch, thread group, thread, instruction 경계로 잘게 나뉜다. 거친 GPU라면 실행 중인 큰 dispatch가 끝날 때까지 기다려야 하고, 더 세밀한 GPU라면 훨씬 작은 경계에서 자리를 내줄 수 있다.

NVIDIA의 Pascal 세대에서는 이 차이가 눈에 띄는 기능이 됐다. GP100은 compute 작업을 instruction 수준에서 중단하고, register와 shared memory 같은 execution context를 GPU DRAM에 옮겨 다른 작업을 실행할 수 있었다. 덕분에 긴 kernel을 무조건 작은 조각으로 쪼개지 않아도 화면 응답성과 interactive debugging을 개선할 수 있었다. 다만 이사는 공짜가 아니다. 저장하고 복원할 state가 많을수록 context switch 비용도 생긴다.

왜 중요할까? 긴 kernel 하나가 빠르게 끝나는 것과, 여러 프로그램이 GPU를 나눠 쓰면서 즉시 반응하는 것은 서로 다른 목표다. GPU scheduler의 품질은 단순히 “누가 다음인가”뿐 아니라 hardware가 **얼마나 작은 경계에서 안전하게 양보할 수 있는가**에도 달려 있다.

Source note: [Microsoft GPU preemption documentation](https://learn.microsoft.com/en-us/windows-hardware/drivers/display/gpu-preemption)은 더 세밀한 mid-DMA-buffer preemption이 사용자 경험을 개선한다고 설명하고, [compute preemption granularity 목록](https://learn.microsoft.com/en-us/windows-hardware/drivers/ddi/d3dkmdt/ne-d3dkmdt-_d3dkmdt_compute_preemption_granularity)은 지원 경계를 구분한다. [NVIDIA Pascal Tuning Guide](https://docs.nvidia.com/cuda/archive/12.5.0/pascal-tuning-guide/index.html#compute-preemption)는 GP100의 instruction-level compute preemption과 context 저장, 장점과 용도를 설명한다.
