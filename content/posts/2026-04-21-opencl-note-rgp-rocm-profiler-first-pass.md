---
title: "GPU Profiling 첫 실전 분해: RGP와 ROCm에서 어디를 먼저 볼까"
date: 2026-04-21
slug: "opencl-note-rgp-rocm-profiler-first-pass"
draft: false
type: "note"
series: "opencl-performance-basics"
tags: ["opencl", "vulkan", "pm4", "performance", "roadmap"]
difficulty: "intermediate"
---

로드맵에서 비어 있던 "프로파일링 도구" 주제를 tiny dispatch 관점으로 먼저 정리한다.
핵심은 도구를 많이 아는 게 아니라, **CPU submit 병목인지 GPU 실행 병목인지 1차 분류**를 빠르게 끝내는 것이다.

## 1차 진단 순서 (실무용)

1. **ROCm/호스트 타임라인 먼저 확인**
   - API 호출 간격, submit 간격, 동기화(`clFinish`/대기) 구간을 본다.
   - 여기서 빈 구간이 크면 CPU/드라이버 경로가 병목일 가능성이 높다.

2. **RGP에서 GPU Queue/Dispatch 밀도 확인**
   - Queue에 dispatch가 성기게 들어오면 submit cadence 문제가 의심된다.
   - dispatch 자체가 길면 커널 내부(메모리 접근/occupancy) 최적화가 우선이다.

3. **둘을 같은 구간으로 맞춰 해석**
   - "GPU 시간이 짧다"만으로는 결론을 내리지 않는다.
   - CPU에서 다음 일을 늦게 넣고 있으면 전체 wall-clock은 여전히 느리다.

## 최소 체크리스트

- 같은 커널을 100~1000회 반복해 **submit 간격 분포**를 먼저 본다.
- `clFinish`를 루프 밖으로 밀 수 있는지 확인한다.
- kernel time과 frame/loop total time을 반드시 같이 기록한다.

## 분류체계 (CL/VK/ANGLE/SPV/PM4/PERF)

- **CL:** 직접 — OpenCL API 호출/동기화 패턴 분석이 출발점
- **VK:** 간접 — RGP 해석은 Vulkan queue/submit 모델 이해가 필요
- **ANGLE:** 참고 — abstraction 계층의 submit 지연 해석에 개념적으로 유사
- **SPV:** 참고 — 이번 주제의 핵심 병목은 IR보다 런타임 타임라인
- **PM4:** 간접 — 최종 dispatch packet 흐름을 시간축으로 역추적할 때 중요
- **PERF:** 직접 — CPU/GPU 병목 분리를 가장 먼저 수행하는 성능 실무 항목

---

## 관련 글

- [OpenCL 노트 — GPU Profiling 기초]({{< relref "2026-04-19-opencl-note-gpu-profiling-basics.md" >}})
- [Tiny Dispatch에서 진짜 병목: GPU 연산보다 Submit 경로]({{< relref "2026-04-20-opencl-note-small-dispatch-submit-overhead.md" >}})

## 관련 용어

- [[command-queue]], [[command-buffer]], [[pm4-packet]], [[wavefront]]
