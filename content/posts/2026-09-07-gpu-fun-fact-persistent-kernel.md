---
title: "GPU kernel은 왜 퇴근하지 않고 다음 일을 받을까"
date: 2026-09-07
slug: "gpu-fun-fact-persistent-kernel"
draft: false
type: "note"
series: "gpu-fun-facts"
tags: ["gpu", "cuda", "cutlass", "persistent-kernel", "scheduling"]
difficulty: "beginner"
---

식당에 주문 한 건이 들어올 때마다 요리사를 새로 출근시키고, 한 접시를 만들면 바로 퇴근시킨다고 상상해 보자. 손님보다 출퇴근 절차가 더 바빠질 수 있다. **persistent kernel**은 일정 수의 GPU 작업자를 한동안 주방에 남겨 두고, 끝낸 작업자에게 다음 주문을 건네는 방식과 닮았다.

여기서 요리사는 thread block, 주방은 SM, 주문은 계산할 output tile이다. 보통 큰 행렬 곱셈은 수많은 tile로 나뉘며, 각 block이 한 tile을 계산하고 끝날 수 있다. 반면 NVIDIA CUTLASS의 persistent cooperative GEMM은 사용 가능한 SM 수에 맞춰 persistent block들을 띄우고, 각 block이 살아 있는 동안 여러 output tile을 처리한다. 다음 tile 배정은 kernel 안의 **tile scheduler**가 맡는다.

흥미로운 점은 계산식이 아니라 “일을 나눠 주는 위치”가 바뀐다는 것이다. block 하나가 여러 tile을 이어 맡으면 매 tile마다 반복될 수 있는 block 시작과 kernel prologue 비용을 나눠 부담할 수 있다. 크기가 들쭉날쭉한 문제에서도 scheduler가 남은 tile을 건네며 일감을 배분할 여지가 생긴다.

하지만 상주 요리사가 언제나 빠른 것은 아니다. 너무 많은 자원을 붙잡거나, 작업 분배용 atomic·동기화 비용이 커지거나, tile 수가 적으면 이점이 줄 수 있다. 그리고 persistent라는 말도 영원히 실행된다는 뜻은 아니다. 한 번 출근한 block이 **한 tile보다 오래 살아 여러 tile을 처리한다**는 설계 패턴에 가깝다.

Source note: [NVIDIA CUTLASS Efficient GEMM 문서](https://github.com/NVIDIA/cutlass/blob/main/media/docs/cpp/efficient_gemm.md#warp-specialized-persistent-cooperative-kernel-design)는 persistent thread block을 사용 가능한 SM 수에 맞춰 띄우고, block 하나가 생애 동안 여러 output tile을 계산해 thread-block launch와 kernel prologue 비용을 amortize한다고 설명한다. 또한 tile scheduler가 grid 크기와 tile 배정을 관리한다고 명시한다.
