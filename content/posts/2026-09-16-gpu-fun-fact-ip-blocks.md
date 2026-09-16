---
title: "GPU는 왜 하나의 칩 안에 여러 부서를 둘까"
date: 2026-09-16
slug: "gpu-fun-fact-ip-blocks"
draft: false
type: "note"
series: "gpu-fun-facts"
tags: ["gpu", "architecture", "driver", "amdgpu", "ip-block"]
difficulty: "beginner"
---

GPU를 거대한 계산기 한 대라고 생각하기 쉽지만, 실제 모습은 여러 부서가 입주한 작은 회사에 가깝다. Linux AMDGPU 문서는 GPU를 여러 `IP block`의 집합으로 설명한다. 이름도 역할도 제각각이다.

`GFX`는 graphics와 compute command를 처리하고, `SDMA`는 memory copy와 이동을 맡는다. `VCN`은 video encode/decode, `DCN`은 display controller다. 여기에 보안 firmware와 trusted operation을 담당하는 `PSP`, clock·thermal·power management와 reset distribution을 맡는 `SMU`도 있다. kernel 하나가 계산되는 동안에도 화면 출력, data 이동, 전력 조절은 서로 다른 전문 block에서 진행될 수 있다.

driver도 이 구성을 그대로 닮는다. AMDGPU는 공통 device 구조체 안에 IP block별 함수표를 두고, 초기화 과정에서 각 block의 `early_init`, `sw_init`, `hw_init` 같은 callback을 차례로 호출한다. 모든 세대의 GPU를 하나의 거대한 함수로 다루기보다, block마다 세대별 구현을 꽂는 구조다. 특정 block을 초기화하거나 정지시키고 상태를 관리해야 하므로 software의 경계가 hardware의 경계를 따라간 셈이다.

왜 흥미로울까? “GPU driver”라는 단수 명사 뒤에는 compute engine만 있는 것이 아니다. 복사·영상·화면·전력·보안까지 서로 다른 장치를 한 제품처럼 보이게 조율하는 일이 숨어 있다. GPU bring-up이나 hang 분석에서 어느 IP block의 문제인지 먼저 나누는 이유도 여기서 보인다.

회사 비유의 한계는 부서들이 완전히 독립적이지 않다는 점이다. memory와 interrupt, clock, reset 같은 자원을 공유하고 서로 영향을 준다. 또한 block의 정확한 이름·개수·책임은 GPU 세대와 vendor에 따라 달라진다. 확실한 것은 현대 GPU가 단일 계산 core가 아니라, 여러 특수 목적 engine과 controller를 묶은 system이라는 점이다.

Source note: [Linux kernel AMDGPU Driver Core documentation](https://docs.kernel.org/gpu/amdgpu/driver-core.html)은 AMDGPU의 주요 IP block과 GFX·SDMA·VCN·DCN·PSP·SMU의 역할을 설명한다. 또한 driver가 IP block별 함수표와 단계별 initialization callback을 사용한다고 문서화한다.
