---
title: "Texture compression은 왜 작은 block으로 접을까"
date: 2026-07-31
slug: "gpu-fun-fact-texture-compression-blocks"
draft: false
type: "note"
series: "gpu-fun-facts"
tags: ["gpu", "texture", "compression", "vulkan", "astc"]
difficulty: "beginner"
---

JPEG이나 PNG를 떠올리면 image compression은 대개 "파일을 작게 만들어 저장하거나 전송하는 기술"처럼 느껴진다. 그런데 GPU texture compression은 조금 다른 욕심을 가진다. 파일만 작으면 끝이 아니라, rendering 중에도 GPU가 바로 꺼내 쓸 수 있어야 한다.

Texture sampling은 무작위 접근에 가깝다. 화면의 어느 pixel이 texture의 어느 부분을 읽을지는 camera, UV, filtering에 따라 계속 바뀐다. 그래서 GPU는 압축된 texture 전체를 풀어 큰 임시 image로 만든 뒤 sampling하기보다, 필요한 근처 조각만 빠르게 읽고 해석할 수 있는 형태를 좋아한다.

그 조각 단위가 block이다. Khronos의 KTX guide는 compressed texture가 random access를 지원하기 위해 보통 같은 크기의 block으로 구성된다고 설명한다. Basis Universal 예시는 4x4 pixel block을 쓴다. Vulkan 문서에서도 ASTC format 이름은 4x4, 5x4, 8x8 같은 compressed texel block dimensions와 함께 나온다. 즉 "한 pixel씩 압축"도 아니고 "파일 전체를 한 번에 압축"도 아니라, 작은 사각형 묶음을 GPU가 이해하는 약속으로 만든 셈이다.

이 방식의 재미있는 tradeoff는 품질과 bandwidth가 한 버튼에 묶인다는 점이다. 더 작은 block이나 낮은 압축률은 대체로 화질에 유리하지만 memory와 bandwidth를 더 쓴다. 더 큰 block이나 높은 압축률은 texture를 가볍게 만들지만 흐림, 얼룩, normal map 깨짐 같은 artifact를 키울 수 있다. NVIDIA의 ASTC guide도 texture compression의 목표를 data size를 줄이면서 visual quality 손상을 최소화하는 균형이라고 설명한다.

왜 중요할까? Texture compression은 단순한 asset packaging 기법이 아니라 GPU memory system과 sampling hardware에 맞춘 data layout 선택이다. 그래서 game artist가 "이 texture는 ASTC 6x6, 저 normal map은 더 보수적으로" 같은 결정을 하는 순간, 그림의 용량뿐 아니라 실행 중 memory traffic까지 같이 정해진다.

Source note: Khronos KTX Developer Guide는 compressed texture가 random access를 위해 보통 같은 크기의 block으로 구성되며 Basis Universal이 4x4 pixel block을 쓴다고 설명한다. Vulkan compressed image format 문서는 ASTC format을 4x4, 5x4, 8x8 등 compressed texel block dimensions와 함께 나열한다. NVIDIA ASTC guide는 texture compression의 목표를 data size 감소와 visual quality 손상 최소화의 균형으로 설명한다.
