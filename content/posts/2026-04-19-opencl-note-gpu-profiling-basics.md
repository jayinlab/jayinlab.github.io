---
title: "GPU 프로파일링 입문: kernel time 말고 무엇을 봐야 하나"
date: 2026-04-19
slug: "opencl-note-gpu-profiling-basics"
draft: false
type: "note"
series: "opencl-deep-dive"
tags: ["opencl", "vulkan", "profiling", "performance", "rgp", "rocm"]
difficulty: "intermediate"
---

성능 튜닝을 시작할 때 가장 흔한 실수는 **kernel 실행 시간만 보고 병목을 단정**하는 것이다.  
실제로는 아래 3축을 분리해서 봐야 원인을 정확히 찾을 수 있다.

1. Host 준비 시간 (record/bind/submit)
2. Queue 대기 시간 (스케줄링/동기화)
3. GPU 실제 실행 시간 (wave 실행 + memory stall)

즉, "느리다"는 한 문장 안에는 CPU 측 오버헤드와 GPU 측 오버헤드가 동시에 섞여 있다.

## 최소 측정 프레임

처음에는 복잡한 지표를 다 보지 말고 아래 4개부터 고정한다.

- **Dispatch Count**: 프레임/작업당 dispatch 횟수
- **Submit→Start 지연**: submit 이후 GPU 실제 시작까지의 간격
- **Kernel Duration**: 실제 커널 실행 시간
- **GPU Busy vs Idle 비율**: GPU가 놀고 있는지, 계속 일하는지

이 4개만 있어도 tiny dispatch 문제인지, memory 병목인지, 동기화 문제인지 1차 분류가 가능하다.

## 도구를 어떻게 나눠 쓸까

### RGP (Radeon GPU Profiler)

- command buffer/queue 단위 타임라인 확인에 강함
- "어느 submit에서 빈 구간이 생겼는지"를 찾기 좋음
- Vulkan 경로에서 barrier/파이프라인 구간을 시각적으로 추적하기 좋음

### ROCm 계열 프로파일러

- 커널/카운터 중심 분석에 강함
- 메모리 대역폭, cache/memory stall, occupancy 같은 수치 추적에 유리
- "왜 느린가"를 하드웨어 카운터로 좁히는 데 적합

실무에서는 보통 **RGP로 타임라인 병목 위치를 찾고, ROCm 계열로 원인 카운터를 확인**하는 식으로 조합한다.

## 초보자용 체크 순서 (실수 줄이기)

1. 동일 입력으로 10회 이상 반복 측정 (편차 확인)
2. dispatch 수를 절반으로 줄였을 때 성능이 오르면 submit 오버헤드 의심
3. 데이터 크기만 키웠을 때 성능이 급락하면 memory 경로 의심
4. barrier/동기화 지점을 줄였을 때 개선되면 sync 과사용 의심

한 번에 하나의 변수만 바꾸는 게 핵심이다.

## 기억 문장

> 프로파일링의 첫 단계는 "빠르게 만드는 것"이 아니라, 시간을 Host/Queue/GPU로 분해해 책임 구간을 확정하는 것이다.

## 분류체계 (CL/VK/ANGLE/SPV/PM4/PERF)

- CL: **간접** — OpenCL API 사용 패턴이 측정 결과에 영향
- VK: **직접** — submit/queue/barrier 타임라인 분석의 핵심 계층
- ANGLE: **간접** — 상위 호출이 Vulkan 제출 구조로 변환되는 경로
- SPV: **참고** — 코드 생성 품질에 영향은 있으나 이번 글의 중심은 아님
- PM4: **간접** — 최종 패킷 제출/스케줄링 결과가 타임라인에 반영
- PERF: **직접** — 병목 분해와 튜닝 의사결정의 중심

---

## 관련 글

- [Dispatch Granularity: tiny dispatch가 느린 이유](/opencl-note-dispatch-granularity/)
- [Roofline 모델 입문: 내 커널이 compute bound인지 memory bound인지 판단하는 법](/opencl-note-roofline-model/)
- [학습 로드맵 — GPU 내부 구조 마스터 플랜](/wiki/learning-roadmap/)

## 관련 용어

- [[command-buffer]], [[command-queue]], [[wavefront]], [[barrier]]
