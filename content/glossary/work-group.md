---
title: "work-group"
date: 2026-04-13
slug: "work-group"
type: "glossary"
term: "work-group"
tags: ["opencl", "execution", "memory"]
related: ["work-item", "NDRange", "barrier", "local-memory"]
---

[[work-item]]들의 **묶음 단위**. local memory와 barrier를 공유한다.

## 상세 설명

OpenCL에서 work-group은 같은 Compute Unit(CU) 위에서 실행되는 work-item들의 집합이다.

- work-group 내부의 work-item들은 `__local` 메모리([[local-memory]])를 공유한다
- `barrier(CLK_LOCAL_MEM_FENCE)`는 **같은 work-group 내에서만** 유효하다
- 서로 다른 work-group 사이의 실행 순서는 보장되지 않는다
- work-group 크기는 커널 실행 시 지정: `local_work_size`

## 비유

공장의 **한 팀(소규모 그룹)**. 같은 작업대([[local-memory]])를 공유하고, 팀장 신호([[barrier]])로 동기화한다. 다른 팀과는 직접 대화하지 않는다.
