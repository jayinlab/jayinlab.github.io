---
title: "OpenCL Note #19 — 애니메이션 실험 #2 (JS v3): Compile Chain vs Submit Chain"
date: 2026-04-02
slug: "opencl-note-19-chain-animation"
draft: false
type: "note"
series: "opencl-deep-dive"
tags: ["angle", "vulkan", "animation"]
difficulty: "intermediate"
animation: true
layer: "ANGLE"
---

이번 버전은 JS 표준형 v2다.

- 모바일 overflow 방지
- Play 버튼 1개로 3단계 자동 진행
- 속도 슬라이더 + 단계 메시지

{{< chain_anim_v2 >}}

## 확인 포인트

- compile/submit 두 점이 모두 보이는지
- 속도 슬라이더가 즉시 반영되는지
- compile 점이 submit 점보다 느린지
