---
title: "SPIR-V는 왜 중간 언어로 남았을까"
date: 2026-07-09
slug: "gpu-fun-fact-why-spirv-exists"
draft: false
type: "note"
series: "gpu-fun-facts"
tags: ["gpu", "spir-v", "vulkan", "opencl", "compiler"]
difficulty: "beginner"
---

SPIR-V를 처음 보면 조금 애매하다. 사람이 직접 쓰는 언어도 아니고, GPU가 최종적으로 실행하는 machine code도 아니다. 이름처럼 “중간 표현”인데, 왜 굳이 이런 중간층을 표준으로 만들었을까?

배경에는 driver가 너무 많은 일을 떠안던 시절의 피로가 있다. 예전 graphics API에서는 shader source를 driver에 넘기면, driver 안의 compiler가 그 자리에서 해석하고 최적화하고 GPU용 코드로 바꿔야 했다. 문제는 driver마다 compiler 품질과 버그가 다르고, 앱 실행 중 compile 시간이 튀면 사용자 눈에는 stutter로 보인다는 점이었다.

SPIR-V의 선택은 compiler chain을 둘로 나누는 쪽이었다. 앞단 compiler는 GLSL, HLSL, OpenCL C 같은 높은 수준 언어를 SPIR-V라는 표준 binary IR로 바꾼다. 뒤쪽의 Vulkan이나 OpenCL driver는 이 IR을 받아 자기 GPU에 맞게 더 낮은 코드로 내린다. 즉 “모든 언어를 모든 driver가 직접 이해하라”가 아니라, “공통으로 넘길 수 있는 중간 계약을 만들자”에 가깝다.

이 구조의 재미있는 효과는 생태계가 넓어진다는 점이다. 언어 front-end, validator, optimizer, disassembler 같은 도구들이 driver 바깥에서도 자랄 수 있다. driver는 거대한 source compiler를 품는 부담을 줄이고, 개발자는 source를 그대로 노출하지 않거나 load time을 줄일 여지도 얻는다.

왜 중요할까? SPIR-V는 GPU가 먹는 최종 언어라기보다, 앱과 compiler와 driver 사이의 “검문소에서 통하는 공용 서류”에 가깝다. Vulkan이 복잡해 보여도 이 층이 있으면 여러 언어와 여러 GPU vendor가 같은 출입구를 공유할 수 있다.

Source note: Khronos는 SPIR-V를 parallel compute와 graphics를 위한 open standard intermediate language로 설명하며, high-level language front-end가 표준 intermediate form을 만들고 Vulkan/OpenCL driver가 이를 받아 driver complexity, load time, portability 문제를 줄일 수 있다고 설명한다.
