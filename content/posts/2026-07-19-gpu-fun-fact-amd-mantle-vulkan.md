---
title: "Mantle은 왜 조용히 Vulkan의 재료가 됐을까"
date: 2026-07-19
slug: "gpu-fun-fact-amd-mantle-vulkan"
draft: false
type: "note"
series: "gpu-fun-facts"
tags: ["gpu", "vulkan", "amd", "mantle", "graphics-history"]
difficulty: "beginner"
---

Vulkan을 이야기하면 보통 “OpenGL보다 낮은 overhead”라는 설명이 먼저 나온다. 그런데 그 흐름의 앞쪽에는 AMD의 Mantle이라는 API가 있었다. Mantle은 오래 살아남은 범용 표준이라기보다, 그래픽스 업계에 “driver가 너무 많은 일을 대신해 주는 구조로는 최신 game engine과 multi-core CPU를 충분히 못 살린다”는 문제를 크게 보여준 신호탄에 가까웠다.

예전 OpenGL식 API는 편했다. application이 비교적 높은 수준의 명령을 던지면 driver가 뒤에서 상태를 해석하고, 검증하고, GPU가 먹을 형태로 정리했다. 문제는 scene이 복잡해지고 draw call이 많아질수록 이 숨은 일이 CPU 쪽 병목이 되기 쉽다는 점이었다. 특히 여러 CPU core가 동시에 일을 준비하는 시대에는, driver 안의 큰 자동 처리 덩어리가 오히려 예측하기 어려운 비용처럼 보일 수 있었다.

Mantle이 던진 아이디어는 꽤 직설적이었다. “engine이 이미 많은 것을 알고 있다면, 그 책임을 application 쪽으로 더 넘기고 driver는 얇고 예측 가능하게 만들자.” command buffer, explicit resource management, 낮은 CPU overhead 같은 방향이 여기서 힘을 얻었다. 개발자는 더 많은 세부사항을 챙겨야 하지만, 대신 언제 비용을 낼지와 어떤 일을 병렬로 준비할지 더 직접적으로 정할 수 있다.

재미있는 결말은 Mantle 자체보다 그 방향성이 더 오래 남았다는 것이다. Khronos의 Vulkan 1.0 발표문은 Vulkan이 Mantle에서 파생된 API라고 언급하면서, cross-platform과 cross-vendor 대상 application에 low-overhead API의 이점을 가져온다고 설명한다. 즉 Mantle은 “AMD 전용 API”로 끝난 것이 아니라, 업계가 공통 표준으로 가져갈 만한 압력을 먼저 눈에 보이게 만든 사례였다.

왜 중요할까? GPU API의 역사는 기능을 더 붙이는 역사만은 아니다. 어느 일을 driver가 숨기고, 어느 일을 application이 책임질지 계속 다시 나누는 역사다. Mantle에서 Vulkan으로 이어진 흐름은 그 경계선을 application 쪽으로 꽤 크게 옮긴 순간이었다.

Source note: Khronos의 2016년 Vulkan 1.0 release announcement는 Vulkan을 modern GPU에 대한 high-efficiency, cross-platform API로 소개하며 minimized CPU overhead, efficient multi-threaded performance, explicit resource management를 강조한다. 같은 발표문의 AMD 인용은 Vulkan API가 Mantle에서 derived되었고, low-overhead high-performance graphics API의 이점을 cross-platform/cross-vendor application에 가져온다고 설명한다.
