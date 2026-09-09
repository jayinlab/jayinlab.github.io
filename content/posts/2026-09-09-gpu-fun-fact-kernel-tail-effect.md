---
title: "GPU는 왜 마지막 몇 팀 때문에 늦게 끝날까"
date: 2026-09-09
slug: "gpu-fun-fact-kernel-tail-effect"
draft: false
type: "note"
series: "gpu-fun-facts"
tags: ["gpu", "cuda", "scheduling", "tail-effect", "performance"]
difficulty: "beginner"
---

놀이공원에 80인승 놀이기구가 열 대 있다고 해 보자. 손님 800명은 한 번에 탈 수 있지만, 801번째 손님이 오면 그 한 명 때문에 놀이기구 한 대가 한 바퀴 더 돌아야 한다. GPU kernel의 실행 시간도 작업량에 정확히 비례하지 않고, 이런 **마지막 한 바퀴** 때문에 계단처럼 늘 수 있다.

여기서 놀이기구는 SM(Streaming Multiprocessor), 손님 팀은 thread block이다. GPU는 실행 가능한 block들을 여러 SM에 나눠 올린다. 모든 SM이 한 차례에 처리할 수 있는 block 묶음을 흔히 **wave**라고 부른다. 마지막 wave가 꽉 차지 않은 partial wave라면 먼저 일을 마친 SM들은 쉬는데, 남은 block을 맡은 몇 개 SM은 계속 달린다. NVIDIA Nsight Compute는 이를 `launch__waves_per_multiprocessor`로 보여 주며, partial wave가 일부 SM을 idle 상태로 만드는 tail effect를 낳을 수 있다고 설명한다.

그래서 block 몇 개를 더하거나 빼는 작은 변화가 kernel 시간에는 의외로 큰 차이를 만들 수 있다. 각 block이 오래 걸릴수록 마지막 partial wave의 빈자리가 비싸고, block이 충분히 많고 짧다면 이 꼬리는 덜 눈에 띈다.

다만 놀이기구처럼 “SM 하나가 block 하나만 처리한다”는 뜻은 아니다. 실제로는 register와 shared memory 사용량, block 크기, architecture에 따라 한 SM에 여러 block이 동시에 resident할 수 있다. block별 실행 시간도 같지 않을 수 있다. 핵심은 정확한 좌석 수가 아니라, **끝에 남은 일이 GPU 전체를 채우지 못하면 먼저 빈 SM이 생긴다**는 점이다.

Source note: [NVIDIA Nsight Compute Profiling Guide](https://docs.nvidia.com/nsight-compute/ProfilingGuide/index.html#metrics-reference)는 `launch__waves_per_multiprocessor`를 SM당 wave 수로 정의하고, partial wave가 일부 SM은 idle인데 다른 SM에는 아직 일이 남는 tail effect를 만들 수 있다고 명시한다.
