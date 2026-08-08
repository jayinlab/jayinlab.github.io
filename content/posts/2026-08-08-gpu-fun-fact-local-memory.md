---
title: "GPU의 local memory는 왜 멀리 있을까"
date: 2026-08-08
slug: "gpu-fun-fact-local-memory"
draft: false
type: "note"
series: "gpu-fun-facts"
tags: ["gpu", "cuda", "memory", "compiler", "performance"]
difficulty: "beginner"
---

CUDA code에서 `local memory`라는 말을 만나면 아주 가까운 작은 창고를 떠올리기 쉽다. CPU의 stack처럼 각 thread 바로 옆에 있을 것 같지만, 실제 뜻은 위치가 아니라 **주인**이다. 다른 thread와 공유하지 않고 한 thread에만 보이는 memory라는 뜻이며, 물리적으로는 global memory와 같은 device memory 쪽에 놓인다.

이 조금 얄궂은 이름은 compiler의 사정을 보면 이해된다. thread의 작은 변수는 보통 빠른 register에 들어간다. 하지만 크기가 큰 배열이나 구조체, 실행 중 바뀌는 index로 접근해 register에 깔끔하게 펼치기 어려운 배열은 어디엔가 내려놓아야 한다. kernel이 요구하는 register가 너무 많을 때 생기는 `register spilling`도 같은 피난처를 찾는다. 그곳이 thread마다 자기 구역을 갖는 local memory다.

따라서 source code에 평범한 지역 변수 하나를 썼다고 곧바로 느려지는 것은 아니다. compiler가 register에 둘 수 있으면 그대로 빠르게 남는다. 반대로 코드상으로는 작은 개인 변수처럼 보여도 compile 결과에 따라 device memory traffic이 생길 수 있다. CUDA에서는 PTX의 `.local`, `ld.local`, `st.local`이나 `ptxas`가 보고하는 `lmem`이 그 흔적을 찾는 단서가 된다.

재미있는 점은 local memory의 배치도 GPU답다는 것이다. 같은 warp의 thread들이 각자 같은 상대 위치를 읽으면 access가 합쳐지기 좋도록 구성된다. 멀리 있다고 해서 언제나 최악은 아니지만, register보다 latency가 크고 cache와 memory traffic의 영향을 받는다는 사실은 변하지 않는다.

왜 중요할까? GPU memory 이름은 종종 물리적 거리가 아니라 **누가 볼 수 있는가**를 설명한다. `local`을 “가까움”으로 읽으면 performance 추측이 뒤집히고, “thread-private이지만 필요하면 device memory에 놓이는 공간”으로 읽으면 compiler가 왜 spill을 경고하는지 자연스럽게 보인다.

Source note: NVIDIA CUDA Programming Guide의 Local Memory 절은 local이 물리 위치가 아니라 논리적 scope를 뜻하며, 실제 storage는 global memory space에 있다고 설명한다. 또한 동적 index 배열, 큰 구조체·배열, register spill을 대표적인 사용 사례로 들고, PTX 및 `ptxas` output으로 local memory 사용을 확인하는 방법을 안내한다.
