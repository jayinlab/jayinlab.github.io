---
title: "clspv 실전 — vector_add 커널을 SPIR-V로 변환하고 대응표 만들기"
date: 2026-04-13
slug: "opencl-note-clspv-practice"
draft: false
type: "note"
series: "opencl-deep-dive"
tags: ["clspv", "spirv", "opencl"]
difficulty: "beginner"
layer: "CL"
---

이론은 충분하다. 이제 실제로 OpenCL C 커널 하나를 clspv로 변환하고,  
SPIR-V에서 무엇이 나오는지 **눈으로 직접 확인**한다.

---

## 예제 커널: vector_add

```c
__kernel void vector_add(__global const float* a,
                         __global const float* b,
                         __global float* out,
                         const int n)
{
    int gid = get_global_id(0);
    if (gid < n)
    {
        out[gid] = a[gid] + b[gid];
    }
}
```

인자 구조:
- 버퍼 3개: `a`(읽기), `b`(읽기), `out`(쓰기)
- 스칼라 1개: `n` (경계 체크용 정수)

---

## SPIR-V 생성

```bash
# 1) OpenCL C → SPIR-V binary
clspv vector_add.cl -o vector_add.spv

# 2) binary → 읽을 수 있는 텍스트
spirv-dis vector_add.spv -o vector_add.spvasm
```

---

## disassembly 체크리스트

`vector_add.spvasm`에서 아래 순서로 찾는다.

**Step 1** — `OpEntryPoint` 확인
```
OpEntryPoint GLCompute %main "vector_add" ...
```
→ 커널 이름 `vector_add`가 그대로 유지됨

**Step 2** — `OpDecorate` 확인 (binding 번호)
```
OpDecorate %a_buf DescriptorSet 0
OpDecorate %a_buf Binding 0
OpDecorate %b_buf DescriptorSet 0
OpDecorate %b_buf Binding 1
OpDecorate %out_buf DescriptorSet 0
OpDecorate %out_buf Binding 2
```
→ 커널 인자 순서대로 binding 0/1/2가 붙음

**Step 3** — `OpVariable` Storage Class 확인
```
%a_buf   = OpVariable %ptr_ssbo StorageBuffer
%b_buf   = OpVariable %ptr_ssbo StorageBuffer
%out_buf = OpVariable %ptr_ssbo StorageBuffer
%n_pc    = OpVariable %ptr_pc   PushConstant
```
→ `__global` 버퍼들 → `StorageBuffer`, `const int n` → `PushConstant`

**Step 4** — 실제 연산 구간 확인
```
; out[gid] = a[gid] + b[gid]
%a_val  = OpLoad %float %a_ptr
%b_val  = OpLoad %float %b_ptr
%sum    = OpFAdd %float %a_val %b_val
          OpStore %out_ptr %sum
```

---

## 커널 인자 ↔ SPIR-V 대응표

| OpenCL 인자 | 타입 | SPIR-V Storage Class | Binding |
|------------|------|---------------------|---------|
| `a` | `__global const float*` | StorageBuffer | set=0, binding=0 |
| `b` | `__global const float*` | StorageBuffer | set=0, binding=1 |
| `out` | `__global float*` | StorageBuffer | set=0, binding=2 |
| `n` | `const int` | PushConstant | — |
| `get_global_id(0)` | builtin | BuiltIn GlobalInvocationId | — |

이 표를 직접 채워보는 것이 핵심이다. 표 없이 읽기만 하면 연결이 안 된다.

---

## 왜 이 실습이 ANGLE 추적의 디딤돌인가

ANGLE의 목표는 `OpenCL API 호출 → Vulkan 실행`이다.  
clspv 산출물을 직접 읽으면:

- ANGLE가 어떤 커널 리소스 모델을 Vulkan으로 바인딩했는지
- descriptor set/layout이 왜 그렇게 생겼는지

를 코드와 연결해 이해할 수 있다. 다음 노트(SPIR-V↔Vulkan 매핑)는 이 표를 Vulkan API와 연결하는 작업이다.

---

## 이해 확인 질문

### Q1. vector_add SPIR-V에서 가장 먼저 찾을 3개 키워드는?

<details>
<summary>정답 보기</summary>

1. `OpEntryPoint` — 커널 이름 확인
2. `OpDecorate` — descriptor binding 번호 확인
3. `OpVariable` — Storage Class (StorageBuffer vs PushConstant) 확인

</details>

### Q2. OpDecorate를 보는 이유는?

<details>
<summary>정답 보기</summary>

`OpDecorate`의 `DescriptorSet`/`Binding` 값이 Vulkan의 descriptor set layout binding 번호와 **직접 대응**된다.  
이걸 알아야 "ANGLE가 어떤 binding 번호를 쓰는지"를 코드에서 추적할 수 있다.

</details>

### Q3. 대응표를 만드는 목적은?

<details>
<summary>정답 보기</summary>

OpenCL 커널 인자와 Vulkan 리소스 표현의 매핑을 **명확하게 고정**하기 위해서다.  
이 표 없이 ANGLE 코드를 추적하면 "어떤 binding이 어떤 인자인지" 계속 잊어버리게 된다.

</details>

### Q4. `const int n`이 PushConstant로 내려가는 이유는?

<details>
<summary>정답 보기</summary>

PushConstant는 작은 스칼라 값을 GPU에 빠르게 전달하기 위한 Vulkan 메커니즘이다.  
버퍼처럼 descriptor slot을 쓰지 않아도 되고, command buffer에 직접 기록되므로 오버헤드가 작다.  
clspv는 `__global` 포인터가 아닌 작은 스칼라 인자를 PushConstant로 매핑한다.

</details>

### Q5. 다음 단계로 barrier 있는 커널을 실습하면 어떤 게 달라질까?

<details>
<summary>정답 보기</summary>

`__local` 메모리를 쓰는 커널이라면 OpVariable에 `Workgroup` Storage Class가 나타난다.  
`barrier()`가 있다면 `OpControlBarrier`로 변환된다.  
이를 보면 local memory와 synchronization이 SPIR-V에서 어떻게 표현되는지 알 수 있다.

</details>

---

## 관련 글

- [SPIR-V 최소 읽기법](/opencl-note-spirv-reading/) — 5개 관찰 포인트 기초
- [SPIR-V↔Vulkan 매핑](/opencl-note-spirv-vulkan-mapping/) — 이 대응표를 Vulkan API와 연결
- [local memory/barrier 실습](/opencl-note-local-barrier/) — `__local` + barrier가 SPIR-V에서 어떻게 보이는가

## 관련 용어

[[SPIR-V]], [[clspv]], [[descriptor-set]], [[pipeline-layout]]
