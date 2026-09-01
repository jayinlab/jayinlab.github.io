---
title: "GPU memory는 어떻게 짐을 접어서 나를까"
date: 2026-09-01
slug: "gpu-fun-fact-compute-data-compression"
draft: false
type: "note"
series: "gpu-fun-facts"
tags: ["gpu", "compute", "memory", "compression", "bandwidth"]
difficulty: "beginner"
---

이삿짐 트럭에 빈 상자와 똑같은 이불을 그대로 쌓는 대신, 접거나 “이 모양 100개”라고 표시하면 같은 트럭으로 더 많이 나를 수 있다. 일부 GPU도 memory의 반복되거나 단순한 bit pattern을 내부에서 압축해 옮긴다. programmer가 `zip`을 호출하지 않아도 hardware가 알아서 쓰는 작은 포장 기술이다.

여기서 트럭은 DRAM과 L2 cache 사이의 data path, 짐은 cache line, 접힌 부피는 실제 전송·저장해야 하는 bit 수에 대응한다. 예를 들어 NVIDIA A100의 **Compute Data Compression**은 압축하기 좋은 data pattern을 L2에서 다뤄, 같은 물리 bandwidth로 더 많은 유효 data를 이동하고 L2의 실효 용량도 키울 수 있다. 연산 장치를 더 빠르게 만든 것이 아니라, memory traffic이 차지하는 공간을 줄여 병목을 완화하는 셈이다.

흥미로운 점은 성능이 값의 내용에도 영향을 받을 수 있다는 것이다. 같은 크기의 array와 같은 kernel이라도 data가 잘 압축되는 pattern인지에 따라 관측 bandwidth가 달라질 여지가 있다. 그래서 일부 architecture 문서는 이 기능의 효과를 “최대” 수치로 표현한다. 모든 값이 잘 접히는 것은 아니며, 압축 판정과 metadata에도 구현 비용이 있다.

물론 CPU의 파일 압축처럼 memory 전체를 긴 stream으로 바꾸는 비유는 정확하지 않다. GPU는 작은 block 단위로 빠르게 압축·해제하면서도 임의 접근을 유지해야 하고, 구체적인 pattern과 방식은 architecture마다 다르다. 핵심은 **memory bandwidth가 선의 폭만이 아니라, 그 선 위로 data를 얼마나 작게 실어 보내느냐에도 달려 있다**는 점이다.

Source note: [NVIDIA의 Ampere architecture 소개](https://developer.nvidia.com/blog/nvidia-ampere-architecture-in-depth/)는 A100의 Compute Data Compression이 compressible data pattern을 대상으로 L2에서 동작하며, DRAM/L2 bandwidth와 유효 L2 capacity를 높일 수 있다고 설명한다. 제시된 향상 폭은 최대치이며 실제 효과는 data pattern과 workload에 따라 달라진다.
