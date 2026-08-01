---
title: "GPU에는 왜 복사 전용 engine이 있을까"
date: 2026-08-01
slug: "gpu-fun-fact-copy-engine"
draft: false
type: "note"
series: "gpu-fun-facts"
tags: ["gpu", "cuda", "vulkan", "memory", "transfer"]
difficulty: "beginner"
---

GPU를 쓰다 보면 계산보다 먼저 눈에 띄는 일이 있다. texture를 올리고, buffer를 채우고, 결과를 다시 CPU 쪽으로 가져오는 copy다. 재미있는 점은 현대 GPU API가 이 일을 종종 "그냥 계산 명령 사이의 부수 작업"이 아니라 별도의 작업 종류처럼 다룬다는 것이다.

이 배경에는 GPU가 혼자 계산만 하는 섬이 아니라는 현실이 있다. 특히 discrete GPU는 CPU memory와 GPU memory 사이에 PCIe 같은 길을 두고 데이터를 주고받는다. 큰 texture upload나 readback이 그 길을 오래 붙잡으면, shader core가 계산할 준비가 되어 있어도 data가 도착하지 않아 기다리게 된다. 그래서 hardware와 runtime은 copy를 가능한 한 독립적인 일감으로 빼서, 계산과 겹칠 수 있는 틈을 찾는다.

CUDA 문서도 이 감각을 그대로 보여준다. NVIDIA CUDA Programming Guide는 일부 device에서 GPU로 가거나 GPU에서 나오는 asynchronous memory copy가 kernel execution과 동시에 수행될 수 있고, 그 능력은 `asyncEngineCount` 같은 device property로 확인한다고 설명한다. host memory가 involved되면 page-locked memory 조건도 붙는다. 즉 "copy를 시켰다"는 말은 단순한 `memcpy`가 아니라, device가 가진 별도 경로와 scheduling 능력을 타는 일이 될 수 있다.

Vulkan도 비슷한 단서를 API 표면에 드러낸다. `VkQueueFamilyProperties`의 `queueFlags`에는 graphics, compute와 나란히 `VK_QUEUE_TRANSFER_BIT`가 있고, 이 bit는 해당 queue family가 transfer operations를 지원한다는 뜻이다. 모든 GPU가 같은 모양의 전용 copy engine을 가진다는 뜻은 아니지만, application이 "이 작업은 그리기/계산이 아니라 data 이동"이라고 분리해 표현할 수 있게 해준다.

왜 중요할까? 큰 asset upload, staging buffer, readback, screenshot capture가 frame time을 흔드는 이유를 볼 때 "GPU가 느리다"보다 먼저 copy와 compute가 실제로 겹쳤는지, 어떤 queue와 memory 조건을 탔는지 보는 편이 더 정확하다. 복사 전용 engine 이야기는 결국 GPU 성능이 연산량만이 아니라 data 이동의 배치에도 묶여 있다는 작은 힌트다.

Source note: NVIDIA CUDA Programming Guide의 Asynchronous Concurrent Execution 섹션은 일부 device에서 asynchronous memory copy와 kernel execution이 동시에 수행될 수 있고 `asyncEngineCount`로 capability를 확인한다고 설명한다. Vulkan specification의 Devices and Queues 장은 queue family capability를 `VkQueueFamilyProperties::queueFlags`로 노출하며, `VK_QUEUE_TRANSFER_BIT`가 transfer operations 지원을 뜻한다고 정의한다.
