---
title: "command buffer"
date: 2026-04-13
slug: "command-buffer"
type: "glossary"
term: "command buffer"
tags: ["vulkan", "execution", "pm4"]
related: ["command-queue", "descriptor-set", "pm4-packet"]
---

GPU에 보낼 **명령들을 미리 기록해 둔 버퍼**.

## 상세 설명

Vulkan에서 command buffer는 GPU가 실행할 명령(draw, dispatch, copy 등)을 CPU가 미리 기록해 두는 객체다. 기록이 완료된 후 [[command-queue]]를 통해 GPU에 제출된다.

- `vkBeginCommandBuffer` → 명령 기록 시작
- `vkCmdBindPipeline`, `vkCmdDispatch` 등으로 명령 추가
- `vkEndCommandBuffer` → 기록 완료
- `vkQueueSubmit` → [[command-queue]]에 제출 → GPU 실행

실제 하드웨어 수준에서 command buffer의 내용은 [[pm4-packet]] 시퀀스로 변환되어 GPU 링 버퍼(ring buffer)에 올라간다.

## 계층 구조

```
vkQueueSubmit
  └── command buffer
        ├── vkCmdBindPipeline
        ├── vkCmdBindDescriptorSets
        └── vkCmdDispatch → (드라이버가 PM4 packets로 변환)
```

## OpenCL과의 대응

OpenCL의 `clEnqueueNDRangeKernel`이 내부적으로 하는 일과 유사하다. 다만 Vulkan은 이 과정을 명시적으로 노출한다.
