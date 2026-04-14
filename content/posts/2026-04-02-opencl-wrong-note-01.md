---
title: "OpenCL 오답노트 #01 — DescriptorSet/Binding 매핑과 PM4 계층"
date: 2026-04-02
slug: "opencl-wrong-note-01"
draft: false
type: "wrong-note"
series: "opencl-deep-dive"
tags: ["opencl", "vulkan", "pm4", "descriptor"]
difficulty: "intermediate"
layer: "CL"
---

이번 오답노트는 최근 퀴즈에서 틀린 2개 개념을 짧게 고정하기 위한 문서다.

## 오답 1) `OpDecorate DescriptorSet/Binding -> pipeline`

### 왜 틀렸나
SPIR-V의 `DescriptorSet/Binding` 데코레이션은 "파이프라인 로직" 자체보다,
**리소스 바인딩 슬롯 규격**을 뜻한다.

### 정답
`OpDecorate DescriptorSet/Binding`은 Vulkan에서 주로
**Descriptor Set Layout 바인딩 정의**로 이어진다.

### 기억 문장
- Pipeline = 무엇을 계산할지
- Descriptor Set Layout = 어떤 슬롯에 어떤 타입 리소스를 받을지

---

## 오답 2) PM4 계층을 Vulkan command recording으로 봄

### 왜 틀렸나
`vkCmd*` 호출은 Vulkan 레벨의 명령 기록이다.
PM4는 그보다 아래에서 드라이버가 하드웨어에 제출하는 패킷 스트림이다.

### 정답
PM4에 더 가까운 층은
**Driver backend command stream**이다.

### 기억 문장
OpenCL API -> Vulkan command recording -> Driver backend -> PM4

---

## 이해 확인 질문

### Q1. `DescriptorSet/Binding`이 직접 매핑되는 Vulkan 객체는?
<details>
  <summary>정답 보기</summary>
  Descriptor Set Layout의 바인딩 정의.
</details>

### Q2. PM4는 Vulkan API보다 위/아래 중 어디 계층인가?
<details>
  <summary>정답 보기</summary>
  아래(드라이버 backend에 더 가까운 하드웨어 근접 계층).
</details>
