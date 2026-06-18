---
title: "OpenCL address space -> descriptor -> PM4 state 계약 추적"
date: 2026-05-24
slug: "opencl-address-space-descriptor-pm4-animation"
draft: false
type: "note"
series: "opencl-deep-dive"
tags: ["opencl", "clspv", "spir-v", "vulkan", "descriptor", "pm4", "animation"]
difficulty: "intermediate"
animation: true
layer: "CL"
---

OpenCL C에서 <code>__global</code>, <code>__local</code>, <code>private</code>은 그냥 문법 장식이 아니다. 이 세 단어는 뒤쪽 계층으로 내려가면서 <strong>서로 다른 실행 계약</strong>이 된다.

이번 animation은 같은 커널 인자들이 아래 흐름에서 어떻게 다른 모양으로 바뀌는지 따라간다.

~~~text
OpenCL C address space
  -> clspv / SPIR-V storage class
  -> Vulkan descriptor / pipeline layout / push-like state
  -> driver state setup
  -> PM4 user-data, resource, LDS/scratch 관련 상태
~~~

핵심 질문은 하나다.

> 어떤 값은 descriptor slot이 되고, 어떤 값은 LDS/scratch/register 상태가 되며, 왜 이 차이가 디버깅에서 중요할까?

---

## Animation

<code>다음</code> 버튼으로 <code>__global</code> buffer, <code>__local</code> scratchpad, <code>private</code> temporary가 각 계층에서 갈라지는 지점을 확인한다.

{{< address_space_descriptor_pm4_anim >}}

---

## 예제 커널

~~~c
__kernel void saxpy_tile(
    __global const float* x,
    __global float* y,
    float a,
    __local float* tile)
{
    int gid = get_global_id(0);
    int lid = get_local_id(0);

    float tmp = x[gid] * a;  // tmp는 private
    tile[lid] = tmp;         // tile은 local
    barrier(CLK_LOCAL_MEM_FENCE);
    y[gid] = tile[lid] + y[gid];
}
~~~

이 커널에는 세 종류의 상태가 섞여 있다.

| OpenCL 의미 | 대표 값 | 뒤쪽 계층에서 중요한 질문 |
|---|---|---|
| <code>__global</code> | <code>x</code>, <code>y</code> buffer | 어떤 descriptor/binding slot을 통해 GPU VA를 읽는가? |
| <code>__local</code> | <code>tile</code> | work-group마다 필요한 LDS/shared memory 크기가 얼마인가? |
| <code>private</code> | <code>gid</code>, <code>lid</code>, <code>tmp</code> | wave/lane마다 register 또는 spill scratch로 충분한가? |
| scalar | <code>a</code> | push constant, uniform buffer, inline constant 중 어떤 경로인가? |

---

## 1. __global은 descriptor 계약이 된다

<code>__global</code> pointer는 GPU 메모리 객체를 가리킨다. Vulkan으로 내려가면 보통 storage buffer descriptor가 되고, pipeline layout은 "몇 번 set/binding에 어떤 타입이 와야 하는가"를 고정한다.

중요한 점은 <code>clSetKernelArg(k, 0, ..., &x_buf)</code>가 단순히 값을 복사하는 일이 아니라는 것이다. ANGLE/clspv 경로에서는 이 인자가 결국 Vulkan descriptor update/bind 계약과 연결된다.

~~~text
OpenCL arg0: __global const float* x
  -> SPIR-V: StorageBuffer / descriptor-backed object
  -> Vulkan: set/binding slot
  -> Driver: resource descriptor / GPU VA state
  -> PM4: dispatch 전에 user-data/resource state 설정
~~~

디버깅할 때 <code>__global</code> 쪽 문제가 나면 보통 아래를 본다.

- descriptor set layout과 shader interface가 맞는가?
- descriptor update가 올바른 buffer range/GPU VA를 가리키는가?
- dispatch 전에 올바른 descriptor state가 bind되었는가?
- GPU VM fault 주소가 어느 buffer 인자와 가까운가?

---

## 2. __local은 descriptor slot이 아니라 work-group 자원이 된다

<code>__local</code>은 모든 work-item이 공유하는 work-group-local scratchpad다. AMD 계열에서 생각하면 LDS(local data share)에 가까운 자원이다.

그래서 <code>__local float* tile</code>은 <code>x</code>, <code>y</code>처럼 외부 GPU buffer 주소를 담은 descriptor가 아니다. 더 중요한 계약은 <strong>work-group 하나가 LDS를 얼마나 요구하는가</strong>다.

