---
title: "OpenCL Note #19 — 애니메이션 실험 #2 (JS v2): Compile Chain vs Submit Chain"
date: 2026-04-02
slug: "opencl-note-19-chain-animation"
draft: false
---

이번 버전은 JS 표준형 v2다.

- 체인 2개 모두 안정적으로 표시
- 속도 슬라이더 제공
- 단계별 설명(compile 쪽은 느리고, submit 쪽은 빠름)

{{< chain_anim_v2 >}}

## 확인 포인트

- compile/submit 두 점이 모두 보이는지
- 속도 슬라이더가 즉시 반영되는지
- compile 점이 submit 점보다 느린지
