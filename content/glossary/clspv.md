---
title: "clspv"
date: 2026-04-13
slug: "clspv"
type: "glossary"
term: "clspv"
tags: ["clspv", "opencl", "spirv", "compiler"]
related: ["SPIR-V", "ANGLE", "pipeline-layout", "descriptor-set"]
---

**OpenCL C를 Vulkan용 [[SPIR-V]]로 변환**하는 오픈소스 컴파일러.

## 상세 설명

OpenCL C는 원래 Vulkan과 다른 메모리 모델/포인터 규칙을 사용한다. clspv는 이 차이를 메꿔주는 트랜슬레이터다. Google이 개발하며 [[ANGLE]] 프로젝트에서 사용한다.

```
OpenCL C (.cl)
    ↓ clspv
SPIR-V (.spv)  ← Vulkan 드라이버가 이해하는 형태
```

### 주요 변환 작업

1. **주소 공간 정규화**: OpenCL의 `__global`, `__local`, `__private` → Vulkan의 storage class
2. **커널 인자 매핑**: OpenCL 커널 인자 → Vulkan descriptor set binding
3. **포인터 제한**: Vulkan은 generic pointer를 지원하지 않음 → 제거/변환

### 인자 매핑 예시

```c
// OpenCL C
__kernel void add(__global float* a, __global float* b, __global float* c) { ... }

// clspv 변환 후 SPIR-V에서:
// set=0, binding=0 → a
// set=0, binding=1 → b
// set=0, binding=2 → c
```

이 매핑 정보가 [[descriptor-set]]과 [[pipeline-layout]]을 구성하는 근거가 된다.

## 위치

- GitHub: google/clspv
- ANGLE 내에서는 `third_party/clspv/`로 포함
