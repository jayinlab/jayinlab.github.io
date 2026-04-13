---
title: "OpenCL Note #16 — Pipeline/Layout/Descriptor 호환성 그림으로 이해하기"
date: 2026-04-01
slug: "opencl-note-16-layout-compatibility-mermaid"
draft: false
type: "note"
series: "opencl-deep-dive"
tags: ["vulkan", "pipeline", "descriptor", "mermaid"]
difficulty: "intermediate"
---

이번 노트는 네 질문에 정확히 맞춘 "그림 중심" 설명이다.

핵심 질문:
- 왜 layout이 필요할까?
- pipeline 10개, descriptor set 3개라면 정말 호환 제약이 생길까?

답: **그렇다.** 그리고 그 제약이 성능/검증/예측 가능성을 만든다.

---

## 1) 한 줄 요약

- Pipeline = 연산 로직
- Descriptor Set = 실제 리소스 묶음
- Layout = 둘이 맞물리는 규격(계약)

즉, 아무 set이나 아무 pipeline에 꽂을 수 없다.

---

## 2) 호환/비호환 그림 (Mermaid)

<div class="mermaid">
flowchart LR
subgraph PL["Pipeline Layout Contract"]
C0["set0: b0 storage, b1 storage, b2 storage"]
C1["push constant: 4 bytes int n"]
end
subgraph P["Pipeline"]
P1["Pipeline A"]
P2["Pipeline B"]
end
subgraph S["Descriptor Sets"]
S1["Set X<br/>b0 storage<br/>b1 storage<br/>b2 storage"]
S2["Set Y<br/>b0 uniform<br/>b1 storage<br/>b2 storage"]
S3["Set Z<br/>b0 storage<br/>b1 storage"]
end
PL --> P1
PL --> P2
S1 -->|compatible| P1
S1 -->|compatible| P2
S2 -->|incompatible: b0 type mismatch| P1
S3 -->|incompatible: missing b2| P2
</div>

이 그림에서 핵심은:
- Set X만 계약과 맞아서 bind 가능
- Set Y/Z는 타입/개수 불일치로 호환 불가

---

## 3) 왜 이런 제약을 일부러 두나?

### (A) 검증
런타임 직전이 아니라 더 이른 단계에서 "이 조합 가능/불가"를 판단할 수 있다.

### (B) 성능
드라이버가 "어떤 형식의 리소스가 들어올지"를 미리 알고 최적화하기 쉽다.

### (C) 디버깅
"무엇이 안 맞는지"를 계약 위반으로 명확히 지적할 수 있다.

---

## 4) 역사 관점 한 문단

과거에는 드라이버가 암묵 상태를 많이 추론해야 했고, 그만큼 성능 예측과 디버깅이 어려웠다.
Vulkan은 반대로 계약(Layout) 중심으로 바꿔, 애플리케이션이 명시적으로 규격을 선언하도록 했다.
그 대가로 코드량은 늘지만, 실행/검증/최적화는 훨씬 예측 가능해졌다.

---

## 이해 확인 질문

### Q1. Pipeline과 Descriptor Set이 각각 담당하는 것은?
<details>
  <summary>정답 보기</summary>
  Pipeline은 계산 로직/실행 상태, Descriptor Set은 실제 리소스 묶음.
</details>

### Q2. Layout 계약이 없으면 어떤 문제가 생기나?
<details>
  <summary>정답 보기</summary>
  호환성 검증이 늦어지고, 드라이버 최적화/예측 가능성이 떨어지며 디버깅이 어려워진다.
</details>

### Q3. Set Y가 비호환인 직접 이유는?
<details>
  <summary>정답 보기</summary>
  계약은 b0이 storage인데 Set Y는 b0을 uniform으로 제공해 타입이 불일치한다.
</details>
