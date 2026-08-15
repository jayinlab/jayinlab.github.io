---
title: "GPU bandwidth는 왜 광고 숫자만큼 나오지 않을까"
date: 2026-08-15
slug: "gpu-fun-fact-effective-bandwidth"
draft: false
type: "note"
series: "gpu-fun-facts"
tags: ["gpu", "compute", "memory", "bandwidth", "performance"]
difficulty: "beginner"
---

GPU 사양표의 memory bandwidth는 고속도로 제한속도와 닮았다. memory clock, bus 폭, 한 clock에 전송하는 횟수를 곱해 얻은 **theoretical bandwidth**로, 모든 차선이 이상적으로 계속 움직일 때의 상한선이다. 실제 kernel이 그 숫자를 그대로 찍지 못한다고 해서 GPU가 고장 난 것은 아니다.

Program에서 더 쓸모 있는 숫자는 **effective bandwidth**다. kernel이 정말 필요로 한 read와 write byte를 실행 시간으로 나눈 값이다. 예를 들어 4-byte 원소 1억 개를 한 번 읽고 한 번 쓰는 복사라면 유효한 data는 0.8 GB다. 1 ms가 걸렸다면 effective bandwidth는 800 GB/s가 된다.

흥미로운 틈은 “program이 원한 byte”와 “memory가 실제로 옮긴 byte” 사이에서 생긴다. GPU memory는 thread마다 필요한 4 byte를 낱개 택배처럼 보내지 않고 일정 크기의 transaction으로 묶어 나른다. 이웃 thread가 연속 주소를 읽으면 한 상자를 알차게 쓰지만, 멀리 흩어진 주소를 읽으면 대부분 비어 있는 상자를 여러 개 옮길 수 있다. cache miss, 읽기와 쓰기의 비율, 다른 engine과의 경쟁도 사양표에는 없는 교통량을 만든다.

왜 중요할까? “peak의 몇 %가 나왔나”만으로 kernel을 평가하면 원인을 놓치기 쉽다. requested/effective traffic과 실제 DRAM traffic을 함께 보면, memory가 바쁜 것인지 아니면 쓸모없는 byte를 나르느라 바쁜 것인지 구별할 수 있다. 높은 숫자보다 먼저 물어야 할 질문은 **그 bandwidth가 유효한 data를 옮겼는가**다.

Source note: [NVIDIA CUDA C++ Best Practices Guide](https://docs.nvidia.com/cuda/cuda-c-best-practices-guide/index.html#bandwidth)는 theoretical bandwidth와 `(read bytes + write bytes) / time`으로 구한 effective bandwidth를 구분하며, requested traffic과 실제 memory transaction traffic의 차이가 coalescing으로 낭비된 bandwidth를 보여 줄 수 있다고 설명한다. [AMD HIP performance guide](https://rocm.docs.amd.com/projects/HIP/en/latest/understand/performance_optimization.html)는 coalescing이 여러 logical access를 더 적은 physical memory transaction으로 처리해 effective bandwidth를 높인다고 설명한다.
