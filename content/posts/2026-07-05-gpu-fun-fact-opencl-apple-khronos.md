---
title: "OpenCL은 왜 Apple에서 시작해 Khronos로 갔을까"
date: 2026-07-05
slug: "gpu-fun-fact-opencl-apple-khronos"
draft: false
type: "note"
series: "gpu-fun-facts"
tags: ["gpu", "opencl", "apple", "khronos", "api-history"]
difficulty: "beginner"
---

OpenCL의 출발점이 Apple이었다는 점은 꽤 재미있다. 지금은 OpenCL을 보면 “Khronos의 범용 compute 표준”이라는 이미지가 먼저 떠오르지만, 1.0 발표문을 보면 Apple이 먼저 draft specification을 제안했고, 그 뒤 Khronos Working Group에서 여러 회사가 함께 다듬어 2008년에 표준으로 공개했다.

당시 Apple의 관심사는 Mac OS X Snow Leopard에서 CPU와 GPU 같은 병렬 하드웨어를 일반 앱도 더 쉽게 쓰게 만드는 것이었다. GPU는 이미 그래픽에서는 엄청난 계산기를 품고 있었지만, 그 힘을 일반 프로그램이 꺼내 쓰기는 쉽지 않았다. 그래서 “그래픽 API 옆에 있는 특수한 비밀문”이 아니라, 여러 종류의 processor를 대상으로 하는 공개 compute 언어/API가 필요했다.

그런데 Apple 혼자 만든 API로 남기면 힘이 약해진다. GPU와 CPU vendor, compiler 회사, 게임/소프트웨어 회사가 같이 움직여야 개발자가 믿고 배울 수 있기 때문이다. Khronos로 넘긴 선택은 OpenCL을 “한 회사의 플랫폼 기능”에서 “여러 회사가 구현할 수 있는 약속”으로 바꾼 셈이다.

왜 중요할까? OpenCL의 성격은 시작부터 vendor lock-in을 줄이려는 쪽에 가까웠다. 그래서 CUDA처럼 한 회사의 GPU 경험을 강하게 밀어붙인 길과 달리, OpenCL은 조금 더 느리고 복잡하더라도 CPU, GPU, DSP 같은 이질적인 장치를 한 언어와 runtime 모델로 묶으려 했다. 그 출발 배경을 알면 OpenCL의 장점과 답답함이 둘 다 더 자연스럽게 보인다.

Source note: Khronos의 2008년 OpenCL 1.0 발표문은 OpenCL이 Apple의 draft proposal에서 시작되어 AMD, Apple, ARM, IBM, Intel, NVIDIA 등 여러 참여사와 함께 개발/비준되었다고 설명한다.
