---
title: "GPU에도 초인종이 필요한 이유"
date: 2026-09-16
slug: "gpu-fun-fact-doorbell"
draft: false
type: "note"
series: "gpu-fun-facts"
tags: ["gpu", "driver", "runtime", "queue", "amdgpu", "doorbell"]
difficulty: "beginner"
---

배달 상자가 현관에 놓였다고 집 안 사람이 저절로 아는 것은 아니다. 초인종을 눌러야 한다. AMD GPU의 command queue에도 정말 `doorbell`이라는 장치가 있다. 이름만 귀여운 비유가 아니라, Linux AMDGPU 문서가 그대로 쓰는 하드웨어·driver 용어다.

CPU 쪽 runtime과 driver는 GPU가 수행할 명령을 queue에 마련한다. 긴 명령을 queue 안에 전부 늘어놓는 대신, 별도 memory에 만든 command buffer인 `IB(Indirect Buffer)`의 pointer를 queue에 넣을 수도 있다. 그리고 user-mode queue에 새 일이 있음을 알리는 통로가 doorbell이다. AMDGPU에서 doorbell 영역은 **queue를 signal하기 위한 MMIO 영역**으로 설명된다. 즉 초인종에는 요리법 전체를 싣는 것이 아니라, 이미 준비된 주문표를 확인하라는 신호를 보낸다.

한 단계 더 들어가면 queue의 주소, 저장 영역, doorbell 같은 상태는 memory의 `MQD(Memory Queue Descriptor)`에 보관된다. scheduling firmware는 이 상태를 하드웨어의 `HQD(Hardware Queue Descriptor)` register로 불러오거나 다시 저장하고, 활성화된 queue의 일을 pipe가 실행한다. “명령을 memory에 준비하는 일”과 “GPU에게 살펴보라고 알리는 일”을 나누면 CPU가 매번 거대한 명령 묶음을 register로 밀어 넣지 않아도 된다.

왜 흥미로울까? kernel launch 한 번 뒤에는 계산식만 있는 것이 아니다. memory 속 queue, descriptor, firmware, MMIO 신호가 맞물려 GPU가 일을 발견한다. 아주 짧은 작업을 수없이 제출할 때 launch 경로 자체가 무시 못 할 비용이 되는 이유도 엿볼 수 있다.

초인종 비유에는 한계가 있다. 사람이 벨을 들으면 즉시 문을 여는 것과 달리, doorbell은 즉시 실행이나 공정한 순서를 보장하지 않는다. 어느 queue가 언제 실제로 실행되는지는 queue mapping, firmware scheduling, 이미 진행 중인 작업과 하드웨어에 달려 있다.

Source note: [Linux kernel AMDGPU Driver Core documentation](https://docs.kernel.org/gpu/amdgpu/driver-core.html)은 doorbell을 user-mode queue를 signal하는 MMIO 영역으로 정의하고, IB를 memory 속 command buffer를 가리키는 pointer로 설명한다. 또한 MQD가 queue 주소·저장 영역·doorbell 등의 상태를 보관하며 scheduling firmware가 MQD와 HQD 사이에서 상태를 옮긴다고 설명한다.
