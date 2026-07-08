---
title: "Vulkan은 왜 OpenGL의 다음 이름이 아니었을까"
date: 2026-07-08
slug: "gpu-fun-fact-vulkan-after-opengl"
draft: false
type: "note"
series: "gpu-fun-facts"
tags: ["gpu", "vulkan", "opengl", "khronos", "api-history"]
difficulty: "beginner"
---

Vulkan은 처음 보면 “OpenGL의 새 버전인가?” 싶다. 둘 다 Khronos가 관리하고, 둘 다 GPU graphics API이기 때문이다. 그런데 Vulkan은 OpenGL 5 같은 이름으로 나오지 않았다. 이름을 갈아탄 데에는 꽤 중요한 메시지가 있었다. 이것은 기존 API를 조금 고친 판이 아니라, GPU를 다루는 태도를 바꾸는 새 출발에 가까웠다.

OpenGL은 오래 사랑받은 API지만, 편한 만큼 driver가 뒤에서 많은 일을 대신해야 했다. 앱은 비교적 높은 수준의 명령을 던지고, driver는 그 순간의 상태를 해석해서 GPU가 이해할 작업으로 바꿨다. 작은 프로그램에는 고마운 구조지만, 큰 game engine처럼 CPU thread 여러 개가 동시에 많은 rendering work를 준비하는 시대에는 이 “driver가 알아서 해주는 층”이 병목과 예측 불가능성으로 느껴질 수 있었다.

Vulkan은 이 균형을 반대로 조금 옮겼다. application이 command buffer, synchronization, resource 상태를 더 명시적으로 책임지는 대신, driver가 몰래 추측하고 정리해야 하는 일을 줄였다. AMD의 Mantle 같은 low-overhead API 흐름도 이런 문제의식을 보여줬고, Khronos는 여러 회사가 참여하는 표준으로 Vulkan 1.0을 내놓았다.

재미있는 점은 Vulkan이 OpenGL을 “폐기”하려고 나온 물건은 아니라는 점이다. Khronos 발표에서도 Vulkan은 OpenGL/OpenGL ES를 보완하는 ground-up design으로 설명된다. OpenGL은 여전히 더 높은 수준의 편한 입구이고, Vulkan은 성능과 예측 가능성을 위해 개발자가 더 많은 운전대를 잡는 입구다.

왜 중요할까? Vulkan을 볼 때 복잡함만 먼저 보이면 억울하다. 그 복잡함은 그냥 까다롭게 만든 결과가 아니라, 예전에는 driver 안에 숨어 있던 결정을 application 쪽으로 꺼내 온 흔적이다. 그래서 Vulkan은 “새 OpenGL”이라기보다, 현대 engine들이 GPU와 협상하는 방식을 더 솔직하게 드러낸 API에 가깝다.

Source note: Khronos의 Vulkan 1.0 발표는 Vulkan을 OpenGL/OpenGL ES를 보완하는 ground-up design으로 설명하며, 낮은 driver overhead, multi-threaded GPU work generation, explicit resource management를 강조한다. AMD는 Vulkan을 Mantle에서 이어진 low-overhead graphics API 흐름으로 설명한다.
