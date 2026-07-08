---
title: "GPU texture는 왜 줄줄이 저장되지 않을까"
date: 2026-07-07
slug: "gpu-fun-fact-texture-tiling"
draft: false
type: "note"
series: "gpu-fun-facts"
tags: ["gpu", "texture", "memory", "tiling", "hardware"]
difficulty: "beginner"
---

이미지를 메모리에 저장한다고 하면 보통 왼쪽 위 pixel부터 한 줄씩 쭉 놓는 모습을 떠올리기 쉽다. CPU가 파일을 읽거나 화면 캡처를 다룰 때는 이런 row-major 방식이 자연스럽다. 그런데 GPU가 texture를 실제로 빠르게 읽을 때는 이 모양이 늘 좋은 답은 아니다.

이유는 GPU가 그림을 한 pixel씩 예쁘게 순서대로만 보지 않기 때문이다. texture filtering을 하거나 삼각형 안쪽을 칠할 때는 화면에서 가까운 주변 pixel들을 한꺼번에 자주 본다. row-major로만 놓으면 좌우 pixel은 메모리에서도 가까운데, 위아래 pixel은 한 줄 크기만큼 멀리 떨어질 수 있다. 작은 2D 이웃을 읽는 일이 메모리 입장에서는 갑자기 먼 곳을 뛰어다니는 일이 되는 셈이다.

그래서 많은 GPU는 texture를 작은 tile 단위로 쪼개거나, tile 안의 주소를 swizzle해서 배치한다. 간단히 말하면 “화면에서 가까운 pixel은 메모리에서도 가깝게” 만들려는 배치다. Mesa 문서는 linear image가 cache locality가 나쁠 수 있고, tiling/swizzling은 2D 공간에서 가까운 pixel이 메모리에서도 가까워지도록 재배열하는 방법이라고 설명한다.

숫자로 느껴보면 더 쉽다. 예를 들어 한 pixel이 4바이트이고 texture 한 줄이 1024 pixel이라면, row-major에서 바로 아래 pixel은 메모리상으로 4096바이트 뒤에 있다. 화면에서는 딱 한 칸 아래인데, 주소로는 꽤 멀다. 반대로 4x4나 8x8 같은 작은 tile 안에 주변 pixel을 모아두면, shader가 2x2나 4x4 주변을 샘플링할 때 필요한 값들이 같은 cache line이나 적은 수의 memory transaction 안에 같이 들어올 가능성이 커진다.

그래서 “raw 배치면 열 번 읽을 일을 swizzle 배치면 두 번에 읽는다”는 식의 감각은 방향상 맞다. 다만 항상 10 대 2로 줄어드는 공식은 아니다. texture 크기, pixel format, cache line 크기, sample 위치, filtering 방식, 압축 여부에 따라 숫자는 달라진다. 핵심은 읽는 pixel 개수가 줄어드는 것이 아니라, GPU가 메모리에서 가져오는 덩어리 안에 실제로 필요한 이웃 pixel이 더 많이 들어오게 만든다는 점이다. 같은 16개 pixel을 보더라도 row-major에서는 여러 줄을 따로 건드릴 수 있고, tiled/swizzled layout에서는 한두 개의 가까운 덩어리로 끝날 수 있다.

왜 중요할까? buffer와 image가 API에서 다르게 취급되는 이유가 조금 보인다. buffer는 보통 1D 배열처럼 생각하기 좋지만, texture/image는 sampling, filtering, cache, 압축, layout까지 묶인 하드웨어 친화적 물건이다. 개발자가 보는 “그림 한 장” 뒤에는 GPU가 덜 뛰어다니게 하려는 꽤 현실적인 주소 배치가 숨어 있다.

Source note: Mesa ISL tiling 문서는 linear image의 cache locality 문제와 tiling/swizzling의 목적을 설명한다. Microsoft D3D12 문서도 GPU에 효율적인 texture layout이 보통 row-major가 아니라고 언급한다.
