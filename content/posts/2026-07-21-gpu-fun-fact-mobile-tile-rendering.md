---
title: "모바일 GPU는 왜 화면을 tile로 쪼갤까"
date: 2026-07-21
slug: "gpu-fun-fact-mobile-tile-rendering"
draft: false
type: "note"
series: "gpu-fun-facts"
tags: ["gpu", "mobile-gpu", "tile-based-rendering", "powervr", "rendering-history"]
difficulty: "beginner"
---

휴대폰 GPU를 생각하면 작고 느린 GPU가 desktop GPU를 흉내 낸다고 상상하기 쉽다. 그런데 많은 mobile GPU는 애초에 화면을 그리는 방식부터 다르게 잡았다. 화면 전체를 한 번에 큰 canvas처럼 밀어붙이기보다, 작은 rectangular tile들로 나눈 뒤 tile 하나씩 처리하는 식이다.

이 방식이 중요한 이유는 memory 때문이다. GPU가 색, depth, texture, 중간 결과를 계속 system memory로 읽고 쓰면 전력과 bandwidth를 많이 쓴다. Desktop이라면 더 큰 전력 예산과 memory bus로 버틸 수 있지만, phone이나 tablet에서는 battery와 발열이 바로 한계가 된다. 그래서 tile-based renderer는 작은 tile 안에서 가능한 많은 일을 on-chip memory에 붙잡아 두려 한다.

PowerVR의 Tile-Based Deferred Rendering 설명을 보면 아이디어가 꽤 직관적이다. 먼저 scene의 geometry를 모아 작은 tile로 나누고, 보이지 않을 pixel을 가능한 일찍 버린 뒤, 실제 texturing과 shading은 필요한 부분에 집중한다. tile 하나는 작기 때문에 color/depth 같은 중간 data를 빠른 chip memory 안에 둘 수 있고, 마지막 결과만 외부 memory로 내보내는 쪽에 가까워진다.

물론 공짜는 아니다. Tile을 나누고, geometry를 정리하고, render pass 구조를 잘 맞춰야 한다. 어떤 효과는 tile 밖의 정보가 필요해서 이 장점을 덜 살릴 수도 있다. 그래도 mobile GPU에서 이 설계가 오래 살아남은 이유는 분명하다. 같은 화면을 그리더라도, 외부 memory로 왕복하는 횟수를 줄이면 성능뿐 아니라 전력에서도 이득이 크기 때문이다.

왜 중요할까? GPU 성능은 shader 연산량만으로 결정되지 않는다. 특히 mobile에서는 “얼마나 계산했나”만큼 “얼마나 memory를 오갔나”가 중요하다. Tile-based rendering을 알면 mobile graphics 최적화에서 render pass, depth, clear, bandwidth 이야기가 왜 자꾸 나오는지 감이 잡힌다.

Source note: Imagination Technologies의 PowerVR architecture 문서는 Tile-Based Deferred Rendering이 geometry를 작은 rectangular tile로 나누고, tile 단위 처리를 통해 data를 빠른 on-chip memory에 유지하며, system memory bandwidth와 power requirement를 줄이는 것이 mobile/tablet 같은 battery-limited device에서 중요한 장점이라고 설명한다.
