---
title: "오답노트 #01 — OpDecorate/Binding 매핑 오류, PM4 계층 오류"
date: 2026-04-13
slug: "opencl-wrong-note-barrier-scope"
draft: false
type: "wrong-note"
series: "opencl-deep-dive"
tags: ["opencl", "vulkan", "pm4", "descriptor"]
difficulty: "intermediate"
---

틀린 개념을 남겨두면 이후 추적에서 계속 헷갈린다.  
이 노트는 퀴즈에서 틀린 2개 개념을 정확하게 고정하기 위한 문서다.

---

## 오답 1: OpDecorate DescriptorSet/Binding → pipeline으로 직결된다?

### 왜 틀렸나

`OpDecorate DescriptorSet/Binding`을 보고 "pipeline 자체"와 직결된다고 생각했다.  
그러나 이 데코레이션은 **파이프라인 로직** 자체가 아니라  
**리소스 바인딩 슬롯 규격**을 뜻한다.

### 정확한 연결

```
SPIR-V OpDecorate DescriptorSet/Binding
    ↓
Vulkan: Descriptor Set Layout의 binding 정의
    ↓
Pipeline Layout의 setLayouts 중 하나
    ↓
Pipeline이 "기대하는 계약"의 일부
```

### 기억 문장

- **Pipeline** = 무엇을 계산할지 (셰이더 로직)
- **Descriptor Set Layout** = 어떤 슬롯에 어떤 타입 리소스를 받을지 (슬롯 규격)

---

## 오답 2: PM4 계층 = Vulkan command recording과 같은 레벨?

### 왜 틀렸나

`vkCmd*` 호출을 PM4와 같은 계층으로 봤다.  
그러나 `vkCmd*`는 **Vulkan 레벨의 명령 기록**이고,  
PM4는 그보다 훨씬 아래에서 드라이버가 하드웨어에 제출하는 패킷 스트림이다.

### 정확한 계층 순서

```
OpenCL API
    ↓
Vulkan command recording (vkCmd*)
    ↓
Driver backend command stream
    ↓
PM4 패킷 (GPU CP가 해석하는 하드웨어 근접 포맷)
    ↓
GPU
```

### 기억 문장

> OpenCL API → Vulkan recording → Driver backend → PM4 → GPU

---

## 이해 확인 질문

### Q1. `DescriptorSet/Binding`이 직접 매핑되는 Vulkan 객체는?

<details>
<summary>정답 보기</summary>

**Descriptor Set Layout의 binding 정의**.  
Pipeline 자체가 아니라, Pipeline이 기대하는 리소스 슬롯 규격이다.

</details>

### Q2. PM4는 Vulkan API보다 위/아래 중 어느 계층인가?

<details>
<summary>정답 보기</summary>

**아래** — 드라이버 backend에 더 가까운 하드웨어 근접 계층이다.  
앱이 직접 쓰지 않고, Vulkan API 호출이 드라이버에 의해 PM4 패킷으로 변환된다.

</details>

### Q3. vkCmdDispatch와 PM4의 관계는?

<details>
<summary>정답 보기</summary>

`vkCmdDispatch`는 Vulkan 레벨 명령 기록이다.  
드라이버가 이 명령을 처리할 때 내부적으로 `IT_DISPATCH_DIRECT` 등의 PM4 Type-3 패킷을 생성하여 ring buffer에 기록한다.

</details>

---

## 관련 글

- [SPIR-V↔Vulkan 매핑](/opencl-note-spirv-vulkan-mapping/) — OpDecorate → DSL 연결 상세
- [AMD PM4 개요](/opencl-note-pm4-overview/) — PM4 계층 위치 정확하게
- [오답노트 #02](/opencl-wrong-note-partial/) — 추가 오답 정정

## 관련 용어

[[descriptor-set]], [[pipeline-layout]], [[pm4-packet]], [[SPIR-V]]
