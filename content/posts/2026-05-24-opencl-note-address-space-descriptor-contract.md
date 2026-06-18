---
title: "OpenCL address space는 어떻게 descriptor 계약이 되나"
date: 2026-05-24
slug: "opencl-note-address-space-descriptor-contract"
draft: false
type: "note"
series: "opencl-driver-internals"
tags: ["opencl", "clspv", "spirv", "vulkan", "descriptor", "driver", "pm4", "memory"]
difficulty: "advanced"
layer: "CL"
---

OpenCL C에서 __global, __local, private, constant는 문법 장식처럼 보일 수 있다.
하지만 드라이버 관점에서는 이 address space 정보가 **어떤 메모리 객체를 descriptor로 바인딩할지, 어떤 값은 dispatch 내부 scratch/LDS로 처리할지, 어떤 접근은 alias 가능성이 있는지**를 가르는 계약이 된다.

오늘은 하나의 kernel argument가 아래 경로를 지나며 어떤 의미를 잃지 말아야 하는지 추적한다.

~~~text
OpenCL C address space
-> clspv / SPIR-V storage class and decorations
-> Vulkan descriptor or push constant contract
-> driver pipeline layout / user data mapping
-> PM4 state setup before dispatch
-> cache visibility and fault attribution
~~~

## 왜 이 주제를 오늘 잡았나

최근 복습 흐름은 event lifetime 반복에서 잠시 벗어나, __global 포인터가 SPIR-V storage class와 Vulkan descriptor로 내려가는 부분을 다시 건드렸다.

이 주제는 앱 개발자에게도 익숙하다. __global float* out 같은 인자를 자주 쓰기 때문이다.
하지만 driver-dev 관점에서는 훨씬 더 날카로운 질문이 된다.

**이 포인터가 실제 GPU 실행 시점에 어떤 descriptor table slot, 어떤 user data, 어떤 cache visibility 계약으로 이어지는가?**

이 질문을 놓치면 다음 세 가지를 혼동하기 쉽다.

- OpenCL address space와 실제 physical memory 위치
- SPIR-V storage class와 Vulkan descriptor binding
- descriptor binding correctness와 cache visibility correctness

세 항목은 연결되어 있지만 같은 말은 아니다.

## 예제 kernel

작은 saxpy kernel로 보자.

~~~c
__kernel void saxpy(__global const float *x,
                    __global float *y,
                    const float a,
                    const int n)
{
    int i = get_global_id(0);
    if (i < n) {
        y[i] = a * x[i] + y[i];
    }
}
~~~

OpenCL C 수준에서 보면 핵심 입력은 네 개다.

| 인자 | OpenCL 의미 | 내부적으로 필요한 판단 |
|---|---|---|
| x | global memory에서 읽는 buffer | read-only storage buffer descriptor 후보 |
| y | global memory에서 읽고 쓰는 buffer | read-write storage buffer descriptor 후보 |
| a | 작은 scalar 값 | push constant 또는 kernarg block 후보 |
| n | 작은 scalar 값 | push constant 또는 kernarg block 후보 |

여기서 __global은 단순히 "큰 메모리"라는 뜻이 아니다.
GPU가 dispatch 중에 buffer descriptor를 통해 접근할 수 있는 주소 공간이라는 뜻에 가깝다.

## clspv/SPIR-V에서 address space는 storage 계약으로 굳어진다

clspv 같은 OpenCL-to-SPIR-V 경로는 __global 포인터를 대개 Vulkan이 이해할 수 있는 buffer interface로 낮춘다.
단순화하면 이런 식이다.

~~~text
__global const float *x
  -> SPIR-V variable/interface
  -> StorageBuffer-like resource
  -> DescriptorSet 0, Binding 0

__global float *y
  -> SPIR-V variable/interface
  -> StorageBuffer-like resource
  -> DescriptorSet 0, Binding 1

scalar a, n
  -> PushConstant or small uniform/kernarg representation
~~~

정확한 SPIR-V 형태는 clspv 옵션과 버전에 따라 달라질 수 있다.
하지만 driver-dev가 봐야 하는 불변식은 같다.

