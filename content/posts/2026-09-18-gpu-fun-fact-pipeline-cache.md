---
title: "게임의 첫 전투는 왜 두 번째보다 버벅일까"
date: 2026-09-18
slug: "gpu-fun-fact-pipeline-cache"
draft: false
type: "note"
series: "gpu-fun-facts"
tags: ["gpu", "vulkan", "shader", "pipeline", "cache"]
difficulty: "beginner"
---

새 식당이 첫 주문을 받을 때마다 조리법을 읽고, 칼과 팬을 골라 작업대를 꾸민다면 첫 접시는 늦게 나온다. 다음 주문은 이미 꾸며진 작업대를 쓰니 빨라진다. 게임에서 처음 보는 폭발이나 재질이 등장할 때 잠깐 끊기고, 같은 장면을 다시 볼 때는 매끄러운 현상도 이와 닮았다.

Vulkan의 graphics pipeline에는 shader만 들어 있지 않다. vertex 입력, rasterization, blending처럼 함께 맞물리는 여러 상태가 묶인다. `vkCreateGraphicsPipelines`로 pipeline을 만들 때 driver는 shader를 device가 실행할 형태로 compile하고, 이 상태 조합에 필요한 내부 작업도 수행할 수 있다. 이 비용이 플레이 도중 한꺼번에 나타나면 frame 시간이 튀어 사람이 느끼는 stutter가 된다.

그래서 Vulkan에는 `VkPipelineCache`가 있다. application은 pipeline을 만들 때 cache를 건네 이전 결과를 재사용하게 하고, cache data를 파일로 저장해 다음 실행에 다시 가져올 수도 있다. Khronos의 공식 예제도 cache가 없는 경우와 warm cache를 비교하며, 첫 생성 비용의 일부를 다음 실행으로 넘기지 않는 방식을 보여 준다. 게임이 시작 전에 shader를 준비하거나 “최적화 중” 화면을 띄우는 이유 중 하나다.

왜 중요할까? 평균 FPS가 높아도 한 frame이 갑자기 오래 걸리면 움직임은 끊겨 보인다. pipeline cache는 최고 속도를 올리는 장치라기보다, 비싼 준비가 사용자를 놀라게 하는 순간에 몰리지 않도록 돕는 장치에 가깝다.

다만 식당 비유처럼 cache가 영원한 완성품인 것은 아니다. cache 내용은 driver와 device에 종속될 수 있고, 새 shader나 새로운 상태 조합은 여전히 준비해야 한다. Vulkan specification도 cache hit나 정확한 속도 향상을 보장하지 않는다. 결국 핵심은 “compile이 사라진다”가 아니라, 가능한 준비를 미리 하고 재사용하되 cache miss를 예상하는 것이다.

Source note: [Khronos Vulkan Guide — Pipeline Cache](https://docs.vulkan.org/guide/latest/pipeline_cache.html)는 pipeline 생성 중 shader compile 등이 비용을 만들 수 있고, cache data를 실행 사이에 저장해 일부 생성 작업을 줄일 수 있다고 설명한다. [Khronos Vulkan Specification — Pipelines](https://docs.vulkan.org/spec/latest/chapters/pipelines.html)는 `VkPipelineCache`가 pipeline 생성 결과의 재사용을 돕되 cache hit나 성능 향상을 보장하지 않는다고 규정한다.
