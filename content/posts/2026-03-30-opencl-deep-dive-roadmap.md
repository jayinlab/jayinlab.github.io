---
title: "OpenCL Note #14 — 심화 로드맵 Overview (다음 라운드)"
date: 2026-03-30
slug: "opencl-deep-dive-roadmap"
draft: false
---

좋아, 여기서부터는 "심화 라운드"다.
이 문서는 앞으로 네가 어떤 순서로, 어떤 산출물을 보게 될지 미리 보여준다.

(고정 목표: ANGLE OpenCL entry → clspv/SPIR-V → Vulkan dispatch → AMD PM4 mental model)

## 심화에서 볼 것 (순서)

1. **ANGLE 실제 함수 체인 표**
   - 엔트리포인트부터 build/enqueue 경로를 파일/함수 단위로 채움
2. **clspv 실습 확장**
   - vector_add 외에 local memory, barrier 커널 추가
3. **SPIR-V ↔ Vulkan 객체 대응 심화**
   - descriptor/pipeline layout이 실제 코드에서 어떻게 만들어지는지 근거 수집
4. **Dispatch 경로 계측**
   - compile 체인 vs submit 체인 시간 분리
5. **AMD PM4 근접 해석**
   - Type3/dispatch 주변 패킷 패밀리 중심으로 시퀀스 해석
6. **최종 통합 문서화 + 복습 루프**
   - 체크리스트/카드/주기 복습(원하면 cron)

## Mermaid 종합 흐름도

<div class="mermaid">
flowchart TD
    A[OpenCL API] --> B[ANGLE OpenCL Path]
    B --> C1[Compile Chain]
    B --> C2[Submit Chain]
    C1 --> D[Vulkan Objects]
    C2 --> D
    D --> E[Bind and Dispatch]
    E --> F[Driver Backend]
    F --> G[AMD PM4 Stream]
    G --> H[Compute Execute]
</div>

## 지금 단계에서의 포커스

- 완벽한 비트필드 암기보다,
- "경계(compile vs submit)"와 "연결(spirv->layout->pipeline->dispatch)"을 흔들리지 않게 유지하는 것.

## 이해 확인 질문

### Q1. 심화 라운드의 1순위 산출물은?
<details>
  <summary>정답 보기</summary>
  ANGLE 실제 함수 체인 표(파일/함수/역할/근거라인).
</details>

### Q2. 왜 Mermaid 다이어그램이 유용한가?
<details>
  <summary>정답 보기</summary>
  계층/경계/흐름을 한눈에 보여줘서 개념 혼선을 줄인다.
</details>
