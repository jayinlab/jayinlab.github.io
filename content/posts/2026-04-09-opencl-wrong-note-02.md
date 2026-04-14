---
title: "OpenCL 오답노트 #02 — 부분정답/부분오답 포함 복습"
date: 2026-04-09
slug: "opencl-wrong-note-02"
draft: false
type: "wrong-note"
series: "opencl-deep-dive"
tags: ["opencl", "vulkan", "barrier"]
difficulty: "intermediate"
layer: "CL"
---

이번 노트는 2026-04-09 퀴즈에서 **완전히 맞지 못한 항목(오답 + 부분정답 + 부분오답)**을 한 번에 복습하기 위한 문서다.

---

## 1) DescriptorSet/Binding 매핑 (C001)

### 내가 헷갈린 포인트
- `clSetKernelArg` 호출 시점의 동적 동작으로 이해하려는 경향

### 정리
- 핵심은 호출 타이밍이 아니라 **정적 인터페이스 계약**이다.
- SPIR-V의 `DescriptorSet`/`Binding`은 Vulkan의 **Descriptor Set Layout(DSL) binding 정의**와 대응된다.
- 그리고 DSL들의 집합이 Pipeline Layout 계약을 이룬다.

### 한 줄 암기
`DescriptorSet/Binding -> Descriptor Set Layout binding -> Pipeline Layout contract`

---

## 2) PM4 계층 위치 (C002, 부분정답)

### 내가 맞춘 부분
- PM4가 하드웨어 쪽에 가깝다는 감각은 맞음

### 보정
- PM4는 보통 **드라이버 백엔드 커맨드 스트림/CP 인접 계층**으로 이해한다.
- OpenCL API 레벨과는 멀다.

### 한 줄 암기
`OpenCL API -> Vulkan recording -> driver backend stream -> PM4 -> GPU`

---

## 3) Pipeline Layout 정의 (C004)

### 내가 헷갈린 포인트
- "버퍼 타입 약속" 감각은 있었지만 구성요소를 명시하지 못함

### 정리
Pipeline Layout은 정확히:
1. `setLayout[]` (각 descriptor set의 슬롯 규격)
2. `pushConstantRange[]`

이 둘로 구성되는 **호환성 계약점(contract)**이다.

---

## 4) clSetKernelArg 체인 분류 (C006)

### 내가 헷갈린 포인트
- compile chain 쪽으로 분류함

### 정리
- 일반적으로 `clSetKernelArg`는 **submit 전 상태 준비(바인딩 상태 구성)**에 더 가깝다.
- 코드 생성/빌드 산출물 자체를 바꾸는 compile 단계와 구분해서 보는 게 안전하다.

---

## 5) mismatch 실패 시점 (C007, 부분정답)

### 내가 맞춘 부분
- runtime에서 터질 수 있다고 인지함

### 보정
- 대부분은 **bind/validation/dispatch 인접 런타임 단계**에서 드러난다.
- 이유: 컴파일 시점에 실제 바인딩 조합이 확정되지 않는 경우가 많음.

---

## 6) first-dispatch latency (C008)

### 내가 맞춘 부분
- warmup/캐시 감각은 맞음

### 보정 (3축으로 고정)
1. pipeline 생성/캐시 미스
2. driver backend JIT/내부 컴파일
3. first submit 경로의 초기화 비용

---

## 7) kernel-signature drift -> runtime fail chain (C009, 부분정답)

### 보완된 정답 체인
1. kernel arg 순서/타입/개수 변경
2. clspv 산출 SPIR-V resource interface(set/binding 의미) 변화
3. host 측 descriptor write/layout 가정 미갱신
4. bind/dispatch 검증 또는 런타임에서 incompatibility 실패

---

## 8) tiny-dispatch CPU 병목 최적화 (C010, 부분정답)

### 내가 맞춘 부분
- 재사용 전략 방향은 맞음

### 보정
- "dispatch 자체 재사용"보다는 아래처럼 구조화:
  1. command buffer recording 재사용(또는 secondary 활용)
  2. submit 횟수/동기화 비용 감소(배치화)
  3. pipeline/layout/descriptor 갱신 churn 감소

### PM4 관점 한 줄
API 호출·submit churn이 줄면 드라이버 백엔드 명령 스트림 구성 빈도와 패킷 관리 부담이 완화된다.

---

## 복습 체크리스트 (30초)
- [ ] Pipeline Layout의 두 구성요소를 말할 수 있다
- [ ] `clSetKernelArg`를 compile chain으로 착각하지 않는다
- [ ] first-dispatch 3원인을 자동으로 말할 수 있다
- [ ] descriptor mismatch가 왜 runtime 근처에서 터지는지 설명할 수 있다
