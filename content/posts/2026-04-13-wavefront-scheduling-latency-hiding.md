---
title: "Wavefront 스케줄링 & Latency Hiding — GPU가 메모리를 기다리지 않는 이유"
date: 2026-04-13
slug: "wavefront-scheduling-latency-hiding"
draft: false
type: "note"
series: "opencl-deep-dive"
tags: ["gpu", "wavefront", "execution", "performance", "animation", "amd"]
difficulty: "intermediate"
---

VRAM 접근은 400~800 cycle이 걸린다. CPU였다면 그 시간 동안 그냥 기다린다. GPU는 다르다. 기다리는 동안 **다른 wavefront를 실행한다**. 이것이 latency hiding이고, GPU가 메모리 latency에도 빠른 이유다.

---

## 핵심 아이디어

```
CPU: 메모리 요청 → [기다림 400 cycles] → 재개
GPU: 메모리 요청 → [다른 wavefront 실행] → 데이터 도착 → 재개
```

GPU는 하나의 Compute Unit(CU) 안에 **여러 wavefront를 동시에 올려두고**, 하나가 stall되면 즉시 다른 것으로 교체한다. 교체 비용은 **0 cycles**다 — 각 wavefront는 항상 자신의 레지스터를 갖고 있기 때문이다.

---

## Animation

두 시나리오를 비교해보세요:
- **시나리오 1**: wavefront 1개 → VRAM 대기 중 CU 유휴
- **시나리오 2**: wavefront 4개 → latency hiding으로 CU 100% 활용

{{< wavefront_sched_anim >}}

---

## 상세 설명

### Wavefront란?

[[wavefront]]는 AMD GPU에서 **같은 명령을 동시에 실행하는 64개 work-item의 묶음**이다. CU의 SIMD 유닛이 64 lanes를 동시에 처리한다.

```
work-group (예: 256 work-item)
  └── wavefront #0: work-item 0–63
  └── wavefront #1: work-item 64–127
  └── wavefront #2: work-item 128–191
  └── wavefront #3: work-item 192–255
```

### Issue Unit의 역할

CU 내부의 **Issue Unit**은 매 cycle마다 "어느 wavefront를 실행할지"를 결정한다. 우선순위는:
1. 준비된 wavefront 중 하나를 선택
2. 선택된 wavefront의 다음 명령을 SIMD 유닛에 발행(issue)
3. 해당 wavefront가 stall(메모리 대기 등)되면 즉시 다른 것으로 교체

### 왜 교체 비용이 0인가?

CPU의 context switch는 수백 cycle이 걸린다. 레지스터 상태를 메모리에 저장/복원해야 하기 때문이다.

GPU wavefront는 다르다. **각 wavefront는 CU 레지스터 파일에 자신의 레지스터를 항상 유지**한다. "저장"이 필요 없다 — 그냥 다른 wavefront의 레지스터 뱅크를 읽으면 된다.

```
레지스터 파일 구조 (개념):
  [WF#0의 레지스터 64×32 = 2048 레지스터]
  [WF#1의 레지스터 64×32 = 2048 레지스터]
  [WF#2의 레지스터 64×32 = 2048 레지스터]
  [WF#3의 레지스터 64×32 = 2048 레지스터]
  ...
```

### Occupancy와의 관계

"얼마나 많은 wavefront를 CU에 올릴 수 있는가" = [[gpu-occupancy]].

wavefront를 많이 올릴수록 latency hiding 능력이 올라간다. 하지만 레지스터와 LDS 사용량이 크면 올릴 수 있는 wavefront 수가 줄어든다.

```
레지스터를 64개 쓰는 커널:
  레지스터 파일 256KB / (64 lanes × 64 regs × 4 bytes) = 최대 16 wavefronts

레지스터를 128개 쓰는 커널:
  레지스터 파일 256KB / (64 lanes × 128 regs × 4 bytes) = 최대 8 wavefronts
  → latency hiding 능력 절반
```

---

## 핵심 정리

| | wavefront 1개 | wavefront 4개 |
|--|--------------|--------------|
| 메모리 latency 대기 중 CU | 유휴(낭비) | 다른 wavefront 실행 |
| 전환 비용 | — | 0 cycles |
| CU 실행 효율 | ~33% | ~100% |

---

## 실전 힌트

- **work-group 크기를 wavefront 크기의 배수로**
  - AMD: 64의 배수 (64, 128, 256...)
  - 그래야 CU에 정수 개의 wavefront가 올라감

- **레지스터/LDS 사용을 줄이면 occupancy 올라가고 latency hiding이 좋아진다**
  - 단, 너무 줄이려다 알고리즘이 복잡해지면 역효과

- **memory-bound 커널은 latency hiding보다 bandwidth가 병목**
  - 이 경우 coalesced access와 L1/L2 hit율을 먼저 확인

---

## 관련 글

- [GPU 메모리 계층 전체 지도](/gpu-memory-hierarchy/) — latency 숫자의 출처
- [Occupancy — CU 슬롯 얼마나 채웠나](/gpu-occupancy/) — 얼마나 많은 wavefront를 올릴 수 있는가
- [PM4 제출 흐름](/pm4-submit-flow-animation/) — wavefront가 어떻게 dispatch되는가

## 관련 용어

[[wavefront]], [[work-group]], [[NDRange]], [[local-memory]], [[gpu-occupancy]]
