---
title: "GPU라는 이름은 언제부터 진짜 이름이 됐을까"
date: 2026-07-14
slug: "gpu-fun-fact-geforce-256-gpu-name"
draft: false
type: "note"
series: "gpu-fun-facts"
tags: ["gpu", "nvidia", "geforce", "graphics-history"]
difficulty: "beginner"
---

요즘은 GPU라는 말이 너무 자연스럽다. game도 GPU, AI도 GPU, compute도 GPU다. 그런데 1990년대 말 PC 시장에서는 아직 “graphics accelerator”, “3D card” 같은 말이 더 익숙했다. 그래픽 카드는 화면을 빠르게 그려 주는 부품이라는 느낌이 강했고, CPU와 나란히 “processor”라고 부르는 감각은 지금보다 덜했다.

NVIDIA가 1999년에 GeForce 256을 내놓으며 붙인 표현이 재미있다. 회사 timeline에는 이 제품을 “industry's first graphics processing unit (GPU)”라고 적고 있다. 이 말이 완전히 빈말은 아니었다. 당시 NVIDIA가 강조한 포인트는 transform, lighting, triangle setup/clipping, rendering 같은 3D pipeline 일을 한 chip 안에 묶었다는 점이었다. 특히 transform & lighting은 CPU가 맡던 geometry 계산 일부를 그래픽 칩 쪽으로 옮긴다는 상징성이 컸다.

물론 “GPU 같은 것”이 그날 갑자기 무에서 생긴 것은 아니다. 이전에도 2D/3D 가속 칩은 있었고, workstation graphics 쪽에는 더 오래된 전통이 있었다. 그래서 여기서 중요한 건 발명 날짜 하나를 외우는 것보다, 마케팅 문구가 시장의 인식을 어떻게 바꿨는지를 보는 쪽에 가깝다. GeForce 256은 그래픽 카드를 단순한 화면 보조 장치가 아니라, 자체 pipeline과 계산 책임을 가진 processor처럼 말하게 만든 대표적 순간이었다.

왜 중요할까? GPU라는 이름이 굳어지면서 이후의 CUDA, shader model, general-purpose GPU computing 이야기도 더 자연스러워졌다. “그래픽을 가속하는 카드”가 아니라 “많은 병렬 작업을 맡는 processor”라는 이름을 얻었기 때문이다. 지금 우리가 GPU를 AI accelerator나 compute device로 부르는 것도, 어느 정도는 그 이름의 방향 전환 위에 서 있다.

Source note: NVIDIA corporate timeline은 1999년 8월 GeForce 256을 “industry's first graphics processing unit (GPU)”로 출시했다고 기록한다. NVIDIA의 25주년 회고 글과 당시 launch wording은 GeForce 256이 hardware transform and lighting을 포함했고, CPU의 3D pipeline 부담 일부를 그래픽 칩으로 옮겼다는 점을 강조한다.
