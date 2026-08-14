---
title: "GPU compiler는 왜 작은 함수를 접었다 펼칠까"
date: 2026-08-14
slug: "gpu-fun-fact-compiler-inlining"
draft: false
type: "note"
series: "gpu-fun-facts"
tags: ["gpu", "compute", "compiler", "cuda", "inlining"]
difficulty: "beginner"
---

GPU kernel 안에서 작은 함수를 부르면 compiler는 종종 그 함수를 실제 호출로 남기지 않는다. 대신 함수의 내용을 호출 지점에 그대로 복사해 넣는다. 책의 각주를 보러 페이지를 넘기는 대신, 각주 내용을 본문 옆에 붙여 놓는 셈이다. 이것이 **function inlining**이다.

펼쳐 놓으면 call과 return, parameter 전달 같은 경계를 없앨 수 있다. 더 흥미로운 이득은 compiler의 시야가 넓어진다는 점이다. 호출자가 넘긴 값이 상수라는 사실을 보고 계산을 미리 지우거나, 함수 안팎의 instruction을 함께 재배치할 수 있다. CUDA compiler도 적절하다고 판단한 `__device__` 함수를 자동으로 inline하며, 필요하면 `__forceinline__`이나 `__noinline__`으로 방향을 줄 수 있다.

하지만 도장을 여러 곳에 찍듯 긴 함수 본문을 매 호출 지점에 복제하면 program이 커진다. 그러면 instruction cache에 머물기 어려워지고 compile 시간도 늘 수 있다. NVIDIA compiler 문서도 무분별한 inlining은 code size만 크게 만들고 속도는 늘리지 못할 수 있다고 경고한다. 별도 compilation에서는 compiler가 파일 너머를 보기 어려워지므로, LTO가 이 경계를 늦게 다시 열어 주기도 한다.

왜 중요할까? `forceinline`은 “무조건 빠르게” 버튼이 아니다. GPU compiler가 함수 크기, 최적화 기회, code size를 함께 보고 자동 판단하는 이유가 여기에 있다. 빠른 길은 때로 함수를 없애는 것이고, 때로는 작은 함수로 남겨 instruction cache의 짐을 줄이는 것이다.

Source note: [CUDA Programming Guide](https://docs.nvidia.com/cuda/cuda-programming-guide/05-appendices/cpp-language-extensions.html#inlining-specifiers)는 `__noinline__`, `__forceinline__`, `__inline_hint__`의 의미를 설명한다. [NVCC 안내](https://docs.nvidia.com/cuda/cuda-programming-guide/02-basics/nvcc.html)는 LTO가 file 간 최적화 기회를 되찾는 대신 compile 시간이 늘 수 있다고 설명하며, [NVIDIA HPC Compilers Guide](https://docs.nvidia.com/hpc-sdk/compilers/hpc-compilers-user-guide/index.html#using-function-inlining)는 inlining의 call overhead 제거와 code-size tradeoff를 정리한다.
