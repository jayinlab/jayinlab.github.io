---
title: "dynamic __local이 느려진 이유: ALU가 아니라 LDS residency부터 본다"
date: 2026-09-28
slug: "opencl-dynamic-local-lds-residency"
draft: false
type: "wrong-note"
series: "opencl-deep-dive"
tags: ["opencl", "local-memory", "lds", "occupancy", "work-group", "wavefront", "performance", "amd"]
difficulty: "advanced"
animation: true
---

`__local` argument를 16 KiB에서 32 KiB로 늘렸더니 결과는 맞지만 kernel 시간이 갑자기 길어졌다고 하자.

처음에는 이것을 “ALU 병렬화가 줄었다”라고 설명했다. 방향은 절반쯤 맞지만 원인과 결과가 섞였다. `__local` 크기가 직접 ALU lane 수를 줄이는 것은 아니다. 먼저 줄어드는 것은 한 CU/WGP에 **동시에 resident할 수 있는 work-group과 wave의 수**다. 그 결과 기다리는 wave를 다른 wave로 가리는 여지가 줄어들 수 있고, 그때 관측되는 ALU utilization도 낮아질 수 있다.

오늘 고칠 기술 모델은 이 한 줄이다.

~~~text
dynamic __local 증가
-> work-group당 local-memory/LDS 요구량 증가
-> 동시에 resident 가능한 work-group 수의 상한 감소
-> resident wave 수 감소 가능
-> latency hiding 여지 감소
-> 실행 시간 증가 가능
~~~

마지막 세 화살표에는 모두 **가능**이라는 말이 붙는다. occupancy 감소가 곧 성능 감소라는 OpenCL 보장은 없기 때문이다.

## 먼저 확정된 코드·스펙 사실

아래는 Khronos OpenCL 문서와 AMD 공개 자료에서 직접 확인되는 사실이다.