~~~text
OpenCL local memory
  -> SPIR-V: Workgroup storage class
  -> Vulkan/driver: shader/workgroup local memory requirement
  -> PM4-level intuition: dispatch state includes LDS-related resource assumptions
~~~

이 차이를 놓치면 "왜 <code>tile</code>은 descriptor binding table에서 안 보이지?" 같은 혼동이 생긴다. <code>tile</code>은 외부 메모리 객체가 아니라 dispatch되는 work-group 내부에 잡히는 공유 공간이다.

---

## 3. private은 lane-local 임시값이다

<code>private</code> 값은 각 work-item 자기 것만 가진다. <code>tmp</code>, <code>gid</code>, <code>lid</code> 같은 값은 보통 scalar/vector register에 살고, register가 부족하거나 컴파일러가 필요하다고 판단하면 scratch로 spill될 수 있다.

~~~text
OpenCL private value
  -> SPIR-V: Function/Private storage
  -> Driver compiler: VGPR/SGPR allocation, possible scratch spill
  -> PM4-level intuition: scratch/resource state may matter, but descriptor arg는 아니다
~~~

여기서 중요한 구분:

- <code>private</code>은 <code>__global</code>처럼 descriptor로 buffer를 bind하는 문제가 아니다.
- 하지만 register pressure가 높으면 scratch 사용량이 늘고 occupancy나 memory traffic에 영향을 줄 수 있다.
- 같은 OpenCL 코드라도 compiler/backend에 따라 register allocation과 spill 양상이 달라질 수 있다.

---

## 4. 상태 계약과 메모리 가시성 계약은 다르다

이 주제에서 특히 헷갈리기 쉬운 부분은 descriptor/state와 barrier/visibility를 섞어 생각하는 것이다.

<code>__global x</code>가 올바른 descriptor slot에 bind되는 것은 <strong>상태 계약</strong>이다. shader가 어떤 주소를 읽을지 정하는 문제다.

반면, 이전 dispatch나 copy가 쓴 값을 이번 dispatch가 반드시 보게 하는 것은 <strong>메모리 가시성 계약</strong>이다. Vulkan에서는 pipeline barrier, access mask, layout/state transition 같은 별도 동기화가 필요할 수 있다.

~~~text
Descriptor/binding correctness:
  "shader arg0가 x buffer를 가리키는가?"

Memory visibility correctness:
  "x buffer 안의 최신 내용이 이번 shader read에 보이는가?"
~~~

두 계약 중 하나만 맞아도 프로그램은 깨질 수 있다.

---

## 5. PM4 관점의 체크리스트

실제 PM4 packet 하나하나를 항상 직접 볼 수 있는 것은 아니지만, PM4 레벨로 내려가며 생각할 때는 이런 질문들이 유용하다.

| 질문 | 주로 연결되는 계층 |
|---|---|
| dispatch 전에 descriptor/resource state가 먼저 설정되었나? | <code>__global</code> / descriptor / user-data |
| pipeline layout과 shader가 기대하는 binding 번호가 맞나? | clspv/SPIR-V / Vulkan |
| LDS 사용량이 work-group 크기와 함께 과하지 않은가? | <code>__local</code> / occupancy |
| private 값이 너무 많아 scratch spill이 생기지 않는가? | compiler / register allocation |
| barrier는 local memory ordering만 보장하는가, global visibility까지 필요한가? | OpenCL fence / Vulkan sync |
| fault 주소가 어느 buffer 인자와 대응되는가? | GPU VM / descriptor debug |

---

## 한 줄 요약

<code>__global</code>은 descriptor-backed external memory 계약, <code>__local</code>은 work-group shared resource 계약, <code>private</code>은 lane-local register/scratch 계약이다. 이 셋을 구분하면 OpenCL 코드가 Vulkan과 PM4 쪽에서 어떤 상태로 바뀌는지 훨씬 선명하게 추적할 수 있다.

## 관련 글

- [Arg0→슬롯 미니 예제](/opencl-note-arg0-to-slot/)
- [OpenCL to Vulkan bridge](/opencl-note-opencl-to-vulkan-bridge/)
- [PM4 제출 흐름 Animation](/pm4-submit-flow-animation/)
- [PM4 Event Write vs Cache Flush](/opencl-note-pm4-event-write-vs-cache-flush/)

## 관련 용어

[[SPIR-V]], [[clspv]], [[descriptor-set]], [[pipeline-layout]], [[local-memory]], [[pm4-packet]], [[occupancy]]
