---
title: "GPU 메모리 계층 전체 지도 — Register에서 System RAM까지"
date: 2026-04-13
slug: "gpu-memory-hierarchy"
draft: false
type: "note"
series: "opencl-deep-dive"
tags: ["gpu", "memory", "opencl", "vulkan", "performance", "animation"]
difficulty: "intermediate"
animation: true
layer: "HW"
---

GPU가 빠른 이유의 절반은 **어디에 데이터를 두느냐**에 달려 있다.

같은 계산이라도 데이터가 레지스터에 있으면 1 cycle, VRAM에 있으면 400~800 cycle이 걸린다. 800배 차이다. 이 계층 구조를 모르면 "왜 내 커널이 느린지"를 이해할 수 없다.

---

## 전체 계층 한눈에 보기

```
빠름
 │  ⚡ Register / Private Memory  — ~1 cycle      per work-item
 │  🔶 LDS / Local Memory         — ~2–4 cycles   per work-group
 │  🟦 L1 Cache                   — ~20–40 cycles  per CU
 │  🟨 L2 Cache                   — ~100–200 cycles 칩 전체
 │  🟥 VRAM (Global Memory)       — ~400–800 cycles 전체 GPU
 │  💾 System Memory (RAM)        — ~2000+ cycles  PCIe 경유
느림
```

---

## Animation

3가지 시나리오를 직접 탐색해보세요:
- **Cache Hit**: L1에서 바로 찾았을 때
- **Cache Miss**: VRAM까지 내려갈 때 (cold miss)
- **대역폭 비교**: 계층별 bandwidth가 얼마나 다른지

{{< gpu_memory_anim >}}

---

## 각 계층 상세

### ⚡ Register / Private Memory — ~1 cycle

work-item 하나만 접근할 수 있는 **전용 레지스터 파일**이다. 커널 코드의 지역 변수, 루프 카운터, 중간 계산 결과가 여기 있다.

```c
__kernel void example(__global float* in, __global float* out) {
    float x = in[get_global_id(0)];  // x는 레지스터에 저장됨
    float y = x * x + 2.0f;         // 중간 계산도 레지스터
    out[get_global_id(0)] = y;
}
```

- AMD RDNA 기준 wavefront(64 lanes)당 ~256 KB 레지스터 파일
- 레지스터를 많이 쓸수록 동시에 실행할 수 있는 wavefront 수가 줄어든다 → [[gpu-occupancy]] 참고

---

### 🔶 LDS / Local Memory — ~2–4 cycles

같은 [[work-group]] 안의 work-item들이 **명시적으로 올리고 공유하는 고속 메모리**. 하드웨어의 Shared Memory / LDS(Local Data Share).

```c
__local float tile[64];
tile[get_local_id(0)] = in[get_global_id(0)];
barrier(CLK_LOCAL_MEM_FENCE);
float neighbor = tile[(get_local_id(0) + 1) % 64];
```

- global memory를 반복 접근하는 패턴 → LDS로 한번만 올리고 반복 활용 (**tiling/blocking**)
- [[barrier]]로 동기화 후에만 안전하게 읽을 수 있다
- 크기 제한: 보통 32~64 KB per CU. 이 한도를 넘으면 실행 자체가 안 된다

---

### 🟦 L1 Cache — ~20–40 cycles

하드웨어가 **자동으로 관리**하는 캐시. 개발자가 명시적으로 제어하지 않는다. 최근에 접근한 global memory 데이터가 여기 남는다.

- per Compute Unit, 16~32 KB
- **spatial locality** (인접 주소를 연속으로 접근)와 **temporal locality** (같은 주소를 반복 접근)이 있으면 자동으로 hit

```c
// 좋은 예 — 연속 주소 접근 (coalesced access)
float x = in[get_global_id(0)];  // work-item 0,1,2,3...이 in[0],in[1],in[2]... 순서로

// 나쁜 예 — stride 접근 (cache miss 유발)
float x = in[get_global_id(0) * 64];  // work-item들이 띄엄띄엄 접근
```

---

### 🟨 L2 Cache — ~100–200 cycles

**칩 전체의 CU가 공유**하는 2차 캐시. L1에서 miss가 나면 여기를 본다.

- 1~4 MB (GPU 세대마다 다름)
- L1 miss → L2 hit이면 그래도 VRAM보다는 훨씬 빠름
- 칩 전체 합산 bandwidth는 수 TB/s에 달하지만 CU 하나에서 보면 경쟁이 있음

---

### 🟥 Global Memory (VRAM) — ~400–800 cycles

`__global` 포인터로 접근하는 **GPU의 주 메모리**. HBM(AMD MI 시리즈) 또는 GDDR6(소비자 GPU).

- OpenCL의 `clCreateBuffer`로 만든 버퍼가 여기 있다
- VRAM bandwidth: ~500 GB/s (GDDR6) ~ 5 TB/s (HBM3)
- **memory-bound 커널**은 여기서 막힌다 → [[gpu-occupancy]] + Roofline 모델 참고

**coalesced access가 왜 중요한가:**

```
같은 wavefront의 64 work-item이 연속 주소 접근 →
  메모리 컨트롤러가 한 번의 burst 트랜잭션으로 처리
  → 실효 bandwidth 최대화

64 work-item이 뒤죽박죽 주소 접근 →
  최대 64번의 개별 트랜잭션
  → bandwidth 대부분 낭비
```

---

### 💾 System Memory (RAM) — ~2000+ cycles

CPU 메모리. GPU가 PCIe를 통해 접근한다.

- PCIe 5.0 x16 bandwidth: ~64 GB/s (VRAM의 수십 분의 1)
- unified memory(AMD APU, Apple M 시리즈) 환경에서는 다를 수 있음
- **커널 실행 전에 `clEnqueueCopyBuffer` / `clEnqueueWriteBuffer`로 VRAM에 미리 올려두는 이유**가 바로 이것

---

## 핵심 정리

| 계층 | 접근자 | latency | bandwidth | OpenCL 키워드 |
|------|--------|---------|-----------|--------------|
| Register | work-item 전용 | ~1 cy | 압도적 | 지역 변수 |
| LDS | work-group 공유 | ~2–4 cy | ~10 TB/s | `__local` |
| L1 Cache | CU 자동관리 | ~20–40 cy | 수백 GB/s | (없음) |
| L2 Cache | 칩 자동관리 | ~100–200 cy | 수 TB/s 합산 | (없음) |
| VRAM | 전체 GPU | ~400–800 cy | 0.5–5 TB/s | `__global` |
| System RAM | PCIe 경유 | ~2000+ cy | ~64 GB/s | (없음) |

---

## 성능 최적화 원칙

1. **계산에 쓸 데이터는 LDS로 올리고 반복 접근** (tiling)
2. **global memory 접근은 coalesced하게** (연속 주소, 정렬된 stride)
3. **커널 실행 전 VRAM에 데이터 미리 올리기** (`clEnqueueCopyBuffer`)
4. **레지스터 사용량 제어** → occupancy에 직접 영향

---

## 관련 글

- [Wavefront 스케줄링 & Latency Hiding](/wavefront-scheduling-latency-hiding/) — 메모리 latency를 hiding하는 방법
- [Occupancy — CU 슬롯 얼마나 채웠나](/gpu-occupancy/) — 레지스터·LDS가 occupancy에 미치는 영향
- [PM4 제출 흐름](/pm4-submit-flow-animation/) — 데이터가 GPU에 제출되는 과정

## 관련 용어

[[local-memory]], [[work-group]], [[barrier]], [[work-item]], [[wavefront]], [[NDRange]]
