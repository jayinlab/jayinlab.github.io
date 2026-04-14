---
title: "고정 슬롯이 빠른 이유 — 슬롯 기반 계약의 성능 원리"
date: 2026-04-13
slug: "opencl-note-fixed-slots-fast"
draft: false
type: "note"
series: "opencl-deep-dive"
tags: ["vulkan", "descriptor", "performance"]
difficulty: "intermediate"
layer: "VK"
---

"왜 set/binding 같은 고정 슬롯 계약이 성능에 유리한가?"  
물류센터 비유로 먼저 이해하고, 기술적 원리로 연결한다.

---

## 비유: 거대 물류센터 자동 분류기

GPU를 "초당 수천만 개의 박스를 분류하는 자동 물류센터"라고 생각하자.

| 비유 | 실제 |
|------|------|
| 박스 | 버퍼/이미지 리소스 |
| 분류기 | GPU 실행 유닛 |
| 규격표 | descriptor set layout + pipeline layout |
| 실제 박스 | runtime 바인딩된 VkBuffer 핸들 |

---

### 느린 방식 — 규칙 없음, 매번 물어보기

```
작업할 때마다:
  "이 박스 타입이 뭐지?"        → 타입 확인
  "어디에 두지?"               → 위치 계산
  "이 포인터 지금 안전한가?"    → 유효성 검사

매 접근마다 질의/검증 → 분류기가 멈추고 대기 → 처리량 감소
```

### 빠른 방식 — 규격 먼저 고정

```
사전에 규칙 정의:
  set0/binding0 → StorageBuffer
  set0/binding1 → StorageBuffer
  set0/binding2 → StorageBuffer

실행 중:
  "binding 0" → 주소 바로 점프 → 처리
  → 런타임 추론 없음
```

---

## 기술적으로 빨라지는 이유 4가지

```
1. 주소 계산 단순화
   슬롯 인덱스 → descriptor table 접근 경로가 예측 가능
   → 분기/추론 없이 바로 점프

2. 검증 비용 앞당김
   타입/개수/가시성 검사를 create/bind 단계에 집중
   → dispatch 시점에 반복 검증 불필요

3. 명령 스트림 정형화
   드라이버가 GPU 명령(PM4 등)을 더 규칙적으로 구성 가능
   → 패킷 생성 오버헤드 감소

4. 하드웨어 친화성
   GPU는 규칙적/예측 가능한 메모리 접근에서 효율 최고
   → cache hit rate 향상, pipeline stall 감소
```

---

## 왜 제약이 빡세게 느껴지나?

Vulkan 계열 모델은 **"자유도 일부"를 포기**하고 대신:
- 성능
- 예측 가능성
- 디버깅 가능성

을 얻는 명시적 설계다.

OpenGL처럼 드라이버가 "알아서 해주는" 편의성은 없지만,  
그 편의성의 대가가 숨겨진 런타임 비용이었다.

---

## 한 줄 결론

> 고정 슬롯 계약은 런타임 추론 비용을 줄여 파이프라인 정지를 줄이고, 그래서 빠르다.

---

## 이해 확인 질문

### Q1. "느린 방식"에서 매 접근마다 드는 비용은 무엇인가?

<details>
<summary>정답 보기</summary>

타입 확인, 위치 계산, 유효성 검사 — 이 질의/검증이 매 접근마다 발생해  
분류기(GPU 실행 유닛)가 멈추고 처리량이 떨어진다.

</details>

### Q2. 고정 슬롯이 빠른 기술적 이유 중 "검증 비용 앞당김"이란?

<details>
<summary>정답 보기</summary>

descriptor 타입/개수/stage 검사를 **pipeline 생성/bind 단계**에 집중한다.  
따라서 dispatch 시점에 반복 검증이 필요 없어지고, GPU 실행 경로가 단순해진다.

</details>

### Q3. Vulkan이 자유도를 줄이는 대신 얻는 것 3가지는?

<details>
<summary>정답 보기</summary>

1. **성능** — 런타임 추론/추가 검증 비용 제거
2. **예측 가능성** — 드라이버와 하드웨어가 더 최적화된 경로 준비 가능
3. **디버깅 가능성** — 불일치가 늦게 터지지 않고 create/bind 시점에 드러남

</details>

---

## 관련 글

- [Layout 호환성](/opencl-note-layout-compat/) — 고정 슬롯의 호환/비호환 규칙
- [Arg0→슬롯 미니 예제](/opencl-note-arg0-to-slot/) — 구체 예제로 확인
- [물류센터 비유 치트시트](/opencl-note-logistics-cheatsheet/) — 전체 스택 비유 매핑

## 관련 용어

[[descriptor-set]], [[pipeline-layout]], [[pm4-packet]], [[ANGLE]]
