---
title: "descriptor-set-layout"
date: 2026-04-20
slug: "descriptor-set-layout"
type: "glossary"
term: "descriptor set layout"
tags: ["vulkan", "descriptor", "pipeline"]
related: ["descriptor-set", "pipeline-layout", "SPIR-V"]
---

Descriptor Set의 **슬롯 구조(바인딩 타입/개수/스테이지 가시성) 계약서**.

## 상세 설명

`VkDescriptorSetLayout`은 "set N의 binding M에 어떤 자원이 와야 하는지"를 정의한다.

예:
- binding 0: storage buffer
- binding 1: uniform buffer
- binding 2: sampled image

이 레이아웃 여러 개가 모여 `pipeline layout`을 구성한다.

## 왜 중요한가

- descriptor set 실제 값은 바뀔 수 있어도, 레이아웃 계약은 호환되어야 한다.
- 레이아웃 불일치 시 bind/validation 단계에서 에러가 잘 드러난다.
