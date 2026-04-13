---
title: "command queue"
date: 2026-04-13
slug: "command-queue"
type: "glossary"
term: "command queue"
tags: ["opencl", "vulkan", "execution"]
related: ["command-buffer", "pm4-packet", "ring-buffer"]
---

GPU에 제출할 **명령들을 순서대로 쌓아두는 큐**.

## 상세 설명

### OpenCL에서

`cl_command_queue`는 `clEnqueueNDRangeKernel`, `clEnqueueCopyBuffer` 등의 명령을 받아 GPU에 순서대로 전달하는 채널이다.

```c
cl_command_queue queue = clCreateCommandQueue(context, device, 0, &err);
clEnqueueNDRangeKernel(queue, kernel, 1, NULL, &global, &local, 0, NULL, NULL);
clFinish(queue);  // 큐의 모든 명령이 완료될 때까지 대기
```

### Vulkan에서

`VkQueue`가 이 역할을 한다. [[command-buffer]]를 `vkQueueSubmit`으로 제출한다.

```c
vkQueueSubmit(queue, 1, &submitInfo, fence);
```

### 계층

```
Application
  └── command queue (VkQueue / cl_command_queue)
        └── command buffer (VkCommandBuffer)
              └── PM4 packets  ← 드라이버가 변환
                    └── ring buffer  ← GPU가 읽음
```

## OpenCL vs Vulkan 비교

| | OpenCL | Vulkan |
|--|--------|--------|
| 큐 타입 | `cl_command_queue` | `VkQueue` |
| 명령 단위 | enqueue 함수 직접 호출 | `VkCommandBuffer`로 묶어서 제출 |
| 동기화 | `clFinish`, `clWaitForEvents` | `VkFence`, `VkSemaphore` |
