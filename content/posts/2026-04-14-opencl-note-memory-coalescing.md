---
title: "Memory Coalescing — global memory를 빠르게 쓰는 접근 패턴"
date: 2026-04-14
slug: "opencl-note-memory-coalescing"
draft: false
type: "note"
series: "opencl-deep-dive"
tags: ["opencl", "gpu", "memory", "performance"]
difficulty: "intermediate"
layer: "CL"
---

GPU에서 `__global` 메모리는 느리다.  
그 느린 메모리를 **최대한 빨리 쓰는 방법**이 coalescing이다.  
이 노트는 "왜 접근 패턴이 성능을 좌우하는가"를 이해하는 데 집중한다.

---

{{< coalescing_anim >}}

## 1. 왜 접근 패턴이 중요한가

GPU의 global memory (DRAM)는 **cache line 단위**로 데이터를 전송한다.  
일반적으로 한 번의 메모리 트랜잭션은 **32~128 bytes**를 가져온다.

wavefront(AMD 64 lanes) 안의 work-item들이 메모리에 접근할 때:

```
케이스 1 — coalesced (최적)
lane 0 → addr[0]
lane 1 → addr[1]
lane 2 → addr[2]
...
lane 63 → addr[63]
→ 연속된 주소 → 1~2 트랜잭션으로 처리
```

```
케이스 2 — non-coalesced (최악)
lane 0 → addr[0]
lane 1 → addr[64]
lane 2 → addr[128]
...
→ 흩어진 주소 → 64개의 별도 트랜잭션 필요
```

케이스 2는 케이스 1보다 **수십 배 느릴 수 있다.**

---

## 2. Coalescing 기본 규칙

> **같은 wavefront 안에서 lane N이 `base + N` 번지에 접근하면 coalesced.**

```c
// ✅ coalesced — 각 work-item이 자신의 인덱스에 접근
__kernel void good(__global float* a, __global float* b) {
    int i = get_global_id(0);
    b[i] = a[i] * 2.0f;
}
```

```c
// ❌ non-coalesced — stride가 있어 주소가 흩어짐
__kernel void bad(__global float* a, __global float* b) {
    int i = get_global_id(0);
    b[i * 64] = a[i * 64];  // 64칸씩 건너뜀
}
```

---

## 3. 2D 배열 접근의 함정

2D 배열을 처리할 때 전치 여부에 따라 성능이 크게 달라진다.

```
행렬 A (row-major 저장, 열 N개):
A[row][col] = A[row * N + col]
```

```c
// ✅ 각 work-item이 같은 row의 다른 col → 연속 주소
int col = get_global_id(0);
int row = get_global_id(1);
out[row * N + col] = in[row * N + col];
```

```c
// ❌ 전치 접근 — in[col * N + row] 는 row 방향 stride → non-coalesced
out[row * N + col] = in[col * N + row];
```

전치가 필요하면 `__local` 메모리를 버퍼로 쓰는 **tiled transpose** 패턴을 사용한다.

---

## 4. Coalescing과 __local memory의 관계

non-coalesced global 접근이 불가피할 때 자주 쓰는 패턴:

```c
// 1. global에서 __local으로 coalesced 로드
__local float tile[BLOCK];
tile[local_id] = global_data[global_id];  // coalesced
barrier(CLK_LOCAL_MEM_FENCE);

// 2. __local에서 원하는 순서대로 읽기 (지연 훨씬 작음)
float val = tile[some_other_index];
```

`__local` 메모리는 SRAM이라 latency가 수십 배 낮다.  
"non-coalesced global → __local → 자유 접근"이 핵심 최적화 패턴이다.

---

## 5. 확인 방법

실제로 coalescing 여부를 확인하는 가장 빠른 방법은 **profiler**를 보는 것이다.

| 지표 | 의미 |
|------|------|
| L2 cache hit rate 낮음 | 메모리 접근이 예측 불가 → coalescing 문제 의심 |
| Global memory bandwidth 이론치 대비 낮음 | 트랜잭션 낭비 발생 중 |
| Fetch 횟수 / 실제 요청 횟수 비율 높음 | 흩어진 접근으로 중복 트랜잭션 |

---

## 6. 빠른 판단 체크리스트

```
□ work-item i가 global_data[i]에 접근하는가?        → OK
□ work-item i가 global_data[i * stride]에 접근하는가?  → 위험
□ 2D 배열에서 col 방향으로 순회하는가?              → OK
□ 2D 배열에서 row 방향(전치 접근)으로 순회하는가?   → 위험
□ non-coalesced가 불가피한가?
    → __local 버퍼 패턴을 쓸 수 있는가?             → 검토
```

---

## 핵심 한 줄

> **같은 wavefront의 lane들이 연속된 주소에 동시에 접근하면 coalesced — 트랜잭션 1번으로 처리된다.**

---

## 관련 글

- [GPU 메모리 계층 전체 지도](/gpu-memory-hierarchy/) — global/local/register 계층 latency
- [local memory/barrier 실습](/opencl-note-local-barrier/) — __local 사용 패턴
- [Occupancy](/gpu-occupancy/) — 메모리 접근 패턴과 occupancy의 관계

## 관련 용어

[[work-item]], [[wavefront]], [[local-memory]], [[NDRange]]
