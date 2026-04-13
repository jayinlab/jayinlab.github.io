---
title: "barrier"
date: 2026-04-13
slug: "barrier"
type: "glossary"
term: "barrier"
tags: ["opencl", "execution", "memory", "sync"]
related: ["work-group", "work-item", "local-memory"]
---

[[work-group]] 안의 모든 [[work-item]]이 **이 지점에 도달할 때까지 기다리게** 하는 동기화 명령.

## 상세 설명

GPU는 work-item을 병렬로 실행하기 때문에 실행 순서가 보장되지 않는다. barrier는 "여기까지 모두 끝난 다음에 다음 단계로 가라"는 집합 신호다.

```c
// 예시: local memory에 데이터를 쓰고, 다른 work-item이 쓴 데이터를 읽기 전에 barrier
__local float shared[64];
shared[get_local_id(0)] = input[get_global_id(0)];

barrier(CLK_LOCAL_MEM_FENCE);  // ← 여기서 전체 대기

float neighbor = shared[(get_local_id(0) + 1) % 64];  // 안전하게 읽기
```

### 범위

| 플래그 | 대상 |
|--------|------|
| `CLK_LOCAL_MEM_FENCE` | [[local-memory]] 접근 동기화 |
| `CLK_GLOBAL_MEM_FENCE` | global memory 접근 동기화 |

### 중요한 제약

- **같은 work-group 안에서만** 유효하다
- 서로 다른 work-group 사이의 barrier는 OpenCL에 없다
- work-group 간 동기화는 커널 종료 후 재실행, 또는 별도 이벤트로만 가능

## 비유

팀 회의에서 "모두 준비됐으면 다음 안건으로 넘어가자." 한 명이라도 준비가 안 됐으면 전체가 기다린다. 단, 다른 팀(다른 work-group)은 기다리지 않는다.
