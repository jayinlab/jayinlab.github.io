---
title: "OpenCL Note #20 — D2 실습: local memory / barrier 커널에서 SPIR-V 읽기"
date: 2026-04-03
slug: "opencl-note-20-local-barrier-practice"
draft: false
---

이번 노트는 심화 D2의 실습 노트다.

목표:
1) `__local` 메모리가 SPIR-V에서 어떻게 보이는지
2) `barrier(...)`가 어떤 명령 패턴으로 보이는지

## 실습 스크립트

```bash
bash ~/opencl_study/scripts/04_run_local_barrier.sh
```

## 실습 파일

- `~/opencl_study/src/local_sum.cl`
- `~/opencl_study/src/barrier_copy.cl`

출력:
- `~/opencl_study/build/local_sum.spvasm`
- `~/opencl_study/build/barrier_copy.spvasm`
- 로그: `~/opencl_study/logs/*-local-barrier.log`

## 무엇을 보면 좋은가

1. `Workgroup` / `Local` 관련 변수 선언
2. `OpControlBarrier` 또는 유사 barrier 관련 opcode
3. local 메모리 접근 전후의 load/store 패턴

## 읽기 체크리스트

- `__local` 인자가 어떤 storage class/변수로 내려갔는지 찾았는가?
- `barrier` 호출 지점을 SPIR-V에서 식별했는가?
- barrier 앞/뒤로 데이터 접근 순서가 바뀌는지 확인했는가?

## 이해 확인 질문

### Q1. `__local`은 왜 일반 global buffer와 다르게 다뤄질까?
<details>
  <summary>정답 보기</summary>
  workgroup 내 공유 메모리 성격이라 scope/동기화 규칙이 다르기 때문이다.
</details>

### Q2. barrier를 SPIR-V에서 찾는 이유는?
<details>
  <summary>정답 보기</summary>
  동기화 지점이 실제로 어디에 생성되는지 확인해야 데이터 경합/순서 문제를 이해할 수 있다.
</details>


---

## 결과 해설 (노트만 읽어도 이해되게)

아래는 실제 변환 결과에서 자주 보이는 핵심 패턴이다.

### 1) `__local`은 보통 Workgroup(Local) 계층으로 내려간다

핵심은 **글로벌 버퍼와 다른 storage class**로 취급된다는 점이다.

- 의미: workgroup 내 공유 메모리
- 포인트: 접근 전에/후에 동기화(barrier)와 함께 읽어야 함

실제 마커 예시(local_sum):
<pre><code>               OpEntryPoint GLCompute %29 &quot;local_sum&quot; %gl_GlobalInvocationID %gl_LocalInvocationID %gl_WorkGroupID
               OpDecorate %gl_GlobalInvocationID BuiltIn GlobalInvocationId
               OpDecorate %gl_WorkGroupSize BuiltIn WorkgroupSize
               OpDecorate %gl_LocalInvocationID BuiltIn LocalInvocationId
               OpDecorate %gl_WorkGroupID BuiltIn WorkgroupId
               OpDecorate %_runtimearr_float ArrayStride 4
               OpDecorate %_struct_15 Block
               OpDecorate %_struct_20 Block
               OpDecorate %17 DescriptorSet 0
               OpDecorate %17 Binding 0
               OpDecorate %18 DescriptorSet 0
               OpDecorate %18 Binding 1
               OpDecorate %23 SpecId 3
               OpDecorate %75 NoContraction
               OpDecorate %5 SpecId 0
               OpDecorate %6 SpecId 1
               OpDecorate %7 SpecId 2
%_ptr_Workgroup__arr_float_23 = OpTypePointer Workgroup %_arr_float_23
%_ptr_Workgroup_float = OpTypePointer Workgroup %float
%gl_GlobalInvocationID = OpVariable %_ptr_Input_v3uint Input
         %10 = OpVariable %_ptr_Private_v3uint Private %gl_WorkGroupSize
