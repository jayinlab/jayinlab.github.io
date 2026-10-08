---
title: "PM4는 ALU에게 주는 계산식일까?"
date: 2026-10-08
slug: "pm4-is-not-alu-instruction"
draft: false
type: "note"
series: "gpu-to-alu"
tags: ["gpu", "amd", "pm4", "isa", "compute"]
difficulty: "beginner"
---

GPU 공장에 덧셈 일을 맡긴다고 해보자. 종이 두 장이 필요하다. 하나는 **“이 작업을 지금 시작해”**라는 가동 지시서, 다른 하나는 작업장에서 따를 **“두 값을 읽어 더해”**라는 작업 절차다. 둘을 같은 ‘명령’이라고 부르면, PM4에서 ALU까지의 길이 갑자기 흐릿해진다.

오늘 붙잡을 사실은 딱 하나다. **PM4는 ALU가 실행하는 덧셈 명령 자체가 아니다.** AMD GPU의 graphics/compute command stream에서 PM4 packet은 command processor가 처리하는 쪽의 명령이다. kernel을 실행하려면 driver가 코드와 자원에 관한 상태를 준비하고 dispatch를 제출한다. 반면 `A[i] + B[i]` 같은 계산의 구체적인 동작은 compiler가 만든 **GPU ISA**, 즉 kernel의 기계어에 들어간다. GPU의 CU가 그 instruction을 실행할 때 비로소 연산 파이프라인이 값을 계산한다.

작은 그림으로 쓰면 이렇다.

```text
가동 지시(PM4 쪽):  준비한 kernel 작업을 시작
작업 절차(GPU ISA):  값을 읽고 → 더하고 → 결과를 씀
```

그러니 “PM4가 주문인가?”에 대한 대답은 **어느 주문을 뜻하느냐에 따라 ‘가동 주문’으로는 맞다**이다. 하지만 PM4 packet 하나가 “ALU야, 지금 1+1을 해”라고 직접 말을 거는 그림은 아니다. command processor가 command stream을 처리해 실행을 시작시키고, 뒤쪽의 work-group 배치와 CU의 instruction 실행을 거쳐 ALU까지 도달한다. CPU도 packet을 손에 쥐여 주듯 직접 전달하는 게 아니라, 보통 driver가 GPU가 읽을 수 있는 queue/command buffer에 명령을 놓고 제출한다. 구체적인 제출 경로는 driver와 GPU 세대에 따라 다르다.

이 공장 비유의 한계도 분명하다. 가동 지시서와 작업 절차는 **서로 다른 하드웨어가 소비하는 명령 계층**을 가리키지만, 실제 실행은 사람이 종이를 순서대로 전달하는 선형 절차가 아니다. 여러 queue와 work-group이 겹칠 수 있고, 작업장도 ALU만 있는 건 아니다. 그래도 첫 단추로는 충분하다. **PM4는 일을 시작하게 하는 쪽, GPU ISA는 그 일이 무엇인지 실행하는 쪽.**

근거: [AMD ROCm HIP — Hardware implementation](https://rocm.docs.amd.com/projects/HIP/en/latest/understand/hardware_implementation.html)은 command processor의 command fetch·decode 및 kernel dispatch와 CU의 instruction fetch·execution을 구분한다. [Linux kernel — AMDGPU User Mode Queues](https://docs.kernel.org/gpu/amdgpu/userq.html)는 software가 engine-specific packet을 ring buffer에 쓰고 GPU firmware가 이를 처리하는 제출 경로를 설명한다. 여기서 PM4는 AMD graphics/compute command stream 맥락의 이름이며, 모든 AMD 엔진의 모든 packet을 PM4라고 부르는 뜻은 아니다.
