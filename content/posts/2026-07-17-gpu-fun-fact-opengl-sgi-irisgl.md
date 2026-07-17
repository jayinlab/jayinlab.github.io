---
title: "OpenGL은 왜 회사 밖으로 나왔을까"
date: 2026-07-17
slug: "gpu-fun-fact-opengl-sgi-irisgl"
draft: false
type: "note"
series: "gpu-fun-facts"
tags: ["gpu", "opengl", "sgi", "graphics-history"]
difficulty: "beginner"
---

OpenGL은 이름만 보면 처음부터 모두의 표준처럼 보인다. 하지만 뿌리는 꽤 회사 안쪽에 있었다. 1980년대와 1990년대 초의 Silicon Graphics, 즉 SGI workstation은 3D graphics의 강한 상징이었고, 그 세계에는 IRIS GL이라는 SGI 중심의 graphics API가 있었다.

문제는 “좋은 API”와 “여러 회사가 믿고 구현할 수 있는 API”가 같은 말은 아니라는 점이었다. 특정 workstation과 window system에 깊게 붙어 있으면, 다른 hardware vendor나 OS가 그대로 따라가기 어렵다. 응용 프로그램을 만드는 쪽에서도 한 회사의 기계에 너무 묶이는 것은 부담이었다.

그래서 OpenGL의 재미있는 지점은 새 API를 발명했다기보다, SGI의 강점을 더 넓은 시장이 쓸 수 있는 규격으로 정리했다는 데 있다. Khronos-hosted OpenGL wiki는 OpenGL을 Iris GL의 open하고 재현 가능한 대안으로 설명한다. OpenGL ARB archive도 1992년에 OpenGL Architecture Review Board가 만들어져 specification, release, conformance testing을 다뤘다고 기록한다.

즉 OpenGL은 “우리 회사 그래픽 머신을 잘 쓰는 방법”에서 “다른 회사도 같은 약속을 구현하게 하는 방법”으로 무게중심을 옮긴 사례다. 그래서 API 이름에 Open이 붙은 것은 단순한 분위기가 아니라, 그래픽스 시장이 workstation 한 종류에서 PC, 다른 OS, 다른 GPU vendor로 넓어지던 압력과도 맞닿아 있다.

왜 중요할까? GPU API 역사는 성능만의 역사가 아니다. 누가 규격을 소유하고, 누가 테스트하고, 어느 정도까지 vendor 차이를 숨길지 정하는 생태계의 역사이기도 하다. Vulkan이나 WebGPU 같은 후대 API를 볼 때도, 이 “회사 기술을 공통 약속으로 바꾸는 일”이 계속 반복된다.

Source note: OpenGL ARB archive는 OpenGL Architecture Review Board가 1992년에 formed되어 OpenGL specification, releases, conformance testing을 관리했다고 설명한다. Khronos-hosted OpenGL wiki의 history 설명은 OpenGL을 SGI workstation의 proprietary Iris GL에 대한 open/reproducible alternative로 요약한다.
