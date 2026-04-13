---
title: "ANGLE"
date: 2026-04-13
slug: "ANGLE"
type: "glossary"
term: "ANGLE"
tags: ["angle", "opencl", "vulkan", "compiler"]
related: ["clspv", "SPIR-V", "command-buffer", "descriptor-set"]
---

OpenCL/OpenGL ES API 호출을 **Vulkan(또는 Metal, D3D12)으로 번역**하는 Google의 호환성 레이어.

## 상세 설명

ANGLE(Almost Native Graphics Layer Engine)은 OpenGL ES나 OpenCL 코드를 수정 없이 Vulkan 위에서 실행할 수 있게 해준다. Chrome 브라우저의 WebGL 구현에 사용되며, Android에도 포함된다.

### OpenCL on Vulkan 경로

```
OpenCL C 커널
    ↓  clspv (ANGLE 내장)
SPIR-V
    ↓  VkShaderModule 생성
    ↓  VkPipeline 빌드
    ↓  vkCmdDispatch
Vulkan 드라이버 → GPU
```

### 두 가지 체인

ANGLE 내부에는 두 개의 분리된 코드 경로가 있다:

| 체인 | 역할 | 핵심 함수 |
|------|------|-----------|
| Compile chain | 커널 → SPIR-V → VkPipeline | `clCreateProgramWithSource` |
| Submit chain | 커널 실행 → Vulkan dispatch | `clEnqueueNDRangeKernel` |

## 왜 중요한가

Android 기기에서 OpenCL을 쓰는 많은 앱이 실제로는 ANGLE을 통해 Vulkan으로 실행된다. 따라서 "OpenCL 성능을 보는 것 = ANGLE + Vulkan 스택 전체를 보는 것"이 된다.
