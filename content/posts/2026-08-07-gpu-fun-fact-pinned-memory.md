---
title: "GPU 비동기 복사는 왜 memory를 핀으로 고정할까"
date: 2026-08-07
slug: "gpu-fun-fact-pinned-memory"
draft: false
type: "note"
series: "gpu-fun-facts"
tags: ["gpu", "cuda", "memory", "dma", "performance"]
difficulty: "beginner"
---

CPU memory에서 GPU로 data를 옮길 때 `malloc`으로 받은 평범한 memory면 충분해 보인다. 주소도 있고, 내용도 멀쩡한데 CUDA의 진짜 asynchronous copy와 계산 겹치기에는 왜 굳이 **pinned memory**가 필요할까?

이름 그대로 pinned memory는 운영체제가 그 memory page를 다른 물리 위치로 옮기거나 swap out하지 못하게 붙잡아 둔 host memory다. GPU 쪽 copy engine은 CPU가 한 byte씩 나르는 대신 DMA 방식으로 host memory를 직접 읽는다. 그런데 전송 도중 page의 물리적 위치가 바뀔 수 있다면, copy engine에 건네 둔 주소 목록을 안심하고 사용할 수 없다.

그래서 pageable memory를 복사할 때 CUDA driver는 흔히 작은 이삿짐 센터 역할을 한다. 먼저 임시 pinned buffer를 마련하고 CPU가 data를 그곳으로 옮긴 뒤, GPU가 그 고정된 장소에서 가져가게 한다. 호출 한 번 뒤에 숨은 이 staging copy 때문에 bandwidth와 비동기성이 손해를 볼 수 있다. 반대로 `cudaMallocHost`나 `cudaHostRegister`로 고정한 memory는 copy engine이 안정적으로 다룰 수 있어, 지원되는 hardware와 stream 구성에서는 kernel 실행과 전송을 겹칠 길이 열린다.

물론 모든 host memory를 고정하면 좋은 것은 아니다. pinned page는 운영체제가 자유롭게 회수하거나 이동시키기 어려우므로 너무 많이 잡으면 system 전체의 memory 운용을 방해한다. 빠른 택배를 위해 상시 전용 주차장을 비워 두는 셈이라, 자주 오가는 큰 buffer에 골라 쓰는 편이 낫다.

왜 중요할까? `Async`라는 API 이름만으로 data 이동이 저절로 숨어 버리지는 않는다. GPU의 copy engine이 CPU 계산과 독립적으로 일하려면, 먼저 “짐이 전송 중 사라지지 않을 고정 주소에 있다”는 물리적인 계약이 필요하다.

Source note: NVIDIA CUDA Programming Guide는 일반 host allocation이 page-locked가 아니어서 swap되거나 물리적으로 이동될 수 있으며, page-locked host memory가 CPU-GPU asynchronous copy에 필요하다고 설명한다. NVIDIA의 data-transfer 안내는 pageable memory 전송 시 driver가 임시 pinned buffer로 먼저 복사한 뒤 device로 옮기는 staging 과정을 설명한다.
