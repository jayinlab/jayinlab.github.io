---
title: "Occupancy — CU 슬롯을 얼마나 채웠나"
date: 2026-04-13
slug: "gpu-occupancy"
draft: false
type: "note"
series: "opencl-deep-dive"
tags: ["gpu", "occupancy", "wavefront", "performance", "animation", "amd"]
difficulty: "intermediate"
animation: true
---

같은 커널이라도 레지스터 사용량을 줄이면 더 빠르게 실행될 수 있다. 왜일까?

**Occupancy** 때문이다. Occupancy는 "한 Compute Unit(CU)에 실제로 올라간 wavefront 수 / 이론적 최대 wavefront 수"다. 이 수치가 낮으면 latency hiding 능력이 떨어지고, CU가 메모리를 기다리며 유휴 상태가 된다.

---

## 세 가지 리소스 제한

한 CU에 올릴 수 있는 wavefront 수는 세 가지가 **동시에** 제한한다:

```
최대 wavefront 수 = MIN(
  레지스터 파일 크기 / (레지스터/WF × 64 lanes × 4B),
  LDS 크기 / (LDS/WG × WG당 WF 수),
  하드웨어 WF 한도  ← 보통 16~32
)
```

세 제약 중 **가장 작은 값**이 실제 occupancy를 결정한다.

---

## Animation

레지스터/LDS 사용량이 달라질 때 CU 슬롯이 어떻게 채워지는지 직접 확인하세요.

{{< occupancy_anim >}}

---

## 상세 설명

### 레지스터 파일 제한

AMD RDNA 기준 CU당 레지스터 파일 = ~256 KB.

```
커널이 레지스터 32개 사용:
  32 regs × 64 lanes × 4 bytes = 8 KB per wavefront
  256 KB ÷ 8 KB = 32 WF 가능 → 하드웨어 한도(16)에 걸림 → 16 WF

커널이 레지스터 128개 사용:
  128 regs × 64 lanes × 4 bytes = 32 KB per wavefront
  256 KB ÷ 32 KB = 8 WF 가능 → occupancy 8/16 = 50%
```

레지스터를 많이 쓸수록 wavefront 수가 줄어든다.

### LDS 제한

CU당 LDS = 64 KB (AMD RDNA 기준).

```
work-group당 LDS 32 KB 사용:
  64 KB ÷ 32 KB = 2 work-group만 CU에 올라감
  work-group = 64 work-item = 1 wavefront 라면 → 2 WF만 가능!
```

LDS를 많이 쓰는 커널(reduction, matrix tiling 등)은 이 한도에 잘 걸린다.

### Work-group 크기 제한

work-group이 너무 크면 그것만으로 CU 슬롯을 많이 차지할 수 있다.

```
work-group 크기 256 (= 4 wavefront):
  CU 최대 16 WF ÷ 4 WF/WG = 최대 4 work-group만 올라감
```

---

## Occupancy와 성능의 관계

Occupancy가 높다고 무조건 빠른 것은 아니다. 하지만 **메모리 접근이 많은 커널**(memory-bound)에서는 중요하다.

```
Occupancy 낮음 + memory latency 긴 커널:
  wavefront A가 VRAM 기다릴 때 교체할 WF가 없음 → CU 유휴
  → [[wavefront-scheduling-latency-hiding]] 참고

Occupancy 낮음 + compute-heavy 커널:
  영향 적음 — 메모리 기다리는 시간 자체가 짧기 때문
```

### 실전 가이드

| 상황 | 권장 |
|------|------|
| 메모리를 많이 읽는 커널 | occupancy 최대화 (레지스터/LDS 줄이기) |
| 복잡한 수학 연산 위주 | occupancy보다 ILP(명령 병렬성) 집중 |
| LDS tiling으로 성능 최적화 | LDS 증가 → occupancy 하락 trade-off 확인 |

---

## 확인 방법

AMD에서는 `rocprof` 또는 `Radeon GPU Profiler`로 occupancy를 측정할 수 있다.

```bash
# rocprof 예시
rocprof --stats --timestamp on ./my_opencl_app
```

출력에 `OCCUPANCY` 컬럼이 나온다.

---

## 관련 글

- [Wavefront 스케줄링 & Latency Hiding](/wavefront-scheduling-latency-hiding/) — occupancy가 낮으면 latency hiding이 어떻게 나빠지는가
- [GPU 메모리 계층 전체 지도](/gpu-memory-hierarchy/) — LDS, 레지스터, VRAM의 크기와 latency

## 관련 용어

[[wavefront]], [[local-memory]], [[work-group]], [[NDRange]]
