---
title: "같은 RAM을 쓰는데 GPU 복사는 왜 생길까"
date: 2026-08-24
slug: "gpu-fun-fact-shared-dram-zero-copy"
draft: false
type: "note"
series: "gpu-fun-facts"
tags: ["gpu", "compute", "intel", "integrated-gpu", "zero-copy", "memory"]
difficulty: "beginner"
---

노트북의 integrated GPU는 CPU와 같은 system DRAM을 쓴다. 그렇다면 CPU가 만든 배열을 GPU가 읽을 때 복사는 당연히 0번이어야 할 것 같다. 하지만 **같은 물리 창고를 쓴다**는 사실과 **같은 상자를 그대로 건넨다**는 것은 다른 이야기다.

GPU는 cache line 정렬, 접근 방식, page 고정 여부처럼 자신에게 편한 조건이 있다. 평범한 host pointer가 그 조건을 만족하지 않거나 API가 사용 기간을 분명히 알려 주지 않으면, driver는 안전하고 빠르게 처리하려고 내부 buffer를 따로 만들 수 있다. 물리적으로 DRAM 칩이 하나여도 논리적인 복사가 생기는 셈이다.

그래서 Intel의 OpenCL 안내는 integrated GPU에서 `CL_MEM_ALLOC_HOST_PTR`를 쓰거나, 조건에 맞게 정렬한 memory를 `CL_MEM_USE_HOST_PTR`로 전달하고 `map`/`unmap`으로 소유 구간을 표현하는 방법을 소개한다. 이때 runtime이 같은 allocation을 CPU와 GPU 양쪽에 연결하면 비로소 zero-copy가 된다. 반대로 discrete GPU의 VRAM처럼 물리 memory가 떨어져 있으면 같은 pointer처럼 보이는 USM도 뒤에서 page를 옮기거나 원격 접근할 수 있다.

왜 중요할까? `shared`, `unified`, `zero-copy`는 비슷하게 들리지만 같은 약속이 아니다. **주소를 함께 쓸 수 있는가, 물리 memory가 같은가, 실제 복사가 생략되는가**는 각각 따져야 한다. 이름보다 data가 실제로 머무는 곳과 이동 횟수가 성능을 결정한다.

Source note: [Intel OpenCL zero-copy 안내](https://www.intel.com/content/www/us/en/developer/articles/training/getting-the-most-from-opencl-12-how-to-increase-performance-by-minimizing-buffer-copies-on-intel-processor-graphics.html)는 shared physical memory에서도 driver가 내부 복사본을 만들 수 있음을 설명하고, zero-copy allocation 조건을 제시한다. [Intel oneAPI GPU Optimization Guide](https://www.intel.com/content/www/us/en/docs/oneapi/optimization-guide-gpu/2025-0/unified-shared-memory-allocations.html)는 host/device/shared USM의 실제 위치와 migration 차이를 정리한다.
