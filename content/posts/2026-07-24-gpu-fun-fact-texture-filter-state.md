---
title: "Texture filtering은 왜 버튼처럼 고르는 상태가 됐을까"
date: 2026-07-24
slug: "gpu-fun-fact-texture-filter-state"
draft: false
type: "note"
series: "gpu-fun-facts"
tags: ["gpu", "texture", "sampler", "rendering-history"]
difficulty: "beginner"
---

옛날 3D game 화면을 보면 벽이나 바닥 texture가 가까이서는 네모네모하게 보이고, 멀리서는 반짝거리거나 뭉개지는 일이 많았다. 이유는 단순하다. 화면의 pixel 하나가 texture의 texel 하나와 딱 맞아떨어지는 경우는 거의 없기 때문이다. 어떤 때는 texture 한 칸이 화면의 여러 pixel로 커지고, 어떤 때는 수십 개 texel이 화면의 pixel 하나 안으로 압축된다.

그래서 GPU에는 texture를 “어떻게 읽을지”를 정하는 filtering state가 생겼다. 가장 가까운 texel 하나를 고르면 `nearest`다. 빠르고 또렷하지만 확대하면 계단처럼 보인다. 주변 texel을 섞으면 `linear`다. 더 부드럽지만 원본의 날카로운 느낌은 줄어든다. 멀리 있는 texture에서는 mipmap level까지 고르거나 섞어야 aliasing을 줄일 수 있다.

재미있는 점은 이것이 shader 안에서 매번 손으로 짜는 계산이 아니라, 오래전부터 texture/sampler 쪽 state로 자리 잡았다는 점이다. Pixel마다 texture 좌표를 보고, 주변 texel을 찾고, format 변환과 wrap mode까지 처리하는 일은 너무 자주 반복된다. GPU 입장에서는 이 길을 전용 sampling hardware와 cache에 태우고, app은 “nearest로 볼지, linear로 볼지, mipmap을 섞을지”를 state로 말해 주는 편이 자연스럽다.

그래서 같은 image라도 sampler state가 바뀌면 전혀 다른 표정이 나온다. Pixel art는 일부러 nearest를 고르면 선명한 격자 맛이 살고, 3D scene의 바닥이나 벽은 linear와 mipmap을 쓰면 움직일 때 덜 거슬린다. Texture filtering은 작은 품질 옵션처럼 보이지만, 사실은 “그림 파일을 GPU가 화면 위의 연속적인 표면으로 읽는 방법”을 정하는 약속이다.

왜 중요할까? Texture bug를 볼 때 image data만 의심하면 절반만 보는 것이다. 같은 memory를 읽어도 filter, wrap, mipmap, sampler state가 달라지면 결과가 달라진다. GPU API가 image와 sampler를 따로 다루는 이유도 이런 오래된 습관과 잘 맞닿아 있다.

Source note: OpenGL ES `glTexParameter` 문서는 texture를 image와 sample derivation parameters의 조합으로 설명하고, `GL_TEXTURE_MIN_FILTER`/`GL_TEXTURE_MAG_FILTER`가 nearest, linear, mipmap 기반 minification 선택을 정한다고 설명한다. Microsoft Direct3D texture filtering 문서는 화면 pixel마다 texture에서 color를 얻어야 하며, magnification/minification에서 chunky appearance, blur, aliasing을 줄이기 위해 texel color blending이 필요하다고 설명한다.