~~~text
shader interface says:
  binding 0 is x-like storage
  binding 1 is y-like storage
  scalar constants are available at agreed offsets

runtime must bind:
  x buffer descriptor at binding 0
  y buffer descriptor at binding 1
  a/n values at the same offsets the shader expects
~~~

즉 address space lowering은 "컴파일러가 알아서 끝낸 일"이 아니다.
컴파일 결과가 만든 interface contract를 runtime/driver가 dispatch 시점에 그대로 맞춰야 한다.

## descriptor layout은 타입보다 계약이다

Vulkan 쪽에서는 이 정보가 descriptor set layout과 pipeline layout으로 드러난다.

~~~text
SPIR-V decorations / reflection
-> descriptor set layout
-> pipeline layout
-> descriptor set update
-> vkCmdBindDescriptorSets
-> vkCmdDispatch
~~~

여기서 흔한 오해는 "binding 번호만 같으면 된다"는 생각이다.
실제로는 아래 축이 함께 맞아야 한다.

| 축 | 깨졌을 때 생기는 문제 |
|---|---|
| descriptor type | shader가 buffer로 읽는데 image/sampler 계약을 바인딩할 수 없음 |
| binding index | x와 y가 뒤바뀌어 wrong result 또는 fault |
| descriptor count | array resource 접근 범위가 layout과 불일치 |
| access expectation | read-only로 가정한 buffer가 write target과 alias될 수 있음 |
| push/kernarg offset | a, n이 엉뚱한 값으로 읽힘 |
| pipeline layout compatibility | pipeline/cache 재사용 fast path가 잘못됨 |

descriptor layout은 "슬롯 목록"이 아니라 shader interface와 driver binding code 사이의 ABI다.
그래서 5월 21일의 kernel dispatch ABI 노트와 이어진다.

## alias 판단은 address space만으로 끝나지 않는다

OpenCL에서 x와 y가 둘 다 __global이라고 해서 서로 다른 buffer라는 보장은 없다.
앱은 같은 cl_mem을 두 인자에 넣을 수도 있고, 같은 allocation의 다른 offset을 넣을 수도 있다.

~~~text
clSetKernelArg(kernel, 0, x_buffer)
clSetKernelArg(kernel, 1, x_buffer)  // 가능: x와 y가 alias
~~~

컴파일러는 type qualifier와 address space를 보고 최적화 힌트를 얻지만, runtime alias는 실제 바인딩된 객체를 봐야 한다.
driver-dev 관점에서는 descriptor update 단계에서 최소한 아래 정보를 추적해야 한다.

~~~text
arg0 x:
  cl_mem=BO17 offset=0 size=4096 access=read
  descriptor binding=0 gpu_va=0x...

arg1 y:
  cl_mem=BO17 offset=0 size=4096 access=read_write
  descriptor binding=1 gpu_va=0x...
  aliases arg0=true
~~~

이 정보는 correctness와 performance 양쪽에 영향을 준다.
alias 가능성이 있으면 reordering, cache policy, write-after-read hazard 판단을 더 보수적으로 해야 할 수 있다.
반대로 alias가 없다는 근거가 충분하면 descriptor/cache fast path를 더 과감하게 탈 수 있다.

## local/private는 descriptor가 아니라 dispatch resource로 보일 수 있다

__local과 private는 __global 포인터와 다르게 봐야 한다.

~~~c
__kernel void reduce(__global float *out,
                     __global const float *in,
                     __local float *scratch)
{
    int lid = get_local_id(0);
    scratch[lid] = in[get_global_id(0)];
    barrier(CLK_LOCAL_MEM_FENCE);
    ...
}
~~~

in과 out은 descriptor-backed global buffer가 된다.
하지만 scratch는 workgroup-local storage다.
이 값은 Vulkan/driver 경로에서 단순한 storage buffer descriptor가 아니라 workgroup당 LDS/shared memory 요구량으로 내려갈 수 있다.

