---
title: "Apple은 왜 Metal을 따로 만들었을까"
date: 2026-07-10
slug: "gpu-fun-fact-why-apple-metal"
draft: false
type: "note"
series: "gpu-fun-facts"
tags: ["gpu", "metal", "apple", "api-history", "graphics"]
difficulty: "beginner"
---

Metal을 처음 보면 질문이 하나 생긴다. Apple은 이미 OpenGL도 쓸 수 있었고, compute 쪽에는 OpenCL도 밀었던 회사다. 그런데 왜 굳이 자기 플랫폼 전용 GPU API를 새로 만들었을까?

핵심은 “Apple 기기 안의 GPU를 더 예측 가능하게 쓰고 싶다”에 가깝다. OpenGL은 오래된 공용 API라서 여러 회사의 하드웨어를 넓게 감싸는 장점이 있었다. 대신 앱이 던진 명령을 driver가 뒤에서 해석하고, 상태를 추적하고, 적당한 GPU 작업으로 바꾸는 부담도 컸다. iPhone과 iPad에서 game과 visual app이 점점 무거워지면, 이 숨은 비용은 battery와 frame time에 바로 닿는다.

Metal은 그 균형을 Apple 쪽으로 당긴 API다. Apple이 설계한 GPU, OS, developer tools를 한 세트로 보고, graphics와 compute를 같은 Metal shading language와 command model 안에서 다룬다. 개발자는 command buffer, resource, pipeline state를 더 명시적으로 만지는 대신, driver가 몰래 추측해야 하는 일을 줄일 수 있다. “모두를 위한 넓은 길”보다 “Apple 플랫폼에서 얇고 빠른 길”을 택한 셈이다.

재미있는 점은 Metal이 단순히 OpenGL의 반대말은 아니라는 것이다. 더 낮은 overhead를 주지만, 동시에 Xcode GPU debugger나 profiling tools처럼 Apple식 개발 경험까지 같이 묶는다. API만 만든 것이 아니라, GPU 성능 문제를 발견하고 고치는 방식까지 자기 생태계 안으로 끌어온 것이다.

왜 중요할까? Metal을 보면 modern GPU API가 왜 platform-specific해질 때가 있는지 감이 온다. 표준은 넓은 호환성을 주고, 전용 API는 특정 하드웨어와 도구에 맞춘 예측 가능성을 준다. Metal은 Apple이 후자를 강하게 선택한 사례다.

Source note: Apple Developer의 Metal overview는 Metal을 Apple silicon을 잘 활용하기 위한 modern, tightly integrated graphics and compute API로 설명하며, low-overhead model, direct control over GPU tasks, Metal shading language, GPU profiling/debugging tools를 강조한다. WWDC 2014 Metal overview 설명은 A7 chip의 graphics와 compute power에 efficient access를 제공하는 low-overhead architecture와 unified shading language를 소개한다.
