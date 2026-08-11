---
title: "GPU의 한 명령은 왜 두 번 계산한 것으로 셀까"
date: 2026-08-11
slug: "gpu-fun-fact-fma-two-flops"
draft: false
type: "note"
series: "gpu-fun-facts"
tags: ["gpu", "compute", "floating-point", "fma", "performance"]
difficulty: "beginner"
---

GPU 사양표의 TFLOPS는 초당 몇 번의 floating-point 연산을 할 수 있는지 나타낸다. 그런데 숫자를 세는 방식에는 작은 반전이 있다. GPU가 `a × b + c`를 한 번에 처리하는 **FMA(fused multiply-add)** 명령 하나를 실행하면, 보통 FLOP은 1이 아니라 2로 센다. 곱셈 하나와 덧셈 하나가 들어 있기 때문이다.

이것은 숫자를 부풀리기 위한 GPU만의 편법은 아니다. FLOP은 instruction 수가 아니라 수학적 operation 수를 세는 관례다. 예를 들어 AMD ROCm profiler도 덧셈과 곱셈은 각각 1 FLOP, FMA는 2 FLOPs로 계산한다. 64개 work-item이 함께 같은 FP32 FMA를 수행하면 instruction은 하나여도 합계는 128 FLOPs가 된다.

FMA의 `fused`에도 의미가 있다. 곱한 결과를 먼저 반올림한 뒤 더하는 대신, `a × b + c` 전체를 한 번만 반올림한다. 그래서 별도의 multiply와 add보다 오히려 오차가 작을 수 있고, dot product와 matrix multiplication처럼 곱하고 더하는 일이 반복되는 계산에 잘 맞는다. GPU의 높은 연산량 숫자가 대개 이런 형태의 workload를 상정하는 이유다.

왜 중요할까? 사양표의 peak TFLOPS는 “모든 program이 이 속도로 돈다”는 약속이 아니다. FMA를 충분히 채워 넣고, 알맞은 precision을 쓰며, memory 공급과 다른 병목도 버텨 줄 때 가까워지는 이론값이다. 같은 GPU라도 workload가 덧셈만 하는지, FP32 FMA인지, 다른 precision인지에 따라 사양표 숫자의 의미가 달라진다.

Source note: AMD ROCm Compute Profiler의 FLOP counting convention은 add/multiply를 각각 1 operation, FMA를 2 operations로 센다고 명시하며, 64-lane wavefront의 FP32 FMA를 128 FLOPs로 예시한다. NVIDIA CUDA Floating Point 문서는 FMA가 `a × b + c`를 한 번의 rounding으로 계산해 분리된 multiply와 add보다 정확할 수 있음을 설명한다.
