---
title: "queue-family"
date: 2026-04-20
slug: "queue-family"
type: "glossary"
term: "queue family"
tags: ["vulkan", "queue", "compute", "execution"]
related: ["command-queue", "command-buffer", "pipeline-layout"]
---

Vulkan에서 **같은 성격의 큐들을 묶어 놓은 하드웨어 기능 그룹**.

## 상세 설명

`VkPhysicalDevice`를 조회하면 여러 queue family가 나올 수 있다.
각 family는 지원 기능이 다르다.

- graphics + compute + transfer를 모두 지원하는 family
- compute/transfer 위주 family
- transfer 전용 family

앱은 queue를 만들 때 “어느 queue family에서 몇 개 큐를 쓸지”를 먼저 결정해야 한다.

```text
vkGetPhysicalDeviceQueueFamilyProperties
  -> queueFamilyIndex 선택
  -> vkCreateDevice (queueCreateInfo로 생성)
```

## 왜 중요한가

- compute 전용 workload는 graphics 혼잡이 적은 family가 유리할 수 있다.
- 잘못 고르면 불필요한 동기화/소유권 이전 비용이 생긴다.
