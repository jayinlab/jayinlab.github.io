---
title: "GPU program은 왜 driver update 뒤 첫 실행이 느릴까"
date: 2026-08-17
slug: "gpu-fun-fact-jit-cache"
draft: false
type: "note"
series: "gpu-fun-facts"
tags: ["gpu", "compute", "cuda", "compiler", "jit"]
difficulty: "beginner"
---

어제까지 잘 뜨던 CUDA application이 driver를 update한 뒤 첫 실행에서 잠깐 머뭇거릴 때가 있다. GPU가 새 driver에 적응하느라 몸을 푸는 것은 아니다. 실행 파일 안에 실제 GPU instruction 대신 **PTX라는 virtual instruction**이 들어 있다면, driver가 현재 GPU용 binary code로 번역하는 JIT(Just-In-Time) compilation이 일어날 수 있다.

PTX를 함께 배포하는 이유는 미래의 GPU를 미리 알 수 없기 때문이다. 오늘 만든 application에 특정 GPU용 binary만 담으면 나중에 나온 architecture에서는 맞는 code가 없을 수 있다. 반면 PTX를 남겨 두면 미래의 driver가 새 GPU에 맞게 번역할 수 있다. 작은 중간 언어가 application의 수명을 늘려 주는 셈이다.

물론 매번 번역하면 시작할 때마다 답답하다. 그래서 NVIDIA driver는 JIT 결과를 **compute cache**에 저장해 다음 실행에서 재사용한다. 재미있는 부분은 driver가 update되면 이 cache가 자동으로 무효화된다는 점이다. 새 driver에 들어온 compiler 개선을 적용하려면 예전 번역본을 계속 쓰지 않는 편이 맞기 때문이다. 그 결과 update 직후 한 번은 compile 비용을 다시 내고, 이후에는 cache 덕분에 빨라질 수 있다.

왜 중요할까? 첫 실행 latency가 kernel 자체의 느린 계산과 항상 같은 뜻은 아니다. 배포한 binary에 어떤 GPU code와 PTX가 들어 있는지, JIT cache가 따뜻한지를 구분하면 “첫 번만 느린” 현상을 훨씬 덜 미스터리하게 볼 수 있다.

Source note: [NVIDIA CUDA Programming Guide](https://docs.nvidia.com/cuda/cuda-programming-guide/01-introduction/cuda-platform.html#just-in-time-compilation)는 PTX가 application load 시 driver에 의해 GPU binary로 JIT compile되어 미래 GPU와의 forward compatibility를 제공하고, 생성된 binary는 compute cache에 저장되며 driver upgrade 때 자동으로 무효화된다고 설명한다.
