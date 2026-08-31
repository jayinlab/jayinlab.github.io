---
title: "GPU에게도 doorbell이 필요한 이유"
date: 2026-08-31
slug: "gpu-fun-fact-doorbell"
draft: false
type: "note"
series: "gpu-fun-facts"
tags: ["gpu", "compute", "driver", "queue", "doorbell"]
difficulty: "beginner"
---

배달원이 현관 초인종을 누를 때, 상자 전체를 버튼 속으로 밀어 넣지는 않는다. 상자는 이미 문 앞에 있고 초인종은 그저 **“도착했어요”**라고 알린다. GPU에도 정말 **doorbell**이라 불리는 장치가 있다. CPU 쪽 driver가 GPU에게 새 일이 생겼음을 알릴 때 쓰는 작은 신호다.

여기서 상자는 실행할 command packet, 문 앞은 memory의 **ring buffer**, 배달 기록의 끝 표시는 **write pointer(wptr)**다. software가 packet들을 queue에 쓰고 wptr를 갱신한 뒤 doorbell을 쓰면, GPU firmware는 깨어나 wptr를 확인하고 그 지점까지 packet을 처리하기 시작한다. doorbell 자체에 kernel code나 command 전체가 실려 가는 것은 아니다.

이 분리가 재미있는 이유는 큰 명령 묶음과 작은 알림의 역할이 다르기 때문이다. command는 GPU가 읽을 수 있는 memory에 차곡차곡 놓고, MMIO 영역의 작은 doorbell write로 “이제 읽어도 된다”고 알릴 수 있다. AMDGPU의 user-mode queue 설계에서는 application이 queue에 packet을 직접 기록하고 doorbell을 울려, 매 제출마다 kernel IOCTL을 왕복하는 비용을 줄이는 방향도 설명한다.

다만 진짜 현관문과 달리 순서가 아주 엄격하다. packet과 wptr가 GPU에 올바르게 보이기 전에 초인종부터 울리면 완성되지 않은 일을 알리는 셈이다. 또한 실제 queue 구성, scheduling firmware, memory ordering은 GPU와 driver마다 다르다. 핵심은 단순하다. **doorbell은 일을 운반하는 트럭이 아니라, 준비된 일을 보러 오라는 알림이다.**

Source note: [Linux kernel AMDGPU User Mode Queues 문서](https://docs.kernel.org/gpu/amdgpu/userq.html)는 queue를 rptr/wptr가 있는 ring buffer로 설명하고, doorbell write가 firmware를 깨워 wptr를 가져오고 packet 처리를 시작하게 한다고 명시한다. 같은 문서는 user-mode queue가 submission의 kernel IOCTL 왕복을 줄이려는 설계임도 설명한다. 세부 동작은 engine과 scheduling firmware에 따라 달라진다.
