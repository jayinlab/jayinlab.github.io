---
title: "Shader는 왜 한 줄로 합쳐졌을까"
date: 2026-07-22
slug: "gpu-fun-fact-unified-shader"
draft: false
type: "note"
series: "gpu-fun-facts"
tags: ["gpu", "shader", "direct3d", "nvidia", "graphics-history"]
difficulty: "beginner"
---

예전 GPU를 아주 단순하게 보면, chip 안에 역할별 작업대가 따로 있는 공장에 가까웠다. vertex를 다루는 쪽, pixel을 칠하는 쪽, texture를 읽는 쪽이 비교적 뚜렷하게 나뉘어 있었다. 문제는 frame마다 일이 고르게 들어오지 않는다는 점이다. 어떤 장면은 vertex 처리가 바쁘고, 어떤 장면은 pixel shading이 바쁘다. 한쪽 작업대는 줄이 길고 다른 쪽은 놀고 있으면, 전체 chip을 크게 만들어도 효율이 아쉬워진다.

Direct3D 10 세대에서 자주 언급되는 변화 중 하나가 unified shader architecture다. 이름은 거창하지만 감은 간단하다. shader 일을 맡는 실행 자원을 vertex 전용, pixel 전용처럼 딱딱하게 갈라 두기보다, 공통 shader core가 여러 programmable stage의 일을 나눠 처리하게 하자는 방향이다. Microsoft의 Direct3D 10 pipeline 문서도 vertex shader, geometry shader, pixel shader 같은 stage들이 HLSL로 programmable하며 common shader core를 쓴다고 설명한다.

NVIDIA의 GeForce 8800/G80은 이 변화를 상징적으로 보여준 제품군이었다. NVIDIA 자료는 GeForce 8800 GTX를 DirectX 10-compatible GPU이자 fully unified architecture 기반 GPU로 소개했고, 이후 Fermi whitepaper도 G80 unified graphics and compute architecture를 CUDA와 함께 중요한 전환점으로 되짚는다. 즉 “그래픽 pipeline의 각 칸을 더 빠르게 만들자”에서 “여러 칸이 같은 계산 자원을 더 유연하게 나눠 쓰게 하자”로 생각이 움직인 셈이다.

물론 모든 것이 하나로 녹아버렸다는 뜻은 아니다. Rasterizer, texture unit, ROP처럼 여전히 성격이 다른 고정 기능 block은 남아 있다. Unified shader가 바꾼 핵심은 programmable 계산 쪽의 균형이다. 장면마다 vertex와 pixel의 비중이 달라도, 같은 실행 자원을 더 잘 재배치할 수 있으면 silicon을 놀리는 시간이 줄어든다.

왜 중요할까? 오늘날 GPU가 graphics와 compute 사이를 자연스럽게 오가는 배경에는 이런 설계 변화가 깔려 있다. Shader core가 “특정 그림 단계 전용 장치”라기보다 “대량의 작은 프로그램을 돌리는 실행 자원”에 가까워지면서, CUDA 같은 GPGPU 흐름도 훨씬 설득력 있는 하드웨어 기반을 얻게 됐다.

Source note: Microsoft Direct3D 10 pipeline 문서는 programmable stage들이 HLSL로 작성되며 common shader core를 사용한다고 설명한다. NVIDIA GeForce 8800 architecture technical brief 검색/문서 metadata는 GeForce 8800 GTX를 fully unified architecture 기반 DirectX 10-compatible GPU로 소개하며, NVIDIA Fermi Architecture Whitepaper는 G80 unified graphics and compute architecture와 CUDA를 GPU programming 전환의 핵심 기술로 언급한다.
