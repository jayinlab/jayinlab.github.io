---
title: "OpenCL Note #24 — Arg0가 슬롯으로 떨어지는 미니 예제"
date: 2026-04-09
slug: "opencl-note-24-arg0-to-slot-mini-example"
draft: false
type: "note"
series: "opencl-deep-dive"
tags: ["vulkan", "descriptor", "opencl"]
difficulty: "intermediate"
layer: "COMP"
---

이 글은 OpenCL 커널 인자 하나(특히 arg0)가 어떻게 Vulkan descriptor 슬롯(set/binding) 관점으로 매핑되는지 직관적으로 설명한다.

> 주의: 실제 set/binding 번호는 clspv 옵션/백엔드 정책/반사(reflection) 결과에 따라 달라질 수 있다.
> 아래는 "대표적인 예시 매핑"이다.

## OpenCL C 예제
```c
__kernel void saxpy(
    __global const float* x,   // arg0
    __global const float* y,   // arg1
    __global float* out,       // arg2
    const float a              // arg3
) {
    int i = get_global_id(0);
    out[i] = a * x[i] + y[i];
}
```

## 예시 인터페이스 매핑(개념)
- arg0 (`x`) -> set=0, binding=0 (storage/uniform 계열 버퍼 리소스)
- arg1 (`y`) -> set=0, binding=1
- arg2 (`out`) -> set=0, binding=2
- arg3 (`a`) -> push constant 또는 별도 buffer 슬롯(백엔드 정책에 따라)

핵심은 "arg 순서/타입"이 리소스 인터페이스를 만들고,
그 인터페이스가 set/binding 슬롯 계약으로 나타난다는 점이다.

## Vulkan 쪽에서 일어나는 일
1. 위 인터페이스에 맞춰 descriptor set layout을 만든다.
2. descriptor set에 실제 버퍼 핸들(x/y/out)을 써 넣는다.
3. dispatch 전에 bind한다.
4. 슬롯 규격(계약)과 실제 바인딩이 맞아야 실행된다.

## 왜 arg0가 중요하나
학습 초기엔 arg0 하나만 고정해도 흐름이 보인다:
- OpenCL 코드 인자 -> SPIR-V 인터페이스 -> Vulkan 슬롯 -> runtime 바인딩

즉, arg0는 "개념 사다리"의 첫 계단이다.

## 실전 체크 포인트
- 커널 시그니처를 바꿨으면 descriptor layout/write 코드도 함께 재검토
- 반사 정보(set/binding/type)를 기준으로 host 코드와 대조
- pipeline create 성공만으로 안심하지 말고 bind/dispatch 호환성까지 확인
