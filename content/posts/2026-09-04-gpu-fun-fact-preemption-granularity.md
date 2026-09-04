---
title: "GPU의 멈춤 버튼은 왜 즉시 듣지 않을까"
date: 2026-09-04
slug: "gpu-fun-fact-preemption-granularity"
draft: false
type: "note"
series: "gpu-fun-facts"
tags: ["gpu", "scheduler", "preemption", "context-switch", "wddm"]
difficulty: "beginner"
---

수백 명이 동시에 요리하는 거대한 주방에 “지금 멈추고 VIP 주문부터!”라고 외친다고 해 보자. 한 사람의 손만 멈추면 끝나는 일이 아니다. 화구와 재료가 어떤 상태인지 남기고, 안전하게 멈출 지점을 찾은 뒤, 나중에 이어 할 수 있어야 한다. GPU에서 먼저 실행 중인 작업을 밀어내는 **preemption**도 이런 단체 일시정지에 가깝다.

여기서 요리사는 실행 중인 thread 묶음, 조리 상태는 register와 여러 GPU context state, VIP 주문은 desktop 합성이나 더 높은 priority의 GPU 작업이다. 운영체제 scheduler가 preemption을 요청해도 실제 hardware가 어디서 끊을 수 있는지는 **preemption granularity**에 달려 있다. 큰 command나 DMA packet 경계에서만 바꿀 수 있는 장치보다, 그 안의 더 작은 경계에서 멈출 수 있는 장치가 긴 작업 사이에 급한 일을 끼워 넣기 쉽다.

대신 잘게 멈추는 능력은 공짜가 아니다. 중간 상태를 보존하고 복구할 hardware·driver 지원이 필요하고, context를 바꾸는 동안에는 원래 계산이 진전되지 않는다. 그래서 좋은 scheduler의 목표는 무조건 자주 끊는 것이 아니라, 화면 반응성과 긴 compute 작업의 처리량 사이에서 필요한 순간에 끊는 것이다. Windows의 WDDM도 driver가 지원하는 graphics·compute preemption 단위를 capability로 보고하게 한다.

왜 중요할까? 아주 긴 GPU kernel 하나가 화면을 직접 그리지 않더라도, 같은 GPU를 쓰는 desktop이나 다른 application의 반응성에 영향을 줄 수 있다. modern GPU의 “동시에 여러 일을 한다”는 말 뒤에는 단순 병렬 실행뿐 아니라, 우선순위와 preemption이라는 교통정리도 숨어 있다.

다만 주방 비유처럼 모든 상태를 software가 하나씩 포장한다는 뜻은 아니다. 저장 범위와 방식, 실제 중단 latency, engine별 독립 실행 여부는 GPU와 driver에 따라 다르다. 작은 granularity도 **즉시 중단**을 보장하는 동의어는 아니다.

Source note: [Microsoft의 GPU Preemption 문서](https://learn.microsoft.com/en-us/windows-hardware/drivers/display/gpu-preemption)는 긴 packet을 preempt하지 못하면 높은 priority의 DWM 작업이 지연될 수 있다고 설명한다. 또한 driver가 지원하는 preemption granularity를 보고해야 하며, 더 세밀한 mid-DMA-buffer preemption이 더 나은 사용자 경험을 줄 수 있고 split packet 경계에서는 GPU state를 save/restore해야 한다고 명시한다.