private도 마찬가지다.
register에 들어가면 descriptor가 필요 없지만, register pressure가 커져 spill이 발생하면 scratch/private backing state가 필요해질 수 있다.

따라서 address space별로 driver가 확인해야 하는 축이 다르다.

| OpenCL address space | 흔한 backend 표현 | driver가 신경 쓸 것 |
|---|---|---|
| __global | storage buffer descriptor | binding, BO residency, VA, alias, visibility |
| constant | uniform/storage/push 형태 | update 빈도, cache policy, layout compatibility |
| __local | LDS/workgroup memory | workgroup당 LDS size, barrier semantics, occupancy |
| private | register or scratch | VGPR/SGPR pressure, scratch backing, occupancy |

모든 address space가 descriptor set slot으로 가는 것은 아니다.
이 구분이 흐려지면 "descriptor는 맞는데 LDS/scratch state가 틀린" 버그를 놓친다.

## PM4 관점: descriptor 계약은 DISPATCH 앞 state가 된다

SPIR-V/Vulkan 레벨에서 맞춘 계약은 최종적으로 command stream에 반영되어야 한다.

단순화하면 dispatch 앞에는 이런 state가 필요하다.

~~~text
SET shader program / pipeline state
SET user data or descriptor table base
SET kernarg or push-constant data
SET scratch/LDS/private memory state
DISPATCH_DIRECT
visibility action if needed
EVENT_WRITE fence
~~~

여기서 __global x/y -> descriptor binding 경로는 보통 user data 또는 descriptor table base와 연결된다.
ISA는 OpenCL 객체를 직접 모른다.
ISA는 약속된 register나 memory location에서 descriptor pointer, buffer base, stride, bounds 같은 정보를 읽는다.

그래서 다음 순서는 위험하다.

~~~text
DISPATCH saxpy
SET descriptor table for saxpy
EVENT_WRITE fence
~~~

descriptor table이 dispatch 뒤에 오면 shader는 이전 kernel의 descriptor를 읽을 수 있다.
반대로 descriptor state가 맞아도, y에 쓴 결과를 host나 다음 queue가 읽기 전에 필요한 cache/release action이 빠지면 stale read가 날 수 있다.

정리하면 두 계약을 분리해야 한다.

~~~text
binding/state correctness:
  dispatch가 올바른 descriptor와 scalar 값을 보는가?

memory visibility correctness:
  dispatch가 쓴 값이 다음 consumer에게 보이는가?
~~~

둘 중 하나만 맞아도 충분하지 않다.

## fault triage에서 이 경로가 필요한 이유

GPU fault가 났다고 하자.

~~~text
fault_va=0xdead...
event=E42 -> CL_EXEC_STATUS_ERROR_FOR_EVENTS_IN_WAIT_LIST
~~~

이때 fault VA만 보면 원인이 잘 안 보인다.
driver는 이 VA가 어떤 경로에서 나왔는지 역추적해야 한다.

~~~text
event E42
-> submit 120
-> command node saxpy
-> pipeline layout hash P
-> descriptor set D
-> binding 1 y
-> BO17 gpu_va base + offset
-> PM4 user data slot S
-> dispatch packet range
~~~

이 연결이 있으면 질문이 구체화된다.

- fault VA가 x read에서 나온 것인가, y write에서 나온 것인가?
- descriptor binding이 SPIR-V reflection 결과와 맞는가?
- BO가 submit resource list에 들어 있었고 resident였는가?
- x와 y가 alias라면 hazard/visibility 판단이 보수적으로 됐는가?
- fault 직전 command stream에서 user data update가 생략되지 않았는가?

이 정도가 있어야 "OpenCL event가 에러가 됐다"에서 멈추지 않고, descriptor/state/PM4 중 어느 층의 문제인지 좁힐 수 있다.

## driver 로그에 남기면 좋은 형태

실전 로그는 verbose packet dump보다 contract 중심이 더 읽기 좋다.

