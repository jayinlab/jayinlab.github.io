---
title: "NVIDIA의 첫 칩은 왜 삼각형에 지고 말았을까"
date: 2026-07-30
slug: "gpu-fun-fact-nv1-triangles"
draft: false
type: "note"
series: "gpu-fun-facts"
tags: ["gpu", "nvidia", "direct3d", "graphics-history"]
difficulty: "beginner"
---

지금 3D graphics를 생각하면 triangle이 너무 당연해 보인다. 복잡한 캐릭터도, 자동차도, 지형도 결국 작은 triangle 조각으로 쪼개서 GPU에 보낸다. 그런데 1990년대 중반에는 그 길이 완전히 굳어지기 전이었다.

NVIDIA의 첫 제품 NV1은 그 분위기를 잘 보여준다. Jon Peddie Research의 회고에 따르면 NV1은 1995년 무렵 나온 multimedia accelerator였고, 2D/3D graphics뿐 아니라 video, audio, game port까지 한 칩에 묶으려 했다. 더 특이한 점은 3D 쪽에서 quadratic texture mapping이라는 방식을 밀었다는 것이다. 당시 널리 퍼지던 polygon/triangle 중심 방식과는 꽤 다른 bet이었다.

아이디어 자체는 이상한 장난이 아니었다. 곡면을 더 자연스럽게 표현하고, PC multimedia board 하나로 여러 일을 처리하겠다는 야심이 있었다. 문제는 hardware만 멋지다고 ecosystem이 따라오는 건 아니라는 점이었다. 게임 개발자는 SDK와 API에 맞춰 asset, engine, tool을 만들어야 한다. 다른 hardware와 다른 방식이면 porting 비용이 커진다.

결국 시장은 triangle 쪽으로 굳어졌다. 오늘날 Direct3D 문서만 봐도 pipeline의 primitive topology는 point, line, triangle list/strip 같은 식으로 vertex를 어떻게 해석할지 정한다. 이 단순한 약속이 강력한 이유는 거의 모든 tool과 hardware가 같은 작은 조각을 공유할 수 있기 때문이다.

왜 중요할까? GPU 역사는 늘 "가장 우아한 수학"만 이긴 이야기가 아니다. 개발자가 쓰는 API, toolchain, game engine, driver가 함께 움직일 수 있는 모양이 살아남는다. NV1은 그 사실을 꽤 이른 시점에 보여준 사례다.

Source note: Jon Peddie Research의 Electronic Design 글은 NV1을 1995년 무렵의 NVIDIA 초기 multimedia accelerator로 소개하고, quadratic texture mapping 기반 접근과 개발자 설득의 어려움을 설명한다. Microsoft Direct3D primitive topology 문서는 현대 Direct3D pipeline에서 point, line, triangle list/strip 등이 vertex 해석 단위로 쓰인다고 정리한다.