- `clSetKernelArg`에서 kernel argument가 `local` address space pointer이면 `arg_value`는 `NULL`이어야 하고, `arg_size`가 그 argument에 할당할 local memory byte 수를 지정한다. 즉 `clSetKernelArg(kernel, i, 32 * 1024, NULL)`의 32 KiB는 단순 포인터 값이 아니라 실행 자원 요구량이다.
  Source: [OpenCL-Docs `opencl_runtime_layer.asciidoc` L10949-L10954](https://github.com/KhronosGroup/OpenCL-Docs/blob/main/api/opencl_runtime_layer.asciidoc#L10949-L10954)
- `CL_KERNEL_LOCAL_MEM_SIZE`는 kernel이 사용하는 local memory 양을 반환하며, 구현 자체에 필요한 양, kernel 안의 `__local` 변수, `__local` pointer argument용 동적 할당을 포함한다. host가 넘긴 dynamic 크기만 따로 보여 주는 값이 아니라 **합계**다.
  Source: [OpenCL-Docs `opencl_runtime_layer.asciidoc` L11520-L11530](https://github.com/KhronosGroup/OpenCL-Docs/blob/main/api/opencl_runtime_layer.asciidoc#L11520-L11530)
- OpenCL local memory는 한 work-group에 local하며 그 work-group의 모든 work-item이 공유하는 memory region이다. 따라서 이 자원의 자연스러운 회계 단위는 work-item 하나가 아니라 work-group이다.
  Source: [OpenCL-Docs `opencl_architecture.asciidoc` L755-L757](https://github.com/KhronosGroup/OpenCL-Docs/blob/main/api/opencl_architecture.asciidoc#L755-L757)
- `CL_DEVICE_LOCAL_MEM_TYPE`이 `CL_LOCAL`이면 dedicated local memory storage, 예를 들어 SRAM일 수 있다. `CL_GLOBAL`인 구현도 허용된다. `CL_DEVICE_LOCAL_MEM_SIZE`는 device가 보고하는 local-memory region 크기다. 그러므로 OpenCL의 `__local`을 모든 device에서 AMD LDS와 동일한 물리 구조라고 단정할 수는 없다.
  Source: [OpenCL-Docs `opencl_platform_layer.asciidoc` L1092-L1107](https://github.com/KhronosGroup/OpenCL-Docs/blob/main/api/opencl_platform_layer.asciidoc#L1092-L1107)
- AMD RDNA 설명에서 LDS는 WGP의 shared-memory 자원이고, theoretical occupancy에는 VGPR, SGPR, LDS, threadgroup 크기 같은 여러 제한이 함께 작용한다. LDS를 많이 쓰면 동시에 올릴 수 있는 threadgroup 수가 제한될 수 있다.
  Source: [AMD GPUOpen, *Occupancy explained*](https://gpuopen.com/learn/occupancy-explained/)

여기까지가 코드/스펙에서 직접 확인한 부분이다. 아래부터는 이 사실을 AMD GPU의 residency와 성능 관점으로 읽는 해석이다.

## 1. static과 dynamic은 입구가 다르고 예산에서는 만난다

kernel의 local memory 요구량에는 적어도 두 입구가 있다.

~~~c
__kernel void reduce(__global const float *src,
                     __global float *dst,
                     __local float *scratch)   // dynamic
{
    __local uint flags[256];                   // static
    // ...
}
~~~

`flags`의 크기는 build된 kernel에 박힌다. 반면 `scratch`의 크기는 host가 kernel argument를 설정할 때 정한다.

~~~c
clSetKernelArg(kernel, 2, 32 * 1024, NULL);
~~~

입구는 달라도 특정 enqueue가 실행될 때에는 같은 work-group-local 자원 예산에 합쳐진다고 보는 것이 출발점이다.

~~~text
local bytes per work-group
  = static __local bytes
  + dynamic __local argument bytes
  + implementation overhead, if any
~~~

여기서 첫 번째 오해를 버려야 한다. host가 32 KiB를 넘겼다고 `CL_KERNEL_LOCAL_MEM_SIZE`가 반드시 정확히 32 KiB라는 뜻은 아니다. static allocation과 구현 비용이 더해질 수 있다. 또한 실제 hardware allocation granularity 때문에 profiler에 보이는 예약량이 source-level 합계보다 반올림될 수도 있다. 그 granularity는 OpenCL 공통 계약이 아니라 device와 compiler/driver의 영역이다.

## 2. LDS로 막히는 것은 ALU 수가 아니라 resident work-group 수다

설명을 위해 한 실행 위치에 쓸 수 있는 LDS가 64 KiB라고 가정하자. 실제 회계 범위가 CU인지 WGP인지, 예약 단위가 얼마인지는 architecture마다 확인해야 한다.

work-group당 LDS만 고려한 단순 상한은 다음과 같다.

~~~text
LDS-limited resident work-groups
  = floor(available LDS / allocated LDS per work-group)
~~~

| work-group당 LDS | 단순 상한 |
|---:|---:|
| 8 KiB | 8 work-groups |
| 16 KiB | 4 work-groups |
| 32 KiB | 2 work-groups |
| 40 KiB | 1 work-group |

16 KiB에서 32 KiB로 늘리면 이 가상 예에서는 LDS 기준 상한이 4개에서 2개로 내려간다. 그러나 ALU lane이 절반으로 물리적으로 잘린 것은 아니다. 같은 ALU에 실행 준비가 된 work-group을 몇 개 함께 보관할 수 있는지가 먼저 바뀐다.

각 work-group이 256 work-item이고 hardware wave가 64 lane이라고 단순화하면 work-group당 4 waves다.

~~~text
16 KiB/WG: 4 resident WG × 4 waves/WG = 16 waves
32 KiB/WG: 2 resident WG × 4 waves/WG =  8 waves
~~~

이제야 “병렬 실행 여력 감소”를 정확히 말할 수 있다. 줄어든 것은 source의 work-item 총수도, CU의 물리 ALU 수도 아니라 **그 순간 resident하며 scheduler가 고를 수 있는 wave 후보 수의 한 상한**이다.

## 3. latency hiding은 residency 다음 단계의 이야기다

wave A가 global-memory load 결과를 기다리면 scheduler는 준비된 wave B를 골라 같은 execution resource를 활용할 수 있다. resident wave가 충분하면 이런 교대가 긴 latency를 가릴 수 있다.

~~~text
wave A: issue memory load -> wait -----------------> resume
wave B:                    ALU work
wave C:                            ALU work
wave D:                                    ALU work
~~~

LDS 요구량 때문에 resident wave 후보가 줄면 기다리는 동안 대신 실행할 wave가 부족해질 수 있다. 이때 latency가 화면 앞으로 드러난다.

하지만 반대 사례도 중요하다.

- kernel이 대부분 compute이고 dependency chain이 짧다면 wave 수가 줄어도 차이가 작을 수 있다.
- 16 KiB일 때부터 register나 architecture의 work-group slot이 더 작은 상한이었다면 LDS를 32 KiB로 늘려도 실제 residency는 그대로일 수 있다.
- LDS를 늘린 덕분에 global-memory traffic이나 recomputation이 크게 줄었다면 낮은 occupancy보다 큰 이득을 얻을 수 있다.
- work-group 안 barrier에서 모든 wave가 기다리는 패턴은 단순히 resident wave 수만 늘린다고 사라지지 않는다.

따라서 올바른 문장은 “LDS가 늘어 ALU 병렬화가 낮아졌다”가 아니다.

> LDS 요구량이 resident work-group/wave의 병목이 되었는지 먼저 확인하고, 그 감소가 latency hiding과 실제 실행 시간에 영향을 주었는지 다음 증거로 확인한다.

## 4. 기존 animation을 읽을 때의 경계

아래 animation은 register, LDS, work-group size가 서로 다른 occupancy 상한을 만들고 그중 가장 작은 값이 결과를 제한한다는 관계를 보여 준다.

{{< occupancy_anim >}}

이 animation의 `64 KiB/CU`, `최대 16 wavefront`, wave64 같은 숫자는 관계를 설명하기 위한 **가상 장치 값**이다. 특정 RDNA 세대의 정확한 CU/WGP topology나 allocation granularity를 주장하는 표가 아니다. 오늘 글에서 가져갈 것은 숫자가 아니라 다음 최소값 구조다.

~~~text
resident waves
  <= min(
       architecture wave-slot limit,
       register-limited waves,
       LDS-limited work-groups × waves per work-group,
       work-group/thread limits,
       other implementation limits
     )
~~~

`__local`만 바꾼 실험이라도 다른 limit을 실제로 계산하기 전에는 “LDS bottleneck”이라고 확정하면 안 된다.

## 5. 어디서 무엇을 확인할까

### OpenCL 층: 요구량과 합법성

먼저 host가 어떤 dynamic 크기를 설정했는지 기록한다.

~~~text
kernel=reduce
arg_index=2
arg_kind=local
arg_size=32768
arg_value=NULL
local_work_size=256
~~~

그리고 다음 query를 함께 본다.

- `CL_DEVICE_LOCAL_MEM_TYPE`: dedicated local storage인지 global storage인지
- `CL_DEVICE_LOCAL_MEM_SIZE`: device가 보고한 local-memory region 크기
- `CL_KERNEL_LOCAL_MEM_SIZE`: static + dynamic + implementation 필요량을 포함한 kernel 사용량
- `CL_KERNEL_WORK_GROUP_SIZE`: 이 kernel/device 조합의 최대 work-group size

이 값들만으로 실제 동시 residency가 완전히 결정되지는 않는다. OpenCL API는 AMD CU/WGP별 VGPR allocation과 wave slot을 표준 query로 모두 노출하지 않기 때문이다.

### compiler와 Vulkan 층: lowering 결과

ANGLE → clspv/SPIR-V → Vulkan 경로에서는 dynamic local argument가 어떤 specialization/interface와 Workgroup storage로 표현되는지 확인해야 한다. 여기서 **확인하지 못한 경계**가 있다.

이 글을 쓰는 시점에는 현재 사용 중인 ANGLE/clspv revision에서 dynamic `__local` byte 수가 정확히 어느 reflection field와 specialization constant를 거쳐 최종 Vulkan shader module/pipeline variant에 반영되는지 파일·줄번호 trace를 다시 고정하지 않았다. 따라서 “모든 구현에서 enqueue 때 LDS가 임의 크기로 동적 예약된다”라고 주장하지 않는다. Vulkan pipeline 생성 전에 크기가 specialization되어 서로 다른 pipeline variant가 될 수도 있으며, 구체 경로는 구현 revision의 코드와 reflection output으로 확인해야 한다.

관찰할 증거는 다음과 같다.

~~~text
OpenCL arg_size
-> clspv reflection / SPIR-V specialization evidence
-> Vulkan shader/pipeline variant key
-> compiler resource report: workgroup storage bytes
~~~

### AMD driver/profiler 층: 실제 병목

마지막으로 architecture에 맞는 profiler에서 다음을 함께 본다.

~~~text
allocated LDS per work-group
active/resident work-groups or waves
VGPR/SGPR usage
achieved occupancy
memory latency / cache misses
VALU utilization or issue activity
kernel duration
~~~

판정 순서는 중요하다.

1. 16 KiB와 32 KiB variant의 local work size와 입력을 고정한다.
2. compiler/driver가 보고한 LDS allocation이 실제로 증가했는지 본다.
3. 다른 자원 상한을 포함해 resident work-group/wave가 감소했는지 본다.
4. 그 뒤 memory stall, issue activity, duration이 함께 변했는지 본다.

2번 없이 3번을 추정하면 source-level 숫자와 hardware allocation을 혼동한다. 3번 없이 4번만 보면 clock, cache warm-up, DVFS 같은 다른 원인을 LDS 탓으로 돌릴 수 있다.

## 정정된 모델

처음의 기술 모델:

> dynamic `__local`을 늘리면 ALU 병렬화가 줄어서 느려진다.

충돌한 사실:

> local memory는 work-group 공유 자원이고, AMD GPU에서는 LDS 요구량이 resident work-group 수의 상한을 만들 수 있다. ALU는 그대로인데 scheduler가 보유할 수 있는 wave 후보가 먼저 줄어든다.

수정된 모델:

> dynamic `__local` 증가가 총 work-group당 LDS allocation을 늘리고, LDS가 최소 자원 상한이 되면 resident work-group과 wave가 줄 수 있다. 그 결과 latency hiding 여지가 줄어 성능이 낮아질 수 있지만, 실제 영향은 register·work-group limit과 profiler evidence까지 함께 봐야 한다.

---

## 관련 글

- [GPU occupancy: 레지스터와 LDS가 동시에 올라갈 수 있는 wave 수를 정한다]({{< relref "2026-04-13-gpu-occupancy.md" >}})
- [Wavefront 스케줄링과 latency hiding]({{< relref "2026-04-13-wavefront-scheduling-latency-hiding.md" >}})
- [GPU occupancy 100%는 왜 만점이 아닐까]({{< relref "2026-08-09-gpu-fun-fact-occupancy-score.md" >}})

## 관련 용어

- [[local-memory]], [[work-group]], [[wavefront]]
