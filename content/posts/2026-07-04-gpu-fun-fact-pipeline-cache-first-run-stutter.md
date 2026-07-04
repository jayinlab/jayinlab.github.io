---
title: "첫 실행만 버벅이는 이유: pipeline cache"
date: 2026-07-04
slug: "gpu-fun-fact-pipeline-cache-first-run-stutter"
draft: false
type: "note"
series: "gpu-fun-facts"
tags: ["gpu", "vulkan", "pipeline-cache", "driver", "shader"]
difficulty: "beginner"
---

게임이나 GPU 앱에서 “처음 켰을 때만” 살짝 끊기고, 두 번째 실행부터는 부드러워지는 일이 있다. 이유가 항상 하나는 아니지만, Vulkan 세계에서 자주 등장하는 단어가 `pipeline cache`다.

Vulkan pipeline은 shader 하나만 담은 얇은 객체가 아니다. shader module, pipeline layout, specialization constant, render/compute state 같은 정보를 묶어 GPU가 실행하기 좋은 형태로 준비한 결과에 가깝다. 이 준비 과정에서 driver는 내부 컴파일, 최적화, 하드웨어별 상태 생성 같은 일을 할 수 있다. 그래서 새 조합의 pipeline을 처음 만들 때 시간이 튈 수 있다.

`VkPipelineCache`는 이 “pipeline construction 결과”를 재사용하게 해주는 손잡이다. 같은 실행 안에서 관련 pipeline끼리 공유할 수도 있고, cache data를 저장했다가 다음 실행 때 다시 넣을 수도 있다. 다만 cache 내용은 implementation이 관리하므로, 앱이 원하는 모든 지연을 없애 준다고 보장되는 만능 저장소는 아니다.

왜 중요할까? OpenCL -> ANGLE -> Vulkan 흐름에서도 kernel 하나가 결국 Vulkan compute pipeline과 dispatch state로 내려간다면, local size나 specialization 값이 달라져 새 pipeline key가 생길 수 있다. 첫 실행 지연을 볼 때는 `vkCmdDispatch`만 탓하기보다 “pipeline을 새로 만들었나, cache hit였나, 어떤 값이 pipeline variant를 갈랐나”를 같이 봐야 한다.

Source note: Vulkan refpage는 `VkPipelineCache`가 pipeline construction 결과를 pipelines 사이와 application runs 사이에서 재사용할 수 있다고 설명한다. `vkCreateComputePipelines`도 cache handle을 받아 compute pipeline 생성에 사용할 수 있다.
