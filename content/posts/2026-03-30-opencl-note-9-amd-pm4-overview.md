---
title: "OpenCL Note #12 — AMD PM4 개요: Type3와 Dispatch 패킷 패밀리"
date: 2026-03-30
slug: "opencl-note-9-amd-pm4-overview"
draft: false
type: "note"
series: "opencl-deep-dive"
tags: ["pm4", "gpu", "amd"]
difficulty: "intermediate"
layer: "UMD"
---

이번 노트 목표:
- AMD PM4를 "당장 실무 추적 가능한 수준"으로 잡는다.
- 세부 비트필드 암기보다, **명령 스트림 mental model**을 먼저 만든다.

(고정 목표: ANGLE OpenCL entry → clspv/SPIR-V → Vulkan dispatch → AMD PM4 mental model)

---

## 1) PM4를 한 줄로

PM4는 GPU에 전달되는 **패킷 기반 command stream 포맷**이다.

CPU/드라이버는 "무엇을 실행할지"를 PM4 패킷으로 큐에 적고,
GPU의 커맨드 프로세서(CP)가 이를 해석해서 실행한다.

---

## 2) 왜 Type3가 중요한가

PM4에서 Type3는 보통 "실질적인 동작 명령"을 담는 핵심 클래스다.

예를 들어 mental model로 보면:
- 상태 설정 패킷
- 리소스/레지스터 설정 패킷
- dispatch/draw 트리거 패킷

우리가 OpenCL compute 경로에서 관심 있는 건,
결국 "dispatch를 일으키는 Type3 계열"과 그 전에 필요한 상태 설정 흐름이다.

---

## 3) OpenCL→Vulkan→PM4 연결 (개념 사다리)

1. OpenCL API enqueue
2. Vulkan command recording (`vkCmdDispatch` 계열)
3. 드라이버가 내부적으로 하드웨어 명령 스트림 준비
4. PM4 Type3 중심 패킷 시퀀스로 큐 제출
5. CP가 해석 후 compute 실행

핵심:
- PM4는 앱이 직접 쓰는 API가 아니라,
- 상위 API 호출이 최종적으로 내려가는 **하드웨어 근접 표현**이다.

---

## 4) 지금 단계에서 꼭 알아둘 포인트

### A. "패킷 자체"보다 "시퀀스"가 중요
한 패킷만 보면 의미가 약하고,
- 파이프라인/리소스 상태 설정
- dispatch 트리거
의 순서가 중요하다.

### B. dispatch는 단독 이벤트가 아님
dispatch 앞에 이미 많은 준비 패킷이 붙는다.
그래서 "dispatch 비용"은 앞단 상태 전환 비용과 함께 봐야 한다.

### C. PM4는 벤더/세대 의존성이 있다
AMD 내에서도 세대별 차이가 있을 수 있다.
지금은 공통 mental model을 만들고, 이후 세대별 디테일로 들어간다.

---

## 5) 학습용 최소 프레임 (암기 대신 구조)

아래 3줄만 먼저 고정하자.

1. PM4 = 패킷 스트림
2. Type3 = 실제 동작 명령 핵심 클래스
3. Dispatch는 상태 설정 시퀀스 뒤에 트리거됨

이 3줄이 고정되면, 이후 패킷 이름/필드를 붙여도 덜 잊는다.

---

## 6) 다음 단계 예고 (S9 직전)

다음 노트에서는
- 지금까지의 OpenCL→clspv→SPIR-V→Vulkan→PM4를
- 한 장짜리 종합 다이어그램 + 체크리스트로 정리한다.

---

## 이해 확인 질문 (토글형)

### Q1. PM4는 API 계층에서 어디쯤에 위치하나?
<details>
  <summary>정답 보기</summary>
  OpenCL/Vulkan 같은 상위 API 아래, 드라이버가 하드웨어에 제출하는 명령 스트림 근처(하드웨어 근접 계층).
</details>

### Q2. 왜 Type3를 먼저 잡아야 하나?
<details>
  <summary>정답 보기</summary>
  실제 동작(상태 변경/dispatch 트리거 등)을 담는 핵심 패킷 클래스라 추적 가치가 가장 크기 때문.
</details>

### Q3. dispatch 패킷만 보면 충분하지 않은 이유는?
<details>
  <summary>정답 보기</summary>
  dispatch 전에 필요한 상태/리소스 설정 패킷 시퀀스가 실행 가능성을 결정하기 때문.
</details>

### Q4. PM4 학습에서 먼저 외울 대상은 패킷 비트필드인가, 시퀀스 구조인가?
<details>
  <summary>정답 보기</summary>
  시퀀스 구조가 먼저다. 구조가 잡혀야 비트필드 암기가 의미를 가진다.
</details>

### Q5. 현재 고정 목표에서 PM4는 어떤 역할을 하나?
<details>
  <summary>정답 보기</summary>
  상위 소프트웨어 경로(OpenCL→Vulkan)가 실제 하드웨어 실행으로 내려가는 마지막 관찰 지점.
</details>

## 복습 카드 (Anki 스타일)

- Q: PM4의 본질은?  
  A: GPU에 제출되는 패킷 기반 명령 스트림.

- Q: Type3의 학습 우선순위가 높은 이유는?  
  A: 실제 동작 명령의 핵심 클래스이기 때문.

- Q: dispatch 분석에서 반드시 함께 봐야 할 것은?  
  A: dispatch 직전 상태/리소스 설정 패킷 시퀀스.

- Q: PM4는 왜 장치 종속성 이슈가 큰가?  
  A: 벤더/세대별 구현 차이가 존재하기 때문.
