---
title: "Z-buffer는 왜 화면 뒤쪽을 기억할까"
date: 2026-07-12
slug: "gpu-fun-fact-z-buffer-depth-memory"
draft: false
type: "note"
series: "gpu-fun-facts"
tags: ["gpu", "z-buffer", "depth-test", "graphics-history"]
difficulty: "beginner"
---

3D 장면을 그릴 때 가장 단순한 질문은 “무엇이 앞에 있나?”다. 벽 뒤에 있는 의자는 화면에 보이면 안 되고, 캐릭터 뒤쪽의 배경은 캐릭터 색을 덮으면 안 된다. 사람 눈에는 당연한 일이지만, GPU 입장에서는 수많은 triangle이 쏟아져 들어오는 중에 pixel마다 앞뒤를 계속 판단해야 한다.

초기 computer graphics에서는 이 문제를 풀기 위해 물체를 멀리 있는 순서대로 정렬해서 그리는 방식도 생각할 수 있었다. 하지만 장면이 복잡해지면 정렬이 까다롭다. 서로 교차하는 물체, 아주 많은 작은 triangle, 움직이는 camera가 있으면 “완벽한 그리기 순서”를 매번 만드는 일 자체가 부담이 된다.

Z-buffer의 발상은 꽤 실용적이다. 화면의 color buffer 옆에 “이 pixel에 지금까지 그려진 것 중 가장 앞에 있는 깊이”를 적어 두는 장부를 하나 더 둔다. 새 fragment가 오면 자기 depth와 장부의 depth를 비교한다. 더 앞이면 color를 바꾸고 depth도 갱신한다. 더 뒤면 그냥 버린다. 전체 물체를 거창하게 정렬하지 않고, pixel 자리에서 작은 심판을 반복하는 셈이다.

이 아이디어는 1970년대 Ed Catmull의 hidden-surface 작업과 함께 자주 언급된다. 흥미로운 점은 이 오래된 발상이 지금도 GPU rendering의 기본 감각으로 남아 있다는 것이다. Vulkan 명세의 fragment operations에도 depth test는 framebuffer에 값을 쓸지 말지를 결정하는 단계로 등장한다.

왜 중요할까? Z-buffer를 알면 GPU가 “그림을 순서대로 덧칠하는 기계”만은 아니라는 점이 보인다. 화면 한 장 뒤에는 color뿐 아니라 depth, stencil, coverage 같은 작은 기록들이 같이 움직이고, modern GPU API의 render pass나 depth attachment 같은 말도 결국 이 장부들을 어떻게 준비하고 쓰느냐에 닿아 있다.

Source note: Catmull의 1974년 보고서 「A Subdivision Algorithm for Computer Display of Curved Surfaces」는 hidden-surface, z-buffer, shaded picture를 키워드로 다룬다. Vulkan specification의 Fragment Operations 장은 rasterization된 fragment가 framebuffer에 쓰이기 전에 depth test 같은 per-fragment operation을 거친다고 설명한다.
