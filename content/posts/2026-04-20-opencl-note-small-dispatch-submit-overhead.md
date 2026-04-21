---
title: "Tiny Dispatch에서 진짜 병목: GPU 연산보다 Submit 경로"
date: 2026-04-20
slug: "opencl-note-small-dispatch-submit-overhead"
draft: false
type: "note"
series: "opencl-performance-basics"
tags: ["opencl", "vulkan", "pm4", "performance", "daily-facts"]
difficulty: "intermediate"
---

Tiny dispatch(예: work-item 수가 매우 적은 커널)에서는 커널 내부 산술 연산보다,
Host API 호출 → driver validation/state 준비 → command buffer 기록/submit 경로의 고정비가 지연시간 대부분을 차지할 수 있다.

즉, 이 구간에서는 "커널 최적화"보다 "submit 횟수/재기록/동기화 패턴"을 줄이는 쪽이 체감 성능에 더 크게 작용한다.

## 실무 체크 포인트

- 같은 커널을 자주 호출한다면, 매번 새로 기록하지 말고 재사용 가능한 command buffer 전략을 우선 검토
- 불필요한 `clFinish`/강한 동기화를 줄여 queue가 비지 않게 유지
- 프로파일링에서 GPU kernel time과 CPU submit time을 분리해서 해석

## 관련 글

- [OpenCL 노트 — Tiny Dispatch에서 PM4 스케일로 성능 보기]({{< relref "2026-04-18-opencl-note-tiny-dispatch-pm4-scale.md" >}})
- [OpenCL 노트 — GPU Profiling 기초]({{< relref "2026-04-19-opencl-note-gpu-profiling-basics.md" >}})

## 관련 용어

- [[command-queue]], [[command-buffer]], [[pm4-packet]], [[barrier]]
