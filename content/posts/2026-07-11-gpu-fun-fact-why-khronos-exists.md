---
title: "GPU API에는 왜 Khronos 같은 모임이 필요할까"
date: 2026-07-11
slug: "gpu-fun-fact-why-khronos-exists"
draft: false
type: "note"
series: "gpu-fun-facts"
tags: ["gpu", "khronos", "api-history", "standards"]
difficulty: "beginner"
---

GPU API 역사를 보다 보면 Khronos라는 이름이 자주 나온다. OpenGL, OpenCL, Vulkan, SPIR-V, WebGL 같은 이름 옆에 붙어 있는 그 단체다. 재미있는 점은 Khronos가 특정 GPU 회사의 브랜드가 아니라는 것이다. 여러 회사가 모여 “서로 다르게 만들면 모두가 피곤해지는 부분”을 정하는 장소에 가깝다.

GPU 쪽 표준이 어려운 이유는 이해관계자가 너무 많기 때문이다. GPU vendor는 자기 hardware의 장점을 살리고 싶고, OS vendor는 platform 정책과 toolchain을 생각한다. game engine, browser, CAD, mobile app 쪽 개발자는 같은 코드를 여러 장치에서 최대한 비슷하게 돌리고 싶다. 한 회사가 API를 혼자 정하면 빠를 수는 있지만, 다른 회사들은 그 결정에 끌려가거나 따로 길을 내야 한다.

Khronos식 표준은 이 문제를 느리지만 튼튼하게 푼다. member들이 working group에서 specification을 만들고, royalty-free로 쓸 수 있게 열어 두며, “이 구현이 정말 같은 표준이라고 부를 수 있는가”를 conformance test로 확인한다. 문서만 맞추는 것이 아니라, 이름과 logo를 쓰려면 일정한 동작을 증명해야 하는 구조다.

왜 중요할까? Vulkan이나 OpenCL을 볼 때 “왜 이렇게 절차가 많지?”라는 생각이 들 수 있다. 그 배경에는 한 회사의 편한 shortcut보다, 여러 GPU와 OS에서 같은 약속을 오래 유지하려는 압력이 있다. 표준 API의 진짜 제품은 함수 이름만이 아니라, 서로 다른 회사들이 같은 단어로 대화할 수 있게 만드는 신뢰 쪽에 더 가깝다.

Source note: Khronos Group about page는 Khronos를 open, member-driven consortium으로 설명하며, open royalty-free interoperability standards, working group 기반 개발, multi-organization governance, conformance test suite를 통한 cross-platform consistency를 강조한다.
