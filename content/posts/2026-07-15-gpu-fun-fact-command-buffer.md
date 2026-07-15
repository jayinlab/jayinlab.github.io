---
title: "GPU 명령은 왜 한 번 적고 나중에 보낼까"
date: 2026-07-15
slug: "gpu-fun-fact-command-buffer"
draft: false
type: "note"
series: "gpu-fun-facts"
tags: ["gpu", "vulkan", "command-buffer", "api-design"]
difficulty: "beginner"
---

GPU API를 처음 보면 조금 이상한 점이 있다. 화면을 그리거나 compute kernel을 돌리고 싶은데, 명령을 바로 실행하는 대신 command buffer라는 곳에 먼저 “기록”한다. Vulkan에서는 pipeline을 bind하고, descriptor set을 bind하고, draw나 dispatch 같은 명령을 차례로 적은 뒤, 나중에 queue에 submit한다.

이 방식은 GPU가 느려서가 아니라, 오히려 CPU와 GPU를 덜 기다리게 만들기 위한 장치에 가깝다. CPU가 매 draw마다 GPU에게 “이거 해 줘, 끝났어?”라고 말을 걸면 양쪽이 자주 멈춘다. 대신 CPU는 할 일을 한 묶음으로 써 두고, GPU는 자기 queue에서 그 묶음을 받아 순서와 의존성을 보며 처리한다. 주방에 주문이 한 장씩 들어오는 것보다, 정리된 주문표가 한 번에 넘어오는 쪽에 가까운 셈이다.

또 하나의 재미있는 점은 command buffer가 “그때의 상태”를 붙잡아 둔다는 것이다. 어떤 pipeline이 묶였는지, 어떤 resource를 읽을지, 어떤 copy나 dispatch가 들어갔는지가 기록 안에 남는다. 그래서 현대 GPU API는 즉흥적인 대화라기보다, 미리 적은 작업표를 queue에 태우는 구조에 가깝다.

왜 중요할까? command buffer를 이해하면 Vulkan이나 Metal 같은 explicit API가 왜 번거롭게 보이는지 감이 온다. 번거로움의 대가로 application은 작업을 더 크게 묶고, 재사용하고, 여러 thread에서 준비하며, driver가 몰래 추측하던 일을 더 명시적으로 나눠 갖는다.

Source note: Vulkan specification은 command buffer를 “commands를 record하고 나중에 device queue에 submit할 수 있는 object”로 설명한다. 기록되는 명령에는 pipeline/descriptor binding, dynamic state 변경, draw, dispatch, copy 등이 포함된다.
