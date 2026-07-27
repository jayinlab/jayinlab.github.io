---
title: "MSAA는 왜 마지막에 접는 단계가 필요할까"
date: 2026-07-27
slug: "gpu-fun-fact-msaa-resolve"
draft: false
type: "note"
series: "gpu-fun-facts"
tags: ["gpu", "msaa", "rendering", "vulkan", "direct3d"]
difficulty: "beginner"
---

MSAA를 켜면 화면 가장자리가 조금 부드러워진다. 이름은 Multisample Anti-Aliasing인데, 감은 간단하다. pixel 하나를 딱 한 번만 찍지 않고, 그 안의 여러 sample 지점을 보고 triangle이 얼마나 걸쳤는지 더 섬세하게 판단한다. 덕분에 계단처럼 보이던 edge가 덜 거칠어진다.

그런데 여기서 작은 문제가 생긴다. 우리가 최종적으로 화면에 보여 주거나 texture로 읽고 싶은 것은 보통 pixel마다 color 하나인 image다. 반면 MSAA render target은 pixel 하나 안에 sample color를 여러 개 들고 있다. 이 상태 그대로는 일반적인 single-sample texture처럼 다루기 어렵다. 그래서 마지막에 여러 sample을 하나의 값으로 접는 resolve 단계가 필요하다.

Vulkan의 `vkCmdResolveImage` 문서는 resolve 동안 source의 각 pixel 위치에 해당하는 sample들이 destination에 쓰이기 전에 single sample로 변환된다고 설명한다. Floating-point나 normalized format에서는 평균 또는 weighted average 같은 방식이 쓰일 수 있고, integer format에서는 한 sample 값이 선택된다. Direct3D 11에도 `ResolveSubresource`가 따로 있어서 multisampled resource를 non-multisampled resource로 copy한다고 설명한다.

재미있는 점은 resolve가 단순한 복사처럼 보이지만 사실은 "여러 관측값을 하나의 pixel로 결정하는 순간"이라는 것이다. 특히 tile-based GPU에서는 MSAA sample을 tile 안의 빠른 memory에 오래 붙잡아 두다가, 화면에 내보낼 때만 resolve하면 bandwidth를 아낄 수 있다. 반대로 resolve 시점이 애매하면 성능과 image layout, attachment 사용 흐름까지 같이 꼬일 수 있다.

왜 중요할까? MSAA resolve를 알면 anti-aliasing이 magic filter가 아니라, render target의 sample 구조와 최종 image 형식 사이를 이어 주는 변환이라는 감이 잡힌다. GPU API에 resolve 명령이 따로 보이는 이유도 이 때문이다. edge를 부드럽게 만드는 계산과, 그 결과를 보통 texture처럼 쓰게 만드는 정리는 서로 다른 일이다.

Source note: Vulkan `vkCmdResolveImage` reference는 resolve 중 source pixel 위치의 samples가 destination에 쓰이기 전 single sample로 변환된다고 설명한다. Microsoft Direct3D 11 `ResolveSubresource` 문서는 multisampled resource를 non-multisampled resource로 copy하는 API라고 설명한다.
