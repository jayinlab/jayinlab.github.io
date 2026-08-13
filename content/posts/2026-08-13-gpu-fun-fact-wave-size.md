---
title: "GPU의 줄 맞추기는 왜 32명과 64명일까"
date: 2026-08-13
slug: "gpu-fun-fact-wave-size"
draft: false
type: "note"
series: "gpu-fun-facts"
tags: ["gpu", "compute", "simt", "warp", "wavefront", "subgroup"]
difficulty: "beginner"
---

GPU kernel은 thread 수천 개를 한꺼번에 실행하는 것처럼 보이지만, 실제 hardware는 이들을 작은 줄로 묶어 움직인다. NVIDIA는 보통 32-thread 묶음을 **warp**, AMD는 **wavefront**라고 부른다. 그런데 AMD의 GCN은 wave64가 익숙했고, RDNA는 native wave32를 도입하면서 32와 64를 모두 다루게 됐다. GPU 세계의 줄 맞추기는 왜 한 숫자로 통일되지 않았을까?

묶음이 작으면 갈림길에 강하다. `if`에서 절반만 다른 길로 가거나 work-group 끝에 thread가 조금 남아도, 쉬는 lane이 비교적 적다. barrier를 지나 다시 출발하는 시간도 짧아질 수 있다. 반대로 큰 묶음은 한 instruction으로 더 많은 thread의 bookkeeping을 함께 처리하고, 같은 수의 thread를 추적할 때 wave 개수를 줄이는 장점이 있다. 어느 쪽도 공짜 승리는 아니다.

RDNA의 계산 폭은 기본적으로 32 lane이다. 그래서 wave32는 한 번에 자연스럽게 처리되지만, wave64의 vector instruction은 낮은 32개와 높은 32개를 나눠 실행한다. 그럼에도 compiler가 wave64를 고를 수 있는 것은 register 사용량, occupancy, branch 모양처럼 kernel마다 유리한 선택이 다르기 때문이다. NVIDIA CUDA의 warp는 32로 고정되어 있지만, OpenCL은 이 차이를 숨기기 위해 sub-group 크기를 implementation-defined로 남겨 둔다.

왜 중요할까? `sub-group은 언제나 32개`라고 가정한 reduction이나 shuffle은 다른 GPU에서 조용히 틀릴 수 있다. 32와 64는 단순한 vendor 취향이 아니라, 빈 lane을 줄일지 한 묶음의 관리 효율을 높일지에 대한 architecture와 compiler의 협상 결과다.

Source note: [AMD RDNA ISA 문서](https://gpuopen.com/wp-content/uploads/2019/08/RDNA_Shader_ISA_7July2019.pdf)는 RDNA가 wave32와 wave64를 지원하며 wave64 vector operation을 두 번에 나눠 실행한다고 설명한다. [AMD GPUOpen](https://gpuopen.com/learn/occupancy-explained/)은 compiler의 wave mode 선택과 resource tradeoff를, [CUDA Programming Guide](https://docs.nvidia.com/cuda/cuda-programming-guide/01-introduction/programming-model.html)는 32-thread warp를, [OpenCL Specification](https://registry.khronos.org/OpenCL/specs/unified/html/OpenCL_API.html)는 sub-group 크기와 개수가 implementation-defined임을 명시한다.
