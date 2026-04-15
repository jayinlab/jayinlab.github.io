---
title: "CL/VK/ANGLE/PM4 분류체계"
date: 2026-04-15
slug: "cl-vk-angle-pm4-taxonomy"
draft: true
---

<!-- AI 참고 전용 문서. 빌드에서 제외됨. 포스트로 노출하지 않음. -->

학습 노트를 일관되게 분류하기 위한 AI 참고 체계.

## layer 축 정의

각 포스트는 **front matter의 `layer:` 필드 하나**로 분류한다. 값은 아래 중 하나.

| 값 | 의미 |
|----|------|
| `CL` | OpenCL 실행 모델, 커널, 메모리, NDRange |
| `VK` | Vulkan compute 객체, 동기화, descriptor, pipeline |
| `ANGLE` | OpenCL-on-Vulkan 경로 추적, ANGLE 런타임 구현 관점 |
| `SPV` | SPIR-V / clspv / reflection / 인터페이스 |
| `PM4` | 드라이버 백엔드, command stream, PM4 패킷 |
| `COMP` | 여러 축에 걸쳐 있는 복합 주제 (예: arg→slot 매핑) |

## 운영 규칙

- `layer:` 값은 **1개만** 지정한다. 주요 관점 하나를 고른다.
- 본문에 별도 "분류체계" 섹션을 추가하지 않는다.
- tags에 관련 기술 영역을 반영한다 (`opencl`, `vulkan`, `spirv`, `pm4`, `angle` 등).
- wiki 파일에는 `layer:` 및 `difficulty:` 필드를 쓰지 않는다.
