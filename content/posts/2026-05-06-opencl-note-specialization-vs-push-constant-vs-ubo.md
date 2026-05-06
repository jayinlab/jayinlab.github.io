---
title: "Specialization Constant vs Push Constant vs UBO — 한눈에 정리"
date: 2026-05-06
slug: "opencl-note-specialization-vs-push-constant-vs-ubo"
draft: false
type: "note"
series: "opencl-deep-dive"
tags: ["vulkan", "spirv", "performance", "shader", "descriptor"]
difficulty: "beginner"
---

헷갈리는 세 가지를 한 줄로 먼저 잡자.

- **Specialization Constant**: 파이프라인 생성 시 고정되는 상수(컴파일 최적화용)
- **Push Constant**: 디스패치/드로우 직전에 빠르게 넣는 소량 상수
- **UBO**: 디스크립터로 바인딩하는 읽기 전용 상수 버퍼(크고 구조화된 데이터)

---

## 1. 가장 빠른 선택 기준

- "값이 자주 안 바뀌고, 컴파일 최적화 이득이 크다" → **Specialization Constant**
- "값이 자주 바뀌고, 아주 작다" → **Push Constant**
- "값이 많고, 구조체/배열로 관리해야 한다" → **UBO**

---

## 2. 수명/변경 타이밍으로 이해하기

### Specialization Constant
- 언제 정함: `vkCreate*Pipeline` 시점
- 한 번 정하면: 그 파이프라인에 고정
- 장점: 드라이버가 상수 전파/분기 제거 같은 최적화 하기 좋음
- 단점: 값 바꾸려면 보통 파이프라인 변형(variant) 필요

### Push Constant
- 언제 정함: `vkCmdPushConstants` 호출 시점(커맨드 기록 중)
- 한 번 정하면: 그 커맨드 버퍼 실행 구간에 적용
- 장점: 매우 가볍고 빠른 갱신
- 단점: 크기 제한이 작음(디바이스 제한 확인 필요)

### UBO
- 언제 정함: 버퍼 작성 + descriptor set 바인딩 시점
- 한 번 정하면: 같은 descriptor 바인딩 동안 재사용 가능
- 장점: 데이터가 커도 관리 가능, 구조화 용이
- 단점: push constant보다 바인딩/메모리 경로 오버헤드 큼

---

## 3. 비용/유연성 트레이드오프

- **Specialization Constant**: 유연성 낮음 / 최적화 잠재력 큼
- **Push Constant**: 유연성 높음(소량) / 런타임 오버헤드 매우 낮음
- **UBO**: 유연성 높음(대량) / 일반적인 버퍼+디스크립터 오버헤드

---

## 4. 실전 예시

### A) 타일 크기(알고리즘 분기 기준)
- 프레임마다 안 바뀜, 최적화 이득 큼
- → **Specialization Constant**

### B) 프레임별 작은 파라미터(노출값, threshold)
- 매 디스패치/드로우마다 바뀔 수 있음
- → **Push Constant**

### C) 카메라 행렬, 조명 배열, 머티리얼 집합
- 데이터 큼, 구조체/배열
- → **UBO**

---

## 5. 자주 하는 실수

1) Push Constant에 큰 데이터를 밀어 넣으려는 시도
- 제한 작음. 큰 건 UBO/SSBO로.

2) 자주 바뀌는 값을 Specialization Constant로 관리
- 파이프라인 variant 폭발로 이어짐.

3) 작은 스칼라까지 모두 UBO로만 처리
- 경우에 따라 push constant가 훨씬 단순/저비용.

---

## 6. OpenCL 관점에 연결

OpenCL에서 커널 인자로 넘기던 "작은 스칼라"는 Vulkan에서 push constant로 옮기면 깔끔한 경우가 많고,
커널 설정값 중 "컴파일 시 고정하면 이득"인 값은 specialization constant가 대응된다.
큰 상수 데이터는 UBO(또는 경우에 따라 SSBO)가 실전적이다.

---

## 한 장 요약

- **Specialization Constant** = 파이프라인 생성 시점 상수 (최적화)
- **Push Constant** = 실행 직전 소량 상수 (빠른 갱신)
- **UBO** = 읽기 전용 상수 버퍼 (큰 데이터)

"자주 바뀌고 작은 값은 push, 잘 안 바뀌고 최적화 중요하면 spec, 크고 구조화되면 UBO"로 기억하면 된다.

## 관련 용어

- [[SPIR-V]], [[descriptor-set]], [[pipeline-layout]], [[command-buffer]]
