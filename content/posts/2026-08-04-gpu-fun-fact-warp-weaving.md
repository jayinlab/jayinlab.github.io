---
title: "CUDA의 warp는 왜 직조 용어일까"
date: 2026-08-04
slug: "gpu-fun-fact-warp-weaving"
draft: false
type: "note"
series: "gpu-fun-facts"
tags: ["gpu", "cuda", "compute", "simt", "warp"]
difficulty: "beginner"
---

CUDA code에는 `warp`라는 조금 엉뚱한 단어가 나온다. 보통은 시공간을 휘게 한다는 뜻부터 떠올리지만, NVIDIA 문서가 설명하는 어원은 직조다. 베틀에서 길이 방향으로 팽팽하게 놓인 실들을 warp라고 부른다. 여러 가닥이 나란히 움직이며 하나의 천을 만든다는 그림이 GPU의 병렬 thread 묶음과 묘하게 닮았다.

CUDA에서 thread는 혼자 존재하는 것처럼 kernel을 작성하지만, GPU는 한 block의 thread들을 32개씩 묶어 warp로 관리하고 실행한다. 이 방식은 NVIDIA가 `SIMT`, 즉 Single Instruction, Multiple Threads라고 부르는 모델이다. programmer에게는 각 thread가 자기 index와 register state를 가진 독립된 일꾼처럼 보이지만, hardware 쪽에서는 32가닥을 함께 엮어 한 instruction을 진행하는 셈이다.

이 이름의 비유는 branch를 만날 때 더 선명해진다. 같은 warp 안에서 절반은 `if`, 나머지는 `else`로 가면, GPU는 보통 한쪽 경로를 실행하는 동안 다른 lane을 비활성화하고 나서 반대쪽 경로를 처리한다. 실이 끊어지는 것은 아니지만, 모든 가닥이 동시에 유용한 일을 하지 못하는 순간이 생긴다. 이것이 흔히 말하는 warp divergence의 직관이다.

재미있는 점은 `warp`가 source code의 문법 단위라기보다 성능의 현실에 가깝다는 것이다. correctness만 생각하면 thread 중심으로 쓸 수 있지만, 빠르게 만들려면 32개가 어떻게 묶이고 같은 길을 걷는지 의식하게 된다. CUDA의 낯선 이름 하나가 “독립된 수많은 thread”와 “함께 움직이는 hardware 묶음”이라는 두 관점을 동시에 품고 있는 셈이다.

왜 중요할까? block 크기를 32의 배수로 잡거나 가까운 thread들이 비슷한 branch를 타게 만드는 관행은 단순한 주문이 아니다. GPU가 실을 한 가닥씩이 아니라 warp라는 묶음으로 엮어 처리한다는 데서 나온 practical consequence다.

Source note: NVIDIA CUDA Programming Guide의 SIMT Execution Model은 SM이 32개의 parallel thread를 warp로 관리·schedule·execute한다고 설명하고, `warp`라는 용어가 weaving의 초기 parallel-thread 기술에서 유래했다고 적는다. 같은 문서는 한 warp의 thread가 갈라진 branch를 택하면 각 경로를 차례로 실행하면서 해당하지 않는 thread를 비활성화한다고 설명한다.
