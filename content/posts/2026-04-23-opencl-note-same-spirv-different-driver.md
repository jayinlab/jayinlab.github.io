---
title: "같은 SPIR-V인데 결과가 다른 이유 — Driver Lowering 관점"
date: 2026-04-23
slug: "opencl-note-same-spirv-different-driver"
draft: false
type: "note"
series: "opencl-deep-dive"
tags: ["opencl", "spir-v", "driver", "performance", "vulkan"]
difficulty: "intermediate"
---

같은 OpenCL C에서 만든 SPIR-V를 써도, GPU 벤더나 드라이버 버전에 따라 실행 성능과 ISA 모양이 달라질 수 있다.
핵심은 **SPIR-V가 최종 기계코드가 아니라 IR(중간표현)** 이라는 점이다.

---

## 한 줄 결론

SPIR-V는 "의도"를 담은 중간표현이고, 실제 하드웨어 친화적 코드로 바꾸는 책임은 각 벤더 드라이버 백엔드가 진다.

---

## 왜 달라지나?

### 1) Instruction Selection이 다르다
같은 SPIR-V 연산도 AMD/NVIDIA/Intel 드라이버가 선택하는 실제 ISA 명령 조합은 다를 수 있다.

### 2) Register Allocation 전략이 다르다
레지스터 배치가 달라지면 occupancy와 스케줄링 여유가 달라진다.

### 3) Memory Access Lowering이 다르다
load/store 묶음, cache 이용, 주소 계산 방식이 달라져 메모리 병목 정도가 달라진다.

### 4) Driver Heuristic이 다르다
같은 코드라도 드라이버 내부 휴리스틱(언롤, 스케줄, 최적화 임계값)이 벤더/버전별로 다르다.

---

## 실무에서의 체크 포인트

- "SPIR-V만 같으면 성능도 같을 것"이라는 가정은 위험하다.
- 성능 비교는 **벤더별 프로파일링**으로 확인해야 한다.
- 최적화는 IR 단계 1회로 끝나지 않고, 드라이버 백엔드 특성까지 포함해 반복해야 한다.

간단 체크리스트:

- [ ] 벤더별로 동일 워크로드 측정
- [ ] occupancy / 메모리 대역폭 지표 비교
- [ ] 병목이 compute bound인지 memory bound인지 분리

---

## 관련 글

- [Roofline 모델 — FLOPs vs Bandwidth로 병목 읽기](/opencl-note-roofline-model/)
- [RGP/ROCm Profiler 첫걸음 — 측정 기준선 만들기](/opencl-note-rgp-rocm-profiler-first-pass/)
- [OpenCL C -> SPIR-V -> Vulkan 매핑 정리](/opencl-note-spirv-vulkan-mapping/)

## 관련 용어

[[SPIR-V]], [[wavefront]], [[command-buffer]]