~~~text
submit=120 queue=Q0 command=saxpy event=E42
  spv_interface_hash=0x91ab pipeline_layout=0x33f0
  arg0 name=x addrspace=global binding=0 access=read
       bo=17 va=0x100000 size=4096 resident=true
  arg1 name=y addrspace=global binding=1 access=read_write
       bo=18 va=0x200000 size=4096 resident=true aliases=[]
  scalar a offset=0 size=4 source=push_constant
  scalar n offset=4 size=4 source=push_constant
  lds_per_wg=0 scratch_per_thread=0
  user_data_epoch=502 descriptor_table=0x300000
  dispatch_range=IB_A[0x80..0xa0]
  post_visibility=L2_release fence_seq=901
~~~

이 로그는 packet 이름을 전부 외우지 않아도 핵심 invariant를 확인하게 해준다.

- SPIR-V interface와 pipeline layout이 같은 계약을 말하는가?
- OpenCL argument와 descriptor binding이 1:1로 맞는가?
- bound BO가 resident이고 fault VA 범위와 맞는가?
- dispatch 전에 user data/descriptor epoch가 갱신됐는가?
- completion fence가 visibility action 뒤에 있는가?

## what this means for driver dev

- OpenCL address space lowering을 compiler-only 문제로 보지 말고, descriptor layout, user data, LDS/scratch state까지 이어지는 dispatch ABI로 추적해야 한다.
- __global argument는 binding 번호뿐 아니라 BO, GPU VA, offset, access, alias 여부까지 함께 로그화해야 fault attribution이 가능하다.
- __local과 private는 descriptor slot이 아니라 LDS/scratch/resource usage로 내려갈 수 있으므로 dispatch resource setup과 occupancy 검증에 포함해야 한다.
- pipeline layout compatibility fast path는 SPIR-V interface hash, descriptor layout fingerprint, push/kernarg range를 기준으로 보수적으로 판단해야 한다.
- PM4 dump를 볼 때는 DISPATCH보다 앞의 user data/descriptor table setup이 이번 kernel interface와 맞는지 먼저 확인해야 한다.
- event COMPLETE나 fault status는 descriptor correctness를 자동으로 증명하지 않는다. binding/state correctness와 memory visibility correctness를 따로 검증해야 한다.

## app-facing takeaway

앱 개발자는 descriptor table을 직접 만들지 않더라도, kernel signature와 argument binding을 안정적으로 유지하면 backend가 더 예측 가능해진다.

- __global pointer 인자의 순서와 타입을 자주 바꾸면 pipeline/descriptor layout 재생성이 늘 수 있다.
- 같은 buffer를 여러 인자로 넘기는 alias 패턴은 correctness상 가능하지만, 드라이버가 더 보수적인 hazard 판단을 해야 할 수 있다.
- __local memory를 크게 쓰면 descriptor 문제가 아니라 LDS/occupancy 문제가 된다.
- scalar 인자는 작아 보여도 push constant/kernarg layout의 일부라서 alignment와 offset 계약이 중요하다.

결국 address space는 "어디에 저장되는가"만 말하지 않는다.
OpenCL source에서 시작해 SPIR-V interface, Vulkan binding, PM4 state setup, cache visibility, fault triage까지 이어지는 실행 계약의 첫 단서다.

---

## 관련 글

- [SPIR-V↔Vulkan 매핑 — OpDecorate에서 descriptor set까지 1:1 연결]({{< relref "2026-04-13-opencl-note-spirv-vulkan-mapping.md" >}})
- [OpenCL 드라이버의 kernel dispatch ABI: ISA 메타데이터가 PM4 DISPATCH를 채우는 방식]({{< relref "2026-05-21-opencl-note-kernel-dispatch-abi.md" >}})
- [PM4 compute dispatch sequence: state setup은 왜 DISPATCH보다 먼저 와야 하나]({{< relref "2026-05-22-opencl-note-pm4-compute-dispatch-sequence.md" >}})
- [GPU fault는 OpenCL event와 error로 어떻게 올라오나]({{< relref "2026-05-20-opencl-note-gpu-fault-to-event-error.md" >}})

## 관련 용어

- [[SPIR-V]], [[descriptor-set]], [[pipeline-layout]], [[pm4-packet]], [[barrier]]
