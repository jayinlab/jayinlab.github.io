---
title: "압축 풀기는 왜 CPU에서 GPU로 이사했을까"
date: 2026-08-26
slug: "gpu-fun-fact-gpu-decompression"
draft: false
type: "note"
series: "gpu-fun-facts"
tags: ["gpu", "compute", "directstorage", "compression", "io"]
difficulty: "beginner"
---

거대한 game world를 연다고 생각해 보자. 창고인 SSD에는 texture와 mesh가 압축 상자에 담겨 있고, GPU는 상자를 풀어야 쓸 수 있다. 예전의 흔한 동선은 SSD에서 system memory로 상자를 옮기고, CPU가 포장을 푼 뒤, 완성된 짐을 다시 GPU memory로 보내는 것이었다. SSD가 빨라져도 중간 포장대인 CPU가 바쁘면 입장이 계속 늦어질 수 있었다.

DirectStorage 1.1이 제시한 발상은 포장 상자를 GPU 쪽까지 보내 **GPU가 직접 압축을 풀게 하자**는 것이다. 여기서 SSD는 창고, compressed asset은 상자, GPU memory는 진열대에 대응한다. GPU는 같은 형태의 계산을 많은 data 조각에 병렬로 적용하는 데 강하므로, GDeflate처럼 GPU 실행을 염두에 둔 format은 decompression을 compute workload로 옮길 수 있다. CPU가 asset을 하나씩 풀어 주는 중간 역할도 줄어든다.

정확히는 “SSD가 GPU core에 직결된다”는 마법은 아니다. DirectStorage runtime, storage driver, memory transfer와 synchronization은 여전히 data 경로를 조율한다. 또한 아무 압축 format이나 GPU에서 빨라지는 것도 아니다. GPU가 병렬로 처리하기 좋은 block 구조, 충분한 I/O 양, hardware와 driver 지원이 맞아야 이득이 난다. 작은 asset은 준비 비용이 더 크게 보일 수도 있다.

왜 중요할까? 빠른 storage가 등장하면 병목이 사라지는 대신 다음 단계로 이동한다. GPU decompression은 GPU가 화면을 그리는 계산기만이 아니라, **자기에게 들어올 data를 준비하는 worker**도 될 수 있음을 보여 주는 사례다.

Source note: [Microsoft DirectX Developer Blog의 DirectStorage 1.1 소개](https://devblogs.microsoft.com/directx/directstorage-1-1-coming-soon/)는 기존 경로에서 CPU가 asset을 decompress한 뒤 GPU memory로 복사했다고 설명하고, GPU decompression이 이 작업을 GPU로 옮겨 load time과 CPU 부담을 줄일 수 있다고 소개한다. 같은 글은 GDeflate를 GPU decompression용 format으로 설명하며, 공개 sample의 수치는 workload와 hardware에 따라 달라진다고 명시한다.
