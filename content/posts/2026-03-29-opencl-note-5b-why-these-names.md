---
title: "OpenCL Note #07 — 왜 이름이 pipeline이고 descriptor set일까? (역사/설계 관점)"
date: 2026-03-29
slug: "opencl-note-5b-why-these-names"
draft: false
type: "note"
series: "opencl-deep-dive"
tags: ["vulkan", "pipeline", "descriptor"]
difficulty: "beginner"
---

이번 노트는 용어 암기가 아니라, **이름의 배경**을 이해해서 오래 기억하는 목적이다.

---

## 1) 왜 "Pipeline"이라는 이름인가

### 역사 배경
GPU는 원래 그래픽 처리 하드웨어로 발전했다.
고전 그래픽스에서는 입력 정점(vertex)이 여러 단계를 거쳐 최종 픽셀로 가는
**처리 흐름(flow)**이 핵심이었고, 이걸 "graphics pipeline"이라 불렀다.

예: vertex 처리 → primitive 조립 → rasterization → fragment 처리

### 설계 관점
Vulkan은 이 전통을 유지하면서,
"GPU가 어떤 상태/셰이더 조합으로 일을 할지"를 하나의 실행 객체로 묶었다.
그게 pipeline이다.

compute에서도 단계 수는 단순하지만 개념은 같다.
- 셰이더 코드
- 고정/동적 상태
- 레이아웃 호환 조건
을 합쳐 "이 경로로 처리"한다고 보는 것.

즉, pipeline은 이름이 아니라 **처리 모델 자체**다.

---

## 2) 왜 "Descriptor Set"이라는 이름인가

### descriptor란?
GPU가 읽을 리소스(버퍼/이미지)를 직접 값으로 들고 있지 않고,
"어디에 어떤 리소스가 있다"는 **설명자(descriptor)**를 통해 참조한다.

### set이란?
실행에 필요한 descriptor들을 binding 번호에 맞춰 묶은 집합(set).

예: set 0
- binding 0 = a buffer
- binding 1 = b buffer
- binding 2 = out buffer

그래서 descriptor set은
"이번 실행에 쓸 데이터 참조들 묶음"이라는 의미로 이름이 붙었다.

---

## 3) 왜 Layout이 따로 있나 (설계 철학)

Vulkan은 런타임 모호성을 줄이고 검증을 앞당기기 위해
"실체"와 "규격"을 분리했다.

- Descriptor Set Layout: 슬롯 규격서(타입/개수/stage 사용 정보)
- Descriptor Set: 그 규격에 맞춰 꽂은 실제 리소스
- Pipeline Layout: 파이프라인이 기대하는 전체 입력 규격(sets + push constants)

이 분리 덕분에 얻는 것:
1. 호환성 검증이 명확해짐
2. 드라이버 최적화 여지 증가
3. 오류가 늦게 터지지 않고 빨리 드러남

---

## 4) 기억용 한 문장

- **Pipeline**: "어떻게 계산할지"에 대한 실행 경로
- **Descriptor Set**: "무엇으로 계산할지"에 대한 데이터 참조 묶음
- **Layout**: 둘 사이 계약서

---

## 이해 확인 질문 (Self-check)

1. pipeline이라는 이름이 그래픽 역사와 어떻게 연결되나?
2. descriptor와 descriptor set의 차이는?
3. layout 분리 설계가 성능/검증에 주는 이점은?
4. pipeline layout이 왜 계약서라고 불릴 수 있나?
5. 지금 네 말로 "pipeline vs descriptor set"을 한 줄씩 정의해봐.

## 복습 카드 (Anki 스타일)

- Q: Pipeline이라는 이름의 뿌리는?  
  A: 그래픽 처리 단계 흐름(graphics pipeline) 전통.

- Q: Descriptor Set의 본질은?  
  A: 실행에 필요한 리소스 참조(descriptor)들의 묶음.

- Q: Vulkan이 layout을 분리한 핵심 이유는?  
  A: 호환성 검증 명확화와 성능/최적화 안정성.

- Q: Pipeline Layout이 담는 두 축은?  
  A: Descriptor set layouts + push constant ranges.


## 이해 확인 질문 정답 (토글)

### 핵심 정답 요약
<details>
  <summary>정답 보기</summary>
이 노트의 핵심은 **경계 구분**(compile vs submit, layout vs set)과 **연결**(OpenCL→SPIR-V→Vulkan→Dispatch)을 흔들리지 않게 잡는 것이다.
</details>