%gl_LocalInvocationID = OpVariable %_ptr_Input_v3uint Input
%gl_WorkGroupID = OpVariable %_ptr_Input_v3uint Input
         %17 = OpVariable %_ptr_StorageBuffer__struct_15 StorageBuffer
         %18 = OpVariable %_ptr_StorageBuffer__struct_15 StorageBuffer
         %22 = OpVariable %_ptr_PushConstant__struct_20 PushConstant
         %26 = OpVariable %_ptr_Workgroup__arr_float_23 Workgroup
         %42 = OpAccessChain %_ptr_Input_uint %gl_LocalInvocationID %uint_0
         %58 = OpAccessChain %_ptr_Workgroup_float %26 %43
               OpControlBarrier %uint_2 %uint_2 %uint_264
         %73 = OpAccessChain %_ptr_Workgroup_float %26 %71
        %105 = OpExtInst %void %91 ArgumentWorkgroup %95 %uint_2 %uint_3 %uint_4 %103
        %109 = OpExtInst %void %91 SpecConstantWorkgroupSize %uint_0 %uint_1 %uint_2</code></pre>

### 2) `barrier(...)`는 SPIR-V에서 동기화 opcode로 나타난다

핵심은 **순서 보장 지점이 코드에 명시된다**는 점이다.

- OpenCL `barrier(CLK_LOCAL_MEM_FENCE)`
- SPIR-V에서 `OpControlBarrier`(또는 관련 동기화 명령)로 관찰

실제 마커 예시(barrier_copy):
<pre><code>               OpEntryPoint GLCompute %28 &quot;barrier_copy&quot; %gl_GlobalInvocationID %gl_LocalInvocationID
               OpDecorate %gl_GlobalInvocationID BuiltIn GlobalInvocationId
               OpDecorate %gl_LocalInvocationID BuiltIn LocalInvocationId
               OpDecorate %gl_WorkGroupSize BuiltIn WorkgroupSize
               OpDecorate %_runtimearr_float ArrayStride 4
               OpDecorate %_struct_14 Block
               OpDecorate %_struct_19 Block
               OpDecorate %16 DescriptorSet 0
               OpDecorate %16 Binding 0
               OpDecorate %17 DescriptorSet 0
               OpDecorate %17 Binding 1
               OpDecorate %22 SpecId 3
               OpDecorate %6 SpecId 0
               OpDecorate %7 SpecId 1
               OpDecorate %8 SpecId 2
%_ptr_Workgroup__arr_float_22 = OpTypePointer Workgroup %_arr_float_22
%_ptr_Workgroup_float = OpTypePointer Workgroup %float
%gl_GlobalInvocationID = OpVariable %_ptr_Input_v3uint Input
%gl_LocalInvocationID = OpVariable %_ptr_Input_v3uint Input
         %11 = OpVariable %_ptr_Private_v3uint Private %gl_WorkGroupSize
         %16 = OpVariable %_ptr_StorageBuffer__struct_14 StorageBuffer
         %17 = OpVariable %_ptr_StorageBuffer__struct_14 StorageBuffer
         %21 = OpVariable %_ptr_PushConstant__struct_19 PushConstant
         %25 = OpVariable %_ptr_Workgroup__arr_float_22 Workgroup
         %41 = OpAccessChain %_ptr_Input_uint %gl_LocalInvocationID %uint_0
         %55 = OpAccessChain %_ptr_Workgroup_float %25 %42
               OpControlBarrier %uint_2 %uint_2 %uint_264
         %81 = OpExtInst %void %66 ArgumentWorkgroup %70 %uint_2 %uint_3 %uint_4 %79
         %85 = OpExtInst %void %66 SpecConstantWorkgroupSize %uint_0 %uint_1 %uint_2</code></pre>

### 3) 오늘 기억할 3줄

1. `__local` = workgroup 공유 메모리 성격
2. `barrier` = 데이터 순서/가시성 보장 지점
3. local 접근 패턴은 barrier 전/후 문맥으로 읽어야 한다

### 4) 자주 하는 오해

- 오해: `__local`도 그냥 global과 똑같이 보면 된다
  - 정정: scope/동기화 규칙이 다르다
- 오해: barrier는 성능 옵션이다
  - 정정: 올바른 동기화 의미(정확성)가 먼저다
