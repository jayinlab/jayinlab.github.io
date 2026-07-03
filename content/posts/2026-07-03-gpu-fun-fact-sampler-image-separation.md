---
title: "Sampler는 왜 image 밖에 따로 있을까"
date: 2026-07-03
slug: "gpu-fun-fact-sampler-image-separation"
draft: false
type: "note"
series: "gpu-fun-facts"
tags: ["gpu", "opencl", "vulkan", "image", "sampler", "api-design"]
difficulty: "beginner"
---

GPU API에서 image와 sampler가 따로 나오는 장면은 처음 보면 조금 이상하다. image가 픽셀 데이터를 담고 있다면, 그냥 image 안에 “어떻게 읽을지”까지 넣어두면 될 것 같기 때문이다.

하지만 texture hardware 입장에서 둘은 성격이 다르다. image는 width, height, format, memory layout 같은 “데이터 자체”에 가깝다. sampler는 좌표를 정규화해서 볼지, 범위 밖 좌표를 clamp/repeat할지, 두 texel 사이를 nearest로 고를지 linear로 섞을지 같은 “읽는 방법”에 가깝다.

이 둘을 분리하면 같은 image를 여러 방식으로 읽을 수 있다. 예를 들어 하나의 height map을 어떤 shader에서는 nearest로 딱딱하게 읽고, 다른 shader에서는 linear filtering으로 부드럽게 읽을 수 있다. 반대로 여러 image가 같은 sampling 규칙을 공유할 수도 있다. 데이터와 읽기 정책을 분리해 재사용성이 생기는 셈이다.

OpenCL에서도 `read_image*` 계열 함수는 sampler를 함께 받는다. Vulkan은 더 노골적으로 `VK_DESCRIPTOR_TYPE_SAMPLED_IMAGE`, `VK_DESCRIPTOR_TYPE_SAMPLER`, `VK_DESCRIPTOR_TYPE_COMBINED_IMAGE_SAMPLER`처럼 image와 sampler를 따로 또는 합쳐서 표현할 수 있게 둔다. 그래서 OpenCL image/sampler를 Vulkan 쪽으로 내릴 때도 “buffer 하나 꽂기”보다 더 많은 상태 번역이 필요하다.

왜 중요할까? OpenCL -> ANGLE -> Vulkan 흐름을 볼 때 image argument는 단순한 주소가 아니다. format-aware image view, layout, sampler state, descriptor type이 함께 맞아야 shader가 같은 texel을 같은 방식으로 읽는다. 결과가 흐리거나 경계에서 깨질 때는 계산식만 보지 말고 “어떤 image를 어떤 sampler로 읽었나”도 trace해야 한다.

Source note: Khronos OpenCL sampler reference는 sampler가 normalized coordinate, addressing mode, filter mode를 제어한다고 설명한다. Khronos Vulkan samples 문서는 separate image/sampler가 image와 sampler 조합을 자유롭게 섞게 해준다고 설명한다.
