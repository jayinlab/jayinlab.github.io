---
title: "Vulkan은 왜 image layout을 직접 말하게 할까"
date: 2026-07-26
slug: "gpu-fun-fact-vulkan-image-layouts"
draft: false
type: "note"
series: "gpu-fun-facts"
tags: ["gpu", "vulkan", "image-layout", "synchronization", "api-design"]
difficulty: "beginner"
---

Vulkan을 처음 보면 이상하게 느껴지는 단어가 있다. image layout이다. texture로 읽을지, color attachment로 쓸지, 화면에 present할지에 따라 `SHADER_READ_ONLY_OPTIMAL`, `COLOR_ATTACHMENT_OPTIMAL`, `PRESENT_SRC_KHR` 같은 상태를 직접 옮겨 줘야 한다. OpenGL처럼 "그냥 texture를 쓰면 driver가 알아서 하겠지"라고 기대하면 꽤 불친절해 보인다.

그런데 이 귀찮음은 Vulkan의 성격을 잘 보여준다. GPU image는 단순한 2D 배열이 아니다. 같은 픽셀 데이터라도 읽기 좋은 모양, render target으로 쓰기 좋은 모양, display engine에 넘기기 좋은 모양이 다를 수 있다. 압축된 tile metadata, cache 상태, attachment용 내부 배치처럼 driver와 hardware가 신경 쓰는 것이 뒤에 숨어 있다. 예전 API는 이런 전환을 driver가 추측해서 끼워 넣는 쪽에 가까웠고, Vulkan은 그 추측 비용과 타이밍을 application이 command buffer 안에 명시하게 만든 쪽에 가깝다.

그래서 layout transition은 보통 pipeline barrier와 같이 나온다. "방금 color attachment로 썼고, 이제 shader가 읽을 것이다"라고 적으면 driver는 어느 stage의 write를 기다리고, 어떤 access가 보이게 해야 하며, image를 어떤 사용 형태로 바꿀지 한 번에 알 수 있다. 반대로 storage image처럼 계속 일반적인 read/write 용도로만 쓰는 경우에는 `GENERAL` layout에 머물러 transition이 필요 없는 예도 있다.

왜 중요할까? image layout은 성능 옵션을 외운다기보다, GPU에게 "이 image의 다음 역할"을 미리 말해 주는 계약으로 보면 편하다. Vulkan이 장황한 이유 중 하나는 driver가 마음속을 읽는 대신, application이 의도를 적고 그 대가로 예측 가능한 실행과 디버깅 단서를 얻는 방향을 택했기 때문이다.

Source note: Vulkan specification은 `VkImageCreateInfo`에 `initialLayout`을 두고 image subresource의 초기 `VkImageLayout`을 명시하게 한다. Vulkan Guide의 synchronization 문서는 Vulkan에서 application developer가 synchronization 관리 책임을 진다고 설명하며, synchronization examples는 image layout transition을 pipeline barrier 예제로 다룬다.
