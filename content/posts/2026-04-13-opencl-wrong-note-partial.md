---
title: "오답노트 #02 — 8개 항목 부분/완전 오답 정정"
date: 2026-04-13
slug: "opencl-wrong-note-partial"
draft: false
type: "wrong-note"
series: "opencl-deep-dive"
tags: ["opencl", "vulkan", "barrier"]
difficulty: "intermediate"
layer: "CL"
---

퀴즈에서 **완전히 맞지 못한 항목(오답 + 부분정답)**을 한 번에 복습한다.  
헷갈렸던 지점을 명확히 하고, 이후에 같은 실수를 반복하지 않도록 고정한다.

---

## 1. DescriptorSet/Binding 매핑 (C001)

### 헷갈린 포인트
`clSetKernelArg` 호출 시점의 동적 동작으로 이해하려는 경향

### 정확한 이해
핵심은 호출 타이밍이 아니라 **정적 인터페이스 계약**이다.

```
SPIR-V DescriptorSet/Binding
    → Vulkan Descriptor Set Layout(DSL) binding 정의
    → DSL들의 집합 → Pipeline Layout 계약
```

### 한 줄 암기
`DescriptorSet/Binding → DSL binding → PipelineLayout contract`

---

## 2. PM4 계층 위치 (C002)

### 맞춘 부분
PM4가 하드웨어 쪽에 가깝다는 감각은 맞음

### 보정
PM4는 **드라이버 백엔드 커맨드 스트림/CP 인접 계층**이다.  
OpenCL API 레벨과는 멀다.

### 한 줄 암기
`OpenCL API → Vulkan recording → driver backend → PM4 → GPU`

---

## 3. Pipeline Layout 정의 (C004)

### 헷갈린 포인트
"버퍼 타입 약속" 감각은 있었지만 구성요소를 명시하지 못함

### 정확한 구성
Pipeline Layout = **두 요소의 조합**

1. `setLayout[]` — 각 descriptor set의 슬롯 규격
2. `pushConstantRange[]` — push constant의 stage/offset/size

이 둘로 구성되는 **호환성 계약점(contract)**이다.

---

## 4. clSetKernelArg 체인 분류 (C006)

### 헷갈린 포인트
compile chain으로 분류했음

### 정확한 분류
`clSetKernelArg`는 **submit chain 측 상태 준비(바인딩 상태 구성)**에 더 가깝다.  
코드 생성/빌드 산출물을 바꾸는 compile 단계와 구분해야 한다.

---

## 5. mismatch 실패 시점 (C007)

### 맞춘 부분
runtime에서 터질 수 있다고 인지함

### 보정
대부분은 **bind/validation/dispatch 인접 런타임 단계**에서 드러난다.  
이유: 컴파일 시점에 실제 바인딩 조합이 확정되지 않기 때문.

---

## 6. first-dispatch latency (C008)

### 맞춘 부분
warmup/캐시 감각은 맞음

### 보정 — 3원인으로 고정

| 원인 | 내용 |
|------|------|
| 1 | pipeline 생성/캐시 미스 |
| 2 | driver backend JIT/내부 컴파일 |
| 3 | first submit 경로의 초기화 비용 |

---

## 7. kernel-signature drift → runtime fail chain (C009)

### 정확한 체인

```
1. kernel arg 순서/타입/개수 변경
    ↓
2. clspv 산출 SPIR-V resource interface(set/binding) 변화
    ↓
3. host 측 descriptor write/layout 가정 미갱신
    ↓
4. bind/dispatch 검증 또는 런타임에서 incompatibility 실패
```

---

## 8. tiny-dispatch CPU 병목 최적화 (C010)

### 맞춘 부분
재사용 전략 방향은 맞음

### 보정

| 전략 | 내용 |
|------|------|
| 1 | command buffer recording 재사용 (secondary command buffer 활용) |
| 2 | submit 횟수/동기화 비용 감소 (배치화) |
| 3 | pipeline/layout/descriptor 갱신 churn 감소 |

PM4 관점:  
API 호출·submit churn이 줄면 드라이버 백엔드 명령 스트림 구성 빈도와 패킷 관리 부담이 완화된다.

---

## 복습 체크리스트 (30초)

- [ ] Pipeline Layout의 두 구성요소를 말할 수 있다
- [ ] `clSetKernelArg`를 compile chain으로 착각하지 않는다
- [ ] first-dispatch 3원인을 자동으로 말할 수 있다
- [ ] descriptor mismatch가 왜 runtime 근처에서 터지는지 설명할 수 있다

---

## 관련 글

- [오답노트 #01](/opencl-wrong-note-barrier-scope/) — DescriptorSet/Binding 오류, PM4 계층 오류
- [퀴즈 문제 창고](/opencl-quiz-bank-01/) — 이 오답들의 원본 문제

## 관련 용어

[[descriptor-set]], [[pipeline-layout]], [[pm4-packet]], [[ANGLE]], [[barrier]]
