---
title: "local memory"
date: 2026-04-13
slug: "local-memory"
type: "glossary"
term: "local memory"
tags: ["opencl", "memory", "gpu"]
related: ["work-group", "work-item", "barrier"]
---

**같은 [[work-group]] 안의 work-item들이 공유하는 고속 메모리**. GPU 하드웨어의 Shared Memory / LDS(Local Data Store)에 매핑된다.

## 상세 설명

GPU 메모리 계층:

```
global memory   ← 전체 device 접근 가능, 느림 (수백 ns)
  └── local memory  ← work-group 전용, 빠름 (수 ns)
        └── private memory ← work-item 전용 (레지스터)
```

OpenCL에서는 `__local` 한정자로 선언한다:

```c
__kernel void example(__global float* in, __global float* out) {
    __local float tile[64];      // work-group이 공유하는 64개 float
    int lid = get_local_id(0);

    tile[lid] = in[get_global_id(0)];   // global → local 복사
    barrier(CLK_LOCAL_MEM_FENCE);        // 모두 복사 완료 대기
    out[get_global_id(0)] = tile[lid];   // local에서 읽기
}
```

### 크기 제한

- 하드웨어마다 다르지만, 일반적으로 **32KB ~ 64KB per Compute Unit**
- work-group 크기 × 필요 local 크기 ≤ 하드웨어 한도

### 성능 포인트

global memory를 여러 번 반복 접근하는 패턴이라면, 한 번 local memory에 올린 뒤 접근하면 훨씬 빠르다. 이를 **tiling** 또는 **blocking** 기법이라 한다.

## 비유

팀 공동 작업대. global memory는 창고(멀고 느림), local memory는 팀 책상(가깝고 빠름). 창고에서 자재를 한 번에 가져와 책상에 놓고 작업하면 효율이 올라간다.
