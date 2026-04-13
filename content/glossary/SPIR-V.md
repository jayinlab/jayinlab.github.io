---
title: "SPIR-V"
date: 2026-04-13
slug: "SPIR-V"
type: "glossary"
term: "SPIR-V"
tags: ["spirv", "opencl", "vulkan", "compiler"]
related: ["clspv", "ANGLE", "pipeline-layout"]
---

GPU 셰이더/커널을 위한 **중간 표현(Intermediate Representation) 바이너리 포맷**. 소스 코드가 아니다.

## 상세 설명

SPIR-V(Standard Portable Intermediate Representation - Vulkan)는 Khronos Group이 정의한 IR 포맷이다. 컴파일러가 GLSL, HLSL, OpenCL C 등 다양한 소스를 SPIR-V로 변환하면, 각 GPU 벤더 드라이버가 이를 자신의 하드웨어 기계어로 변환한다.

```
OpenCL C → [clspv] → SPIR-V → [AMD 드라이버] → GCN 기계어
OpenCL C → [clspv] → SPIR-V → [ARM 드라이버] → Bifrost 기계어
GLSL     → [glslc] → SPIR-V → [임의 드라이버] → 기계어
```

### 파일 형식

- 확장자: `.spv`
- 32bit 워드 시퀀스
- `spirv-dis`로 텍스트(어셈블리) 형태로 변환 가능

```
; SPIR-V 어셈블리 예시
OpEntryPoint GLCompute %main "main" %GlobalInvocationID
OpDecorate %InputBuf DescriptorSet 0
OpDecorate %InputBuf Binding 0
```

### 핵심 특성

- **포터블**: 소스가 아닌 IR이므로, 벤더 드라이버가 다르게 컴파일해도 됨
- **검증 가능**: `spirv-val`로 구조적 유효성 검사 가능
- **불변**: 같은 SPIR-V라도 최종 기계어는 드라이버마다 다를 수 있음

## 비유

PDF 파일. 어떤 프린터(드라이버)에서 출력해도 같은 문서를 표현하지만, 실제 잉크 분사 방식은 프린터마다 다르다.
