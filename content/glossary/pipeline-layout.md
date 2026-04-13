---
title: "pipeline layout"
date: 2026-04-13
slug: "pipeline-layout"
type: "glossary"
term: "pipeline layout"
tags: ["vulkan", "pipeline", "descriptor"]
related: ["descriptor-set", "command-buffer", "SPIR-V"]
---

Vulkan에서 파이프라인이 어떤 **리소스 바인딩 구조**를 사용하는지 정의하는 객체.

## 상세 설명

셰이더가 "set=0, binding=0에 storage buffer 있음"이라고 선언하면, 파이프라인을 만들 때 드라이버에게 이 구조를 미리 알려줘야 한다. 그 역할을 하는 것이 pipeline layout이다.

```
VkPipelineLayout
  ├── descriptor set layout 0: [binding 0: storage buffer, binding 1: uniform]
  ├── descriptor set layout 1: [binding 0: sampled image]
  └── push constant range: 0~16 bytes
```

### 호환성 규칙

`vkCmdBindDescriptorSets`로 바인딩하는 [[descriptor-set]]은 pipeline layout에 선언된 descriptor set layout과 **구조가 완전히 일치**해야 한다. 불일치 시 validation error 또는 undefined behavior.

### 관계

```
pipeline layout (계약서 양식)
  ↕ 일치해야 함
descriptor set (실제 바인딩 값)
```

## 왜 미리 선언하는가?

드라이버가 컴파일 타임에 레지스터 배치를 최적화하기 위해서다. Vulkan의 핵심 철학 중 하나: "CPU가 미리 알 수 있는 정보는 최대한 미리 알려준다."
