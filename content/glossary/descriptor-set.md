---
title: "descriptor set"
date: 2026-04-13
slug: "descriptor-set"
type: "glossary"
term: "descriptor set"
tags: ["vulkan", "pipeline", "memory"]
related: ["pipeline-layout", "command-buffer", "work-item"]
---

Vulkan에서 셰이더가 접근할 **리소스(버퍼, 이미지 등)의 바인딩 정보를 담은 테이블**.

## 상세 설명

셰이더 코드는 "binding 0에 있는 버퍼를 읽어라"라고만 쓴다. 실제로 어떤 VkBuffer가 그 자리에 있는지는 descriptor set이 결정한다.

```
셰이더 코드:  layout(set=0, binding=0) buffer InputBuf { ... }
descriptor set: set=0, binding=0 → VkBuffer(주소: 0x...)
```

- `vkUpdateDescriptorSets`로 버퍼/이미지를 바인딩에 연결
- `vkCmdBindDescriptorSets`로 커맨드 버퍼에 장착
- [[pipeline-layout]]과 반드시 호환되어야 함 (binding 구조가 일치해야 함)

## OpenCL과의 대응

OpenCL의 `clSetKernelArg(kernel, 0, sizeof(cl_mem), &buf)`에 해당한다. 차이는 Vulkan이 이 바인딩 과정을 훨씬 명시적으로 노출한다는 것.

## 계층

```
pipeline layout (계약서 양식)
  └── descriptor set layout (항목 목록)
        └── descriptor set (실제 값이 채워진 테이블)
```
