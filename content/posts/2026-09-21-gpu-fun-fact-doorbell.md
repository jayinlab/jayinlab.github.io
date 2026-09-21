---
title: "GPU에게 일감이 왔다고 누가 초인종을 누를까"
date: 2026-09-21
slug: "gpu-fun-fact-doorbell"
draft: false
type: "note"
series: "gpu-fun-fact"
tags: ["gpu", "driver", "command-processor", "amdgpu", "queue"]
difficulty: "beginner"
---

배달원이 상자를 현관 앞에 내려놓기만 하고 초인종을 누르지 않는다면, 집 안 사람은 새 물건이 왔는지 모른다. GPU command도 비슷하다. software가 memory의 queue에 packet을 써 넣는 일과, GPU에게 “여기까지 새로 채웠어”라고 알리는 일은 서로 다르다. AMDGPU 문서가 이 알림 장치를 실제로 **doorbell**이라고 부르는 이유다.

GPU queue는 흔히 원형 컨베이어 벨트인 ring buffer로 설명된다. software는 producer로서 command를 넣고 `wptr`(write pointer)를 앞으로 옮긴다. GPU engine은 consumer로서 `rptr`(read pointer)가 가리키는 곳부터 packet을 읽는다. 두 pointer가 같으면 당장 읽을 새 일이 없는 상태이고, `wptr`가 앞서면 그 사이가 새 일감이다. user-mode queue에서는 doorbell용 MMIO 영역에 값을 써서 이 갱신을 hardware에 신호할 수 있다.

여기서 재미있는 절약이 생긴다. command 본문 전체를 매번 특수 register로 밀어 넣을 필요가 없다. 큰 주문서는 평범한 memory queue에 두고, 아주 작은 doorbell write로 도착 사실과 진행 위치를 알린다. AMDGPU의 Memory Queue Descriptor도 queue의 GPU virtual address와 doorbell 같은 상태를 보관하며, scheduling firmware는 이를 이용해 hardware queue 상태를 다룬다.

다만 현관 비유처럼 doorbell 한 번이 “이 작업을 지금 즉시 끝내라”는 뜻은 아니다. 실제 실행 시점과 순서는 scheduler, engine 상태, dependency와 synchronization에 달려 있다. 또한 정확한 doorbell 배치와 queue 동작은 GPU 세대와 driver 방식에 따라 달라진다. doorbell은 계산 자체가 아니라, memory에 준비된 일을 GPU가 놓치지 않게 깨우는 짧은 알림이다.

출처: [Linux kernel AMDGPU Ring Buffer documentation](https://docs.kernel.org/gpu/amdgpu/ring-buffer.html), [Linux kernel AMDGPU Driver Core documentation](https://docs.kernel.org/gpu/amdgpu/driver-core.html)
