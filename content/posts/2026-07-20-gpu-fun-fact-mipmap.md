---
title: "Mipmap은 왜 texture의 작은 복사본을 들고 다닐까"
date: 2026-07-20
slug: "gpu-fun-fact-mipmap"
draft: false
type: "note"
series: "gpu-fun-facts"
tags: ["gpu", "texture", "mipmap", "rendering-history"]
difficulty: "beginner"
---

멀리 있는 벽돌담을 화면에 그린다고 생각해 보자. 실제 texture는 촘촘한 벽돌 무늬인데, 화면에서는 몇 pixel밖에 차지하지 않는다. 이때 GPU가 원본 texture의 작은 점들을 대충 몇 개만 집어 오면, 카메라가 조금 움직일 때마다 무늬가 반짝거리거나 줄무늬처럼 튄다. 멀리 있는 디테일을 너무 자세한 원본에서 바로 고르려 해서 생기는 aliasing이다.

Mipmap의 아이디어는 단순하다. texture를 올릴 때 원본만 주는 것이 아니라, 절반 크기, 그 절반 크기, 또 그 절반 크기의 축소판을 미리 만들어 함께 둔다. 가까운 물체에는 큰 level을 쓰고, 멀리 있거나 화면에서 작게 보이는 물체에는 작은 level을 쓴다. GPU는 “지금 이 표면이 화면에서 얼마나 작게 보이나”를 보고 적당한 level을 고르거나 두 level 사이를 섞는다.

이 이름은 Lance Williams의 1983년 SIGGRAPH 논문 \`Pyramidal Parametrics\`와 함께 자주 언급된다. 논문은 source image를 여러 해상도의 피라미드처럼 미리 filtering해 두면, 특히 같은 image를 많은 frame에서 반복해서 쓰는 animation에서 aliasing을 줄이는 데 유리하다고 설명했다. 즉 mipmap은 “화질을 좋게 하는 옵션”이기 전에, 반복되는 sampling 비용과 깜빡임을 줄이려는 실용적인 data layout이었다.

재미있는 tradeoff도 있다. 작은 복사본들을 더 저장해야 하므로 memory는 더 쓴다. 대신 멀리 있는 표면을 읽을 때는 더 작은 image를 보게 되어 cache에도 유리하고, 화면에서 보이지도 않을 고주파 디테일 때문에 반짝이는 일을 줄일 수 있다. 그래서 mipmap은 오래된 아이디어인데도 지금의 GPU texture sampling에서 여전히 기본 상식처럼 남아 있다.

왜 중요할까? Texture는 단순한 2D 그림 파일이 아니라, GPU가 거리와 기울기와 cache를 함께 고려해서 읽는 data다. Mipmap을 알면 “image 하나를 sample한다”는 말 뒤에 사실은 여러 해상도와 filtering 선택이 숨어 있다는 감각이 생긴다.

Source note: ACM의 Lance Williams 1983년 논문 \`Pyramidal Parametrics\` 초록은 prefiltered source image 집합과 pyramidal sampling geometry가 aliasing을 줄이고 animation처럼 같은 source image를 많이 쓰는 경우에 유리하다고 설명한다. Microsoft Direct3D 문서는 mipmap을 같은 image의 점점 낮은 resolution texture sequence로 정의하고, 가까운 object에는 high-resolution level을, 멀리 있는 object에는 lower-resolution level을 쓰며 quality를 개선하지만 memory를 더 사용한다고 설명한다.
