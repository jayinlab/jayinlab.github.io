---
title: "CL/VK/ANGLE/PM4 분류체계"
date: 2026-04-15
slug: "cl-vk-angle-pm4-taxonomy"
draft: false
---

학습 노트를 일관되게 분류하기 위한 공통 체계.

## 축 정의
- **CL**: OpenCL 실행 모델/커널/메모리/NDRange
- **VK**: Vulkan compute 객체/동기화/디스크립터/파이프라인
- **ANGLE**: OpenCL-on-Vulkan 경로 추적, 런타임 구현 관점
- **SPV**: SPIR-V/clspv/리플렉션/인터페이스
- **PM4**: 드라이버 백엔드 커맨드 스트림/패킷 관점
- **PERF**: 성능 모델(occupancy, roofline, divergence, bandwidth)

## 표기 규칙 (각 포스트에 1회 이상 표기)
- 직접 관련: `직접`
- 간접 관련: `간접`
- 비중 낮음/없음: `참고`

예시:
- CL: 직접
- VK: 간접
- ANGLE: 참고
- SPV: 간접
- PM4: 참고
- PERF: 직접

## 운영 규칙
- 새 note 작성 시 본문 상단에 "분류체계" 섹션 추가
- tags에도 가능한 축을 반영 (`opencl`, `vulkan`, `spirv`, `pm4`, `performance`, `angle`)
- 오답노트/wrong-note도 최소 CL/VK/SPV/PM4 중 2개 이상 축으로 라벨링
