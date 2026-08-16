---
title: "GPU kernel의 인자는 왜 작은 택배처럼 포장될까"
date: 2026-08-16
slug: "gpu-fun-fact-kernel-argument-parcel"
draft: false
type: "note"
series: "gpu-fun-facts"
tags: ["gpu", "compute", "cuda", "kernel", "runtime"]
difficulty: "beginner"
---

CPU function을 부를 때처럼 `kernel(ptr, n, scale)`이라고 쓰면, 거대한 GPU 계산도 인자 몇 개를 건네는 평범한 호출처럼 보인다. 하지만 GPU는 다른 processor이고 호출은 비동기적으로 흘러간다. runtime은 launch에 필요한 작은 값들을 **kernel parameter 꾸러미**로 만들어 GPU가 읽을 수 있는 형태로 넘긴다.

CUDA Driver API의 모습은 이 장면을 꽤 솔직하게 드러낸다. 각 kernel parameter의 원본을 가리키는 pointer 배열을 주면 값이 복사되고, 또는 alignment와 offset을 맞춘 하나의 buffer에 인자를 직접 포장할 수 있다. Compiler와 runtime이 평소 숨겨 주는 작은 ABI 택배 상자인 셈이다.

여기서 재미있는 함정이 하나 있다. `float *data`를 인자로 넘길 때 복사되는 것은 배열 전체가 아니라 **주소 값**이다. 주소가 가리키는 data는 launch 전에 GPU가 접근할 수 있는 memory에 따로 준비되어 있어야 한다. 반대로 `int n`이나 작은 struct처럼 값으로 넘긴 인자는 상자 자체에 들어간다. 그래서 struct의 alignment가 host와 device에서 다르면 수동 포장이 어긋날 수도 있다.

왜 중요할까? Kernel launch가 단순한 함수 호출이 아니라는 사실은, 많은 작은 kernel에서 launch overhead가 눈에 띄는 이유와 pointer만 넘겼는데 data까지 전송됐다고 착각하는 버그를 함께 설명한다. 화면의 괄호는 같아도 CPU call stack을 건너가는 호출이 아니라, **실행 명령과 인자를 GPU 쪽 우편함에 넣는 일**에 더 가깝다.

Source note: [NVIDIA CUDA Programming Guide](https://docs.nvidia.com/cuda/cuda-programming-guide/03-advanced/driver-api.html#kernel-execution)는 `cuLaunchKernel()`의 parameter가 각 원본 영역에서 복사되거나, device-side alignment에 맞춘 단일 parameter buffer로 전달된다고 설명한다. [CUDA Driver API](https://docs.nvidia.com/cuda/cuda-driver-api/group__CUDA__EXEC.html)는 `kernelParams`의 각 항목이 실제 parameter를 복사할 memory 영역을 가리킨다고 명시한다.
