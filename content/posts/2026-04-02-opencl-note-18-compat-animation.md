---
title: "OpenCL Note #18 — 애니메이션 실험 #1 (JS v3): Pipeline-Descriptor 호환/비호환"
date: 2026-04-02
slug: "opencl-note-18-compat-animation"
draft: false
type: "note"
series: "opencl-deep-dive"
tags: ["vulkan", "pipeline", "descriptor", "animation"]
difficulty: "intermediate"
animation: true
layer: "VK"
---

이번 버전은 JS 표준형 v2다.

- 모바일 우선 레이아웃
- Play 버튼 1개로 3단계 자동 진행
- 슬롯/결과를 단계별로 강조

{{< compat_anim_v2 >}}

## 확인 포인트

- Step 버튼이 모두 동작하는지
- Case 전환 시 slot 색상이 즉시 바뀌는지
- compatible/incompatible 결과가 올바른지
