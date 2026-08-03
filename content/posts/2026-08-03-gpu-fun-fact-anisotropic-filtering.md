---
title: "비스듬한 바닥 texture는 왜 먼저 흐려질까"
date: 2026-08-03
slug: "gpu-fun-fact-anisotropic-filtering"
draft: false
type: "note"
series: "gpu-fun-facts"
tags: ["gpu", "texture", "filtering", "graphics"]
difficulty: "beginner"
---

3D 게임에서 정면의 벽은 또렷한데 멀리 뻗은 바닥이나 도로의 무늬는 금세 흐릿해지는 장면이 있다. texture 자체의 해상도만 낮아서가 아니다. 화면의 정사각형 pixel 하나를 비스듬한 바닥 위로 되돌려 놓으면, texture 공간에서는 길고 납작한 발자국처럼 늘어나기 때문이다.

보통의 bilinear filtering은 가까운 texel 몇 개를 섞고, mipmap은 거리에 맞는 축소본을 골라 반짝임을 줄인다. 둘 다 훌륭하지만 기본적으로는 sampling 영역이 모든 방향에서 비슷하다고 보기 쉽다. 문제의 발자국은 정사각형이 아니라 한쪽으로 길다. 너무 작은 mip level을 택하면 멀리 있는 무늬가 흔들리고, 너무 큰 level을 택하면 길의 차선과 바닥 결이 일찍 뭉개진다.

anisotropic filtering은 이 기울어진 발자국을 인정하는 방식이다. 한 점 주변만 둥글게 보는 대신, texture에서 길게 늘어난 방향을 따라 더 많은 정보를 모은다. 그래서 카메라를 향해 뻗은 도로, 활주로, 바닥 타일처럼 시선과 거의 평행한 표면에서 차이가 특히 눈에 띈다. 설정의 2x, 4x, 8x, 16x 같은 숫자는 대체로 이런 길쭉함을 얼마나 적극적으로 다룰지 정하는 품질 한도다.

재미있는 점은 이것이 단순한 “더 선명하게” 버튼은 아니라는 것이다. 정면 표면에서는 이득이 작고, 비스듬할수록 필요한 sample과 비용이 늘어난다. GPU는 모든 곳을 무작정 선명하게 만드는 대신, 화면 pixel이 texture에서 차지하는 모양에 맞춰 일을 더 쓰는 셈이다.

왜 중요할까? texture 품질은 원본 해상도뿐 아니라 카메라와 표면의 각도에도 달려 있다. 멀리 뻗은 길이 흐릴 때 texture를 더 크게 만드는 것보다 filtering 방식 하나가 더 직접적인 답일 수 있는 이유다.

Source note: Microsoft Direct3D의 anisotropic texture filtering 문서는 화면에 비스듬한 표면에서 pixel을 texture 공간으로 역매핑하면 footprint가 늘어나며, 그 elongation을 anisotropy로 다룬다고 설명한다. Khronos의 `EXT_texture_filter_anisotropic` 명세는 sampler/texture에 최대 anisotropy 값을 지정하는 API를 정의한다.
