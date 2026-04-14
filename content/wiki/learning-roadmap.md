---
title: "학습 로드맵 — GPU 내부 구조 마스터 플랜"
date: 2026-04-13
slug: "learning-roadmap"
draft: false
type: "wiki"
tags: ["opencl", "vulkan", "pm4", "gpu", "roadmap"]
difficulty: "intermediate"
---

이 페이지는 공부해야 할 모든 주제를 빠뜨리지 않도록 추적하는 마스터 맵이다.
각 주제는 포스트로 연결되어 있으며, animation이 있는 항목은 🎬로 표시한다.

---

## 전체 학습 트리

```
GPU 전체 그림
├── A. 실행 모델
│   ├── work-item / work-group / NDRange              ✅ 기초 노트
│   ├── Wavefront 스케줄링 & Latency Hiding           🎬 포스트 있음
│   └── Occupancy — CU 슬롯 채우기                    🎬 포스트 있음
│
├── B. 메모리 계층
│   ├── GPU 메모리 계층 전체 지도                      🎬 포스트 있음
│   ├── Local memory / barrier                        ✅ 노트 #20
│   └── Memory bandwidth vs Compute (Roofline)        → 예정
│
├── C. 커맨드 제출 파이프라인
│   ├── PM4 제출 흐름 (vkQueueSubmit → GPU)           🎬 포스트 있음
│   ├── PM4 Indirect Buffer (IB)                     🎬 포스트 있음
│   └── PM4 EVENT_WRITE / barrier packet              → 예정
│
├── D. Vulkan 동기화
│   ├── vkCmdPipelineBarrier                          🎬 포스트 있음
│   ├── Fence / Semaphore / Event                     📄 포스트 있음
│   └── Render Pass / Subpass dependency              → 예정
│
├── E. 컴파일 체인
│   ├── OpenCL C → clspv → SPIR-V                    ✅ 노트 #2~4
│   ├── ANGLE compile vs submit chain                 ✅ 노트 #6~7
│   └── SPIR-V → 드라이버 → ISA                       → 예정
│
└── F. 성능 이해
    ├── Occupancy (위 A 참고)                         🎬 포스트 있음
    ├── Memory bandwidth vs Compute                   → 예정
    └── 프로파일링 기초                                → 예정
```

---

## 포스트 목록

### 🎬 Animation 포스트

| 제목 | 주제 | 난이도 |
|------|------|--------|
| [PM4 제출 흐름](/pm4-submit-flow-animation/) | C: 커맨드 제출 | intermediate |
| [GPU 메모리 계층 전체 지도](/gpu-memory-hierarchy/) | B: 메모리 | intermediate |
| [Wavefront 스케줄링 & Latency Hiding](/wavefront-scheduling-latency-hiding/) | A: 실행 모델 | intermediate |
| [vkCmdPipelineBarrier 깊이 파기](/vulkan-pipeline-barrier/) | D: Vulkan 동기화 | intermediate |
| [Occupancy — CU 슬롯 얼마나 채웠나](/gpu-occupancy/) | A/F: 실행/성능 | intermediate |
| [PM4 Indirect Buffer](/pm4-indirect-buffer/) | C: 커맨드 제출 | advanced |

### 📄 설명 포스트

| 제목 | 주제 | 난이도 |
|------|------|--------|
| [clFinish의 내부 구현 — Fence & Semaphore](/clfinish-internals/) | D: Vulkan 동기화 | intermediate |

---

## 추천 탐색 순서

처음 공부하는 경우 아래 순서로 읽으면 흐름이 자연스럽다.

```
1. PM4 제출 흐름 🎬          ← 전체 그림을 한번에 잡는 출발점
2. GPU 메모리 계층 전체 지도 🎬 ← 데이터가 어디에 있는지
3. Wavefront 스케줄링 🎬      ← GPU가 어떻게 빠른지
4. Occupancy 🎬               ← 내 코드가 GPU를 얼마나 쓰는지
5. vkCmdPipelineBarrier 🎬    ← 동기화를 제대로 이해
6. clFinish 내부 📄           ← CPU-GPU 대기의 실제 구현
7. PM4 Indirect Buffer 🎬     ← PM4 심화
```

---

## 용어 사전

핵심 용어는 [Glossary](/glossary/) 페이지에서 확인할 수 있다.
각 포스트 하단의 **관련 용어** 섹션에서 직접 이동 가능.
