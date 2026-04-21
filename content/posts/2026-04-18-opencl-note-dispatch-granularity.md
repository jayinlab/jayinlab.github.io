---
title: "Dispatch Granularity: tiny dispatch가 느린 이유"
date: 2026-04-18
slug: "opencl-note-dispatch-granularity"
draft: false
type: "note"
series: "opencl-deep-dive"
tags: ["opencl", "vulkan", "dispatch", "performance"]
difficulty: "intermediate"
---

OpenCL에서 커널 자체 연산량이 아주 작을 때(= tiny dispatch), 전체 시간은 GPU 연산보다 **제출 경로 오버헤드**가 더 크게 보일 수 있다.

핵심은 다음 한 줄이다.

> command buffer 기록/준비 비용 + queue submit 동기화 비용 + 드라이버 스케줄링 비용이, 커널 실행 시간보다 커지면 tiny dispatch는 비효율적이다.

## 왜 이런 현상이 생기나

작은 커널을 매우 자주 던지면:

1. Host 쪽에서 descriptor/pipeline/bind/dispatch 준비 작업이 반복되고,
2. queue submit 시점마다 드라이버/커널 경계 비용이 생기며,
3. GPU는 짧은 작업을 자주 전환하느라 연속 실행 이점을 덜 얻는다.

즉, 이 경우 병목은 ALU가 아니라 **제출 단위(granularity)** 에 있다.

## 실전 체크포인트

- 같은 총 작업량이라면 dispatch 횟수를 줄이고 1회당 work를 키워본다.
- 재사용 가능한 command buffer/descriptor set은 최대한 재활용한다.
- 측정은 kernel time만 보지 말고 host submit time을 분리해서 본다.

## 관련 글

- [심화 로드맵 — 학습 단계별 산출물과 순서](/opencl-deep-dive-roadmap/)
- [OpenCL/Vulkan/PM4 Daily Facts (누적 위키)](/wiki/opencl-daily-facts/)

## 관련 용어

- [[command-buffer]], [[command-queue]], [[descriptor-set]], [[wavefront]]
