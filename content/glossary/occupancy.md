---
title: "occupancy"
date: 2026-04-20
slug: "occupancy"
type: "glossary"
term: "occupancy"
tags: ["gpu", "performance", "wavefront", "opencl", "vulkan"]
related: ["wavefront", "subgroup", "local-memory"]
---

Compute Unit(SM)에 동시에 상주 가능한 실행 파형(wave/warp) 비율.

## 상세 설명

occupancy는 단순히 "스레드 수"만으로 결정되지 않는다.
아래 자원 제약이 동시에 걸린다.

- 레지스터 사용량
- local memory(LDS/shared memory) 사용량
- 하드웨어 최대 wave 수 제한

## 왜 중요한가

- occupancy가 너무 낮으면 메모리 지연 숨김(latency hiding)이 약해진다.
- 하지만 occupancy를 무조건 최대로 만드는 것이 항상 최고 성능은 아니다.
  (메모리 병목/명령 병목과 균형 필요)
