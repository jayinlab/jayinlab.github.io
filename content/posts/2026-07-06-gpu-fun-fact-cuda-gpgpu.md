---
title: "CUDA는 어떻게 GPU를 ‘그래픽 카드’ 밖으로 끌어냈을까"
date: 2026-07-06
slug: "gpu-fun-fact-cuda-gpgpu"
draft: false
type: "note"
series: "gpu-fun-facts"
tags: ["gpu", "cuda", "nvidia", "gpgpu", "api-history"]
difficulty: "beginner"
---

CUDA가 흥미로운 이유는 “GPU가 빠르다”를 처음 발견했기 때문이 아니다. 2000년대 초반에도 연구자들은 이미 GPU의 병렬 계산 능력을 일반 계산에 써 보려고 했다. 다만 그때는 계산을 그래픽 작업처럼 위장해야 하는 경우가 많았다. 숫자 배열은 texture처럼 다루고, 계산은 shader처럼 짜고, 결과도 그래픽 pipeline의 규칙 안에서 꺼내야 했다.

NVIDIA가 2006년에 CUDA를 내놓으며 바꾼 지점은 이 우회로였다. CUDA는 GPU를 “그림을 그리는 장치”가 아니라 “수천 개 thread를 한꺼번에 돌릴 수 있는 병렬 processor”로 프로그래밍하게 해줬다. 개발자는 그래픽 API의 언어로 빙빙 말하지 않고, C/C++에 가까운 방식으로 kernel, thread, memory를 생각할 수 있게 됐다.

이 변화는 단순한 문법 편의 이상이었다. GPU 계산이 연구실의 영리한 꼼수에서, 라이브러리와 toolchain과 문서가 붙은 개발 플랫폼으로 넘어가는 순간에 가까웠다. 그래서 CUDA 이후의 GPGPU는 “가능은 한데 괴로운 기술”에서 “배워서 제품과 논문에 넣을 수 있는 기술”로 훨씬 빨리 퍼졌다.

왜 중요할까? CUDA의 성공은 이후 OpenCL, Vulkan compute, Metal 같은 API를 볼 때도 배경음처럼 남아 있다. GPU compute API들은 서로 철학이 다르지만, 공통으로 “GPU를 그래픽 전용 장치가 아니라 일반 병렬 계산 장치로 보이게 만들기”라는 문제를 풀고 있다.

Source note: NVIDIA CUDA Programming Guide는 GPU가 원래 3D graphics용 processor에서 점점 programmable해졌고, NVIDIA가 2006년에 CUDA를 도입해 graphics API와 독립적으로 GPU throughput을 일반 계산 workload에 쓰게 했다고 설명한다.
