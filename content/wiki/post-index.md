---
title: "포스트 인덱스 — 모든 글 한눈에"
date: 2026-04-13
slug: "post-index"
draft: false
type: "wiki"
tags: ["index", "roadmap"]
---

이 페이지는 블로그의 모든 포스트가 무엇을 다루는지 한눈에 볼 수 있는 색인이다.
학습 로드맵은 → [학습 로드맵](/wiki/learning-roadmap/) 참고.

---

## OpenCL · Vulkan · PM4 · GPU 학습 시리즈

### 기초 — beginner

| 글 | 핵심 한 줄 | 시각화 |
|----|-----------|--------|
| [실습 키트 운용법](/opencl-note-study-kit/) | `~/opencl_study` 폴더와 실습 흐름 | — |
| [객체 라이프사이클](/opencl-note-lifecycle/) | API 호출 순서와 실제 내부 작업 시점 분리 | mermaid |
| [Build/캐시 경계](/opencl-note-build-cache/) | clCreateProgram vs clBuildProgram, 캐시 전략 | mermaid |
| [SPIR-V 최소 읽기법](/opencl-note-spirv-reading/) | compile chain vs submit chain, spirv-dis 5 포인트 | mermaid |
| [clspv 실전](/opencl-note-clspv-practice/) | vector_add → SPIR-V 대응표 실습 | — |
| [SPIR-V↔Vulkan 매핑](/opencl-note-spirv-vulkan-mapping/) | OpDecorate → descriptor set 1:1 연결 | mermaid |
| [Vulkan 용어 직관](/opencl-note-vulkan-terms-intuition/) | descriptor/pipeline/layout — 주방 비유 | animation |
| [왜 이 이름인가](/opencl-note-vulkan-names-why/) | 용어의 역사적 배경과 설계 철학 | — |

### 중급 — intermediate

| 글 | 핵심 한 줄 | 시각화 |
|----|-----------|--------|
| [ANGLE 분리 지도](/opencl-note-angle-map/) | compile chain vs submit chain 개념 분리 | animation |
| [ANGLE 추적 1차](/opencl-note-angle-phase1/) | Entry → Build/Enqueue 코드 경로 분리 | — |
| [ANGLE 추적 2차](/opencl-note-angle-phase2/) | SPIR-V → Vulkan Pipeline/Layout 연결점 | mermaid |
| [first-run 지연 줄이기](/opencl-note-first-run-latency/) | pipeline cache, warm-up, 측정 체크리스트 | — |
| [AMD PM4 개요](/opencl-note-pm4-overview/) | Type-3 패킷 구조, Dispatch 패밀리 opcode | — |
| [심화 로드맵](/opencl-deep-dive-roadmap/) | 학습 단계별 산출물과 순서 | mermaid |
| [종합 다이어그램](/opencl-note-final-map/) | 전체 경로 한 장 정리 + 체크리스트 | mermaid |

### 심화 — intermediate~advanced

| 글 | 핵심 한 줄 | 시각화 |
|----|-----------|--------|
| [ANGLE 심화 킥오프](/opencl-note-angle-kickoff/) | compile/submit 체인 표 산출물 정의 | — |
| [Layout 호환성](/opencl-note-layout-compat/) | 호환/비호환 제약의 성능 이점 | animation |
| [ANGLE 체인 표 초안](/opencl-note-angle-chain-table/) | compile/submit 함수 체인 표 | animation |
| [local memory/barrier 실습](/opencl-note-local-barrier/) | __local + barrier 패턴 → SPIR-V 관찰 | mermaid |
| [Vulkan 객체 근거 표](/opencl-note-vulkan-evidence/) | 4개 Vulkan API의 파일/라인 근거 수집 | — |

### 개념 강화 — intermediate

| 글 | 핵심 한 줄 | 시각화 |
|----|-----------|--------|
| [Vulkan 10줄 타임라인](/opencl-note-vulkan-timeline/) | 10단계 실행 시퀀스 한눈에 | mermaid |
| [고정 슬롯이 빠른 이유](/opencl-note-fixed-slots-fast/) | 슬롯 기반 계약의 성능 원리 | — |
| [Arg0→슬롯 미니 예제](/opencl-note-arg0-to-slot/) | saxpy 커널 인자 → 슬롯 매핑 구체화 | — |
| [물류센터 비유 치트시트](/opencl-note-logistics-cheatsheet/) | OpenCL→clspv→Vulkan→PM4 전체 비유 | — |
| [초등학생 큰 그림](/opencl-note-big-picture-kids/) | GPU를 배송센터로 보는 9단계 비유 | — |

### GPU 하드웨어 심층

| 글 | 핵심 한 줄 | 시각화 |
|----|-----------|--------|
| [PM4 제출 흐름](/pm4-submit-flow-animation/) | vkQueueSubmit → PM4 → ring → GPU 7단계 | animation |
| [GPU 메모리 계층](/gpu-memory-hierarchy/) | Register~System RAM 6계층, latency/bandwidth | animation |
| [Wavefront 스케줄링](/wavefront-scheduling-latency-hiding/) | latency hiding, 1WF vs 4WF 비교 | animation |
| [vkCmdPipelineBarrier](/vulkan-pipeline-barrier/) | hazard vs 올바른 순서 2 시나리오 | animation |
| [Occupancy](/gpu-occupancy/) | register/LDS 제한 → WF 슬롯 수 | animation |
| [PM4 Indirect Buffer](/pm4-indirect-buffer/) | Main Ring → IB 점프 → 실행 → 복귀 | animation |
| [clFinish 내부](/clfinish-internals/) | Fence/Semaphore/Event, IT_EVENT_WRITE | mermaid |

---

## 오답 노트

| 글 | 정정 내용 |
|----|-----------|
| [오답노트 #01](/opencl-wrong-note-barrier-scope/) | OpDecorate/Binding 매핑 오류, PM4 계층 오류 |
| [오답노트 #02](/opencl-wrong-note-partial/) | 8개 항목 부분/완전 오답 정정 |

## 복습 노트

| 글 | 내용 |
|----|------|
| [퀴즈 문제 창고 #01](/opencl-quiz-bank-01/) | 10개 핵심 개념 문제 + 펼치기 정답 |

---

## 용어 사전

→ [Glossary](/glossary/) — work-item, wavefront, pm4-packet, descriptor-set 등 15개 용어
