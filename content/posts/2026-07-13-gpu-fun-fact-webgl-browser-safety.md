---
title: "WebGL은 왜 그냥 OpenGL을 브라우저에 넣지 않았을까"
date: 2026-07-13
slug: "gpu-fun-fact-webgl-browser-safety"
draft: false
type: "note"
series: "gpu-fun-facts"
tags: ["gpu", "webgl", "browser", "graphics-history"]
difficulty: "beginner"
---

WebGL을 처음 보면 “OpenGL ES를 JavaScript에서 부르게 만든 것”처럼 보인다. 절반은 맞다. 하지만 더 흥미로운 절반은 브라우저라는 장소에 있다. native app은 보통 사용자가 설치한 프로그램이고, OS가 어느 정도 신뢰 경계를 잡아 준다. 반면 web page는 링크 하나로 열린다. 그런 page에 GPU를 직접 만지게 하려면 “빠른 3D”보다 먼저 “이게 다른 tab이나 machine을 망가뜨리지 않는가?”를 물어야 했다.

그래서 WebGL은 OpenGL ES 2.0에 아주 가깝게 설계되었지만, 그대로 복사되지는 않았다. Khronos의 WebGL 명세도 OpenGL ES와 달라지는 지점이 있으며, 그 이유 중 하나로 interoperability와 security를 든다. browser vendor 입장에서는 driver가 조금 느슨하게 허용하던 행동도 web에서는 그냥 넘기기 어렵다. out-of-range buffer access, 초기화되지 않은 memory 읽기, cross-origin image 사용 같은 문제는 “그래픽 버그”가 아니라 browser 보안 문제가 될 수 있다.

이 점이 WebGL의 재미있는 성격이다. WebGL은 GPU를 web에 열어 준 표준이면서 동시에, GPU를 web의 sandbox 문화 안으로 들여온 표준이다. 빠른 길은 “driver에 맡기자”였겠지만, WebGL은 validation, conformance test, browser별 안전장치를 통해 더 많은 검문소를 세웠다. 덕분에 page 안의 3D canvas는 game engine의 playground가 되면서도, 아무 page나 GPU memory를 마음대로 뒤지는 문이 되지는 않도록 설계되었다.

왜 중요할까? WebGL을 보면 GPU API가 항상 hardware 성능만 따라 움직이지 않는다는 감각이 생긴다. 같은 3D 기능도 desktop app, mobile app, browser 중 어디에 놓이느냐에 따라 API의 성격이 달라진다. WebGPU가 등장할 때도 “더 modern한 GPU API”라는 이야기 옆에는 늘 browser safety와 portability라는 오래된 숙제가 같이 붙어 있었다.

Source note: Khronos의 WebGL page와 2011년 WebGL 1.0 release announcement는 WebGL을 OpenGL ES 기반의 plugin-free browser 3D 표준으로 설명한다. WebGL 1.0 specification은 security와 interoperability를 위해 OpenGL ES 2.0과 달라지는 부분이 있다고 적고, Khronos의 WebGL Security note는 out-of-range memory access와 uninitialized memory 접근 방지, conformance suite 기반 테스트를 언급한다.
