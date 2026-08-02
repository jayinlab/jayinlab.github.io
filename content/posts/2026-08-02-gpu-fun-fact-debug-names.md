---
title: "GPU resource는 왜 이름표를 따로 달아야 할까"
date: 2026-08-02
slug: "gpu-fun-fact-debug-names"
draft: false
type: "note"
series: "gpu-fun-facts"
tags: ["gpu", "vulkan", "direct3d", "debugging"]
difficulty: "beginner"
---

사람에게 texture는 `shadow_map`이나 `character_albedo`지만, GPU API가 보는 것은 대개 숫자처럼 생긴 handle이다. 그래서 frame capture에서 수백 개의 image와 buffer를 펼쳤는데 이름이 전부 비슷한 주소나 번호라면, 문제가 난 resource를 찾는 일부터 작은 추리 게임이 된다.

흥미로운 점은 GPU가 이런 이름을 원래 알고 있는 것이 아니라는 사실이다. application이 asset 이름과 용도를 알고 있어도, `VkImage`나 `ID3D12Resource`를 만들었다고 그 의미가 자동으로 driver까지 따라가지는 않는다. 실행에 필요한 것은 object type, 크기, format, usage 같은 정보이지 “이건 주인공의 외투 texture”라는 설명이 아니기 때문이다.

그래서 현대 graphics API에는 성능과 무관한 이름표 통로가 따로 있다. Vulkan의 `VK_EXT_debug_utils`는 object에 application-defined name을 붙이고, command buffer나 queue 안의 구간에는 label을 넣게 해준다. `Brick Diffuse Texture`처럼 이름을 붙이면 validation message와 외부 debugging tool이 무명의 handle 대신 그 표현을 보여줄 수 있다. Direct3D 12도 `ID3D12Object::SetName`을 제공하며, 문서가 이 이름의 용도를 debug diagnostics와 tool이라고 분명히 적는다.

label은 시간축에도 이름표를 단다. 수천 개 command 사이를 `Shadow Pass`, `Post Processing`, `UI` 같은 구간으로 묶으면 GPU timeline이 단순한 호출 목록에서 사람이 만든 frame의 이야기로 바뀐다. hardware가 빨라지는 기능은 아니지만, 느린 구간이나 잘못된 resource를 찾는 사람은 훨씬 빨라진다.

왜 중요할까? GPU bug는 CPU call stack 하나만 보고 끝나지 않고, 나중에 비동기로 실행된 command와 resource 상태를 함께 보는 경우가 많다. 좋은 debug name은 장식이 아니라 application의 의미를 GPU tool까지 운반하는 아주 작은 metadata다. 이름표 몇 줄이 밤샘 debugging에서 가장 값싼 보험이 되는 이유다.

Source note: Khronos Vulkan `VK_EXT_debug_utils` 문서는 object에 name/tag를 붙여 추적을 개선하고, queue와 command buffer 구간에 label을 넣어 외부 tool의 분석을 돕는다고 설명한다. Microsoft의 `ID3D12Object::SetName` 문서는 이 이름이 debug diagnostics와 tool을 위한 것이라고 명시한다.
