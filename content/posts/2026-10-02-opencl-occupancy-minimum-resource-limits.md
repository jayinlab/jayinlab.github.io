---
title: "LDS를 줄였는데 왜 occupancy가 그대로일까 — residency는 최소값이 정한다"
date: 2026-10-02
slug: "opencl-occupancy-minimum-resource-limits"
draft: false
type: "note"
series: "opencl-deep-dive"
tags: ["opencl", "occupancy", "residency", "lds", "vgpr", "sgpr", "angle", "clspv", "vulkan", "amd"]
difficulty: "advanced"
---

오늘의 OX 문제부터 바로 채점하자.

> 한 CU에서 LDS 용량은 work-group 8개를 허용하지만 VGPR 사용량은 2개만 허용할 때, dynamic `__local`을 줄여 LDS 여유를 더 만들면 resident work-group 수는 8개가 된다.

**정답은 X다.** LDS 기준 좌석은 8개여도 VGPR 검문소가 2개만 통과시키므로 실제 상한은 `min(8, 2, ...) = 2`다. `__local`을 더 줄이면 이미 넉넉했던 LDS 좌석만 늘어난다. VGPR 병목을 그대로 둔 채 8개가 되지는 않는다.

이 글의 핵심은 “LDS도 중요하고 register도 중요하다”가 아니다. 더 정확한 문장은 이것이다.

> 각 자원이 허용하는 residency 상한을 같은 단위로 바꿔 놓고, 그중 **최소값**을 찾는다. 최적화로 현재 병목을 풀면 끝나는 것이 아니라, 그다음으로 작은 상한이 새 병목이 된다.

## ELI5: 놀이공원 입장은 가장 좁은 검문소가 정한다

한 팀이 놀이기구를 타기 전에 다섯 검문소를 차례로 지난다고 해 보자.

- 사물함(LDS)은 8팀분이 비어 있다.
- 개인 장비 보관함(VGPR)은 2팀분만 남았다.
- 공용 서류함(SGPR)은 6팀분이 가능하다.
- 대기 레일(wave slot)은 5팀분이다.
- 안전 규정상 동시 입장(work-group slot)은 4팀까지다.

“사물함이 8팀분이니 8팀 입장!”이라고 할 수 없다. 다섯 곳을 **모두** 통과해야 하므로 입장 가능한 팀 수는 다음과 같다.

~~~text
resident work-groups <= min(8, 2, 6, 5, 4) = 2
                         LDS VGPR SGPR wave WG
~~~

여기서 LDS 사물함을 정리해 12팀분으로 늘려도 결과는 같다.

~~~text
resident work-groups <= min(12, 2, 6, 5, 4) = 2
~~~

가장 좁은 VGPR 검문소가 그대로이기 때문이다. 오늘 퀴즈는 바로 이 상황이다.

## 정확한 모델: 먼저 단위를 work-group으로 맞춘다

실제 hardware 제한은 처음부터 모두 “work-group 몇 개” 형태로 주어지지 않는다. LDS는 보통 work-group 단위로 예약되지만, register와 wave slot은 wave 단위 제한으로 나타날 수 있다. 그래서 먼저 한 work-group이 몇 wave인지 계산하고 각 제한을 work-group 상한으로 환산해야 한다.

~~~text
waves_per_work_group = ceil(local_work_size / wave_size)

L_LDS   = floor(available_LDS / allocated_LDS_per_work_group)
L_VGPR  = floor(VGPR_limited_waves / waves_per_work_group)
L_SGPR  = floor(SGPR_limited_waves / waves_per_work_group)
L_wave  = floor(hardware_wave_slots / waves_per_work_group)
L_WG    = hardware_work_group_slots
L_items = floor(hardware_work_item_limit / local_work_size)

resident_work_groups
  <= min(L_LDS, L_VGPR, L_SGPR, L_wave, L_WG, L_items, ...)
~~~

이 식은 **개념식**이다. 실제 계산에는 architecture별 CU/WGP/SIMD 회계 범위, wave32/wave64, VGPR·SGPR·LDS allocation granularity, register file partition, work-group placement 규칙이 들어간다. 나눗셈 결과가 2.9라고 register를 0.9팀분 빌릴 수도 없다. allocation block과 배치 제약 때문에 더 일찍 내림될 수 있다.

또 하나 조심할 점이 있다. AMD RDNA 계열 설명에서는 LDS가 WGP에 속하고 VGPR는 SIMD 관점으로 설명되는 등 자원별 회계 범위가 다를 수 있다. 따라서 “CU당 64 KiB, wave slot 16개” 같은 숫자를 세대 구분 없이 섞어 계산하면 그럴듯하지만 틀린 표가 된다. 이 글의 수치는 최소값 관계를 보여 주는 **가상 예제**이며, 실제 숫자는 target GPU와 compiler/driver 결과를 확인해야 한다.

## 병목을 하나씩 줄이면 무슨 일이 생길까

아래 표에서 각 칸은 해당 자원만 보았을 때 허용되는 resident work-group 상한이다.

| 실험 | LDS | VGPR | SGPR | wave slot | WG slot | 실제 상한 | 해석 |
|---|---:|---:|---:|---:|---:|---:|---|
| A. 시작 | 8 | **2** | 6 | 5 | 4 | **2** | VGPR가 첫 병목 |
| B. dynamic `__local` 축소 | 12 | **2** | 6 | 5 | 4 | **2** | LDS만 더 넉넉해짐 |
| C. B + VGPR pressure 완화 | 12 | 6 | 6 | 5 | **4** | **4** | 이제 WG slot이 병목 |
| D. C + WG slot 여유 | 12 | 6 | 6 | **5** | 8 | **5** | 이제 wave slot이 병목 |
| E. D + wave 제한 완화 가능 조건 | 12 | **6** | **6** | 8 | 8 | **6** | VGPR와 SGPR가 공동 병목 |

이 표의 중요한 부분은 숫자가 계단식으로 움직인다는 점이다. 한 자원을 조금 줄였다고 residency가 매 byte, 매 register마다 부드럽게 증가하지 않는다. 다음 allocation 경계를 넘어야 한 단계 오르고, 곧 다음 최소값에 부딪힌다.

~~~text
상한
12 ┤ LDS ─────────────────────────────
 8 ┤                         wave/WG ─
 6 ┤                         VGPR/SGPR
 5 ┤                 wave ───┘
 4 ┤         WG ─────┘
 2 ┤ VGPR ───┘
   └──────────────────────────────────
      A       B       C       D       E
~~~

그래서 profiler가 “LDS를 4 KiB 줄였다”고 알려 주는 것만으로는 성능 변화를 예측할 수 없다. 그 감소가 LDS 상한의 정수 경계를 넘었는지, 그리고 LDS가 애초에 최소값이었는지를 함께 봐야 한다.

## `clSetKernelArg(size, NULL)`에서 AMD 자원까지

재희님의 Android + AMDGPU 맥락에서는 source 한 줄과 최종 residency 사이를 여러 층으로 나눠 보는 편이 안전하다.

~~~text
OpenCL host API
  clSetKernelArg(kernel, i, size, NULL)
        │
        ▼
OpenCL kernel state
  i번 __local pointer argument에 work-group당 size bytes 요구
        │
        ▼
clspv
  descriptor가 아니라 SPIR-V Workgroup 배열
  배열 길이는 specialization constant, reflection에 elem size/spec ID 기록
        │
        ▼
ANGLE Vulkan backend
  arg size 저장 → element 수 계산 → VkSpecializationInfo에 값 제공
        │
        ▼
Vulkan compute pipeline / target backend
  target ISA와 VGPR·SGPR·LDS 등 최종 자원 사용량 결정
        │
        ▼
AMD GPU dispatch
  LDS·VGPR·SGPR·wave/WG slot 중 최소 제한으로 resident wave/WG 상한 형성
~~~

### 1. OpenCL 계약: `NULL`은 빈 포인터가 아니라 local allocation 요청이다

Khronos OpenCL specification은 `__local` pointer argument에 대해 다음과 같이 말한다.

> “`arg_value` must be `NULL`, and `arg_size` specifies the amount of local memory in bytes that are allocated for the kernel argument.”

한국어로 풀면, `clSetKernelArg(kernel, i, size, NULL)`의 `NULL`은 “아무것도 전달하지 않는다”는 뜻이 아니다. `i`번 argument가 가리킬 work-group-local storage를 `size` byte만큼 요구한다는 뜻이다. 이 storage는 work-group마다 별도로 필요하다.

또 `CL_KERNEL_LOCAL_MEM_SIZE`는 dynamic argument만 세는 값이 아니다. specification은 kernel 내부의 static `__local` 변수, dynamic `__local` pointer argument, 구현에 필요한 local memory까지 포함한다고 명시한다. source에서 넘긴 `size` 하나와 최종 합계가 다를 수 있는 이유다.

### 2. clspv: 일반 buffer descriptor가 아니라 `Workgroup` storage다

현재 clspv 문서는 pointer-to-local argument를 descriptor로 만들지 않고, SPIR-V `Workgroup` storage class의 배열로 매핑한다고 명시한다. 배열 길이는 integer specialization constant이며, reflection에는 element size와 그 specialization ID가 기록된다.

예를 들어 `__local float *scratch`에 4096 byte를 설정했다면 `float` 1024개에 해당한다. clspv/ANGLE 경로에서는 이 element 수가 pipeline specialization 정보가 되어 `Workgroup` 배열 크기를 정할 수 있다. 이것은 `__global` buffer처럼 device address와 range를 descriptor에 넣는 경로와 다르다.

### 3. 현재 ANGLE 구현: 크기를 저장하고 pipeline specialization으로 연결한다

ANGLE `main`의 2026-10-02 확인 revision에서 Vulkan backend는 `ArgumentWorkgroup` argument의 `argSize`를 저장한다. compute pipeline을 얻거나 만들 때는 `argSize / elementSize`를 계산해 clspv reflection이 지정한 constant ID의 `VkSpecializationInfo` 값으로 넣는다.

즉 이 경로에서는 dynamic `__local` 크기가 단순 dispatch-time byte count로 hardware에 바로 전달되는 것이 아니라, **specialized compute pipeline의 Workgroup 배열 크기**로 연결된다. 크기가 달라지면 pipeline cache key/variant와 backend compilation 결과가 달라질 수 있다.

다만 이것은 오늘 확인한 ANGLE/clspv revision의 구현 경로다. OpenCL specification이 모든 구현에 ANGLE, clspv, SPIR-V specialization constant 사용을 강제하는 것은 아니다. 다른 OpenCL runtime은 전혀 다른 IL·compiler·dispatch ABI를 쓸 수 있다.

### 4. Vulkan backend와 AMDGPU: 최종 숫자는 여기서 확정된다

Vulkan driver/backend는 specialized SPIR-V를 target AMD ISA로 내리면서 live range, instruction selection, wave mode 등에 따라 VGPR·SGPR 사용량을 결정하고 Workgroup storage를 hardware LDS 요구량으로 반영한다. source의 변수 개수만 세어 VGPR를 맞힐 수 없는 이유다. inline, unroll, common-subexpression elimination, address calculation 하나로도 register pressure가 바뀔 수 있다.

AMD GPUOpen은 theoretical occupancy에 VGPR, SGPR, LDS와 compute threadgroup size가 함께 작용한다고 설명한다. RGA는 ISA, register pressure, LDS/scratch usage를 보여 줄 수 있고, RGP의 pipeline view는 theoretical occupancy와 limiting resource를 확인하는 데 쓰인다.

Android의 실제 제품 stack에서는 RGA/RGP나 ROCm code-object metadata를 그대로 쓸 수 없을 수 있다. 그 경우에도 증거의 종류는 같다. 해당 Vulkan backend가 남기는 pipeline executable 통계, internal compiler resource report, shader binary/disassembly, driver dump에서 **target-specific VGPR·SGPR·LDS·scratch·wave mode**를 찾는다. AMD-specific field 이름과 정확한 allocation 단위는 architecture와 toolchain에 따라 달라진다.

## Occupancy, latency hiding, ALU utilization은 같은 말이 아니다

세 용어를 한 문장으로 뭉치면 진단이 뒤집힌다.

1. **Theoretical residency/occupancy 상한**은 자원 예산상 동시에 resident할 수 있는 wave 수의 한계다.
2. **Measured occupancy**는 실행 중 실제로 resident했던 wave 수다. dispatch가 너무 작거나 launch가 충분히 빠르지 않으면 이론 상한보다 낮을 수 있다.
3. **ALU utilization/activity**는 관측 구간에 ALU가 얼마나 일했는지를 나타내는 별도 실행 지표다.

resident wave가 많으면 memory latency를 기다리는 wave 대신 ready wave를 고를 가능성이 커진다. 이것이 occupancy와 latency hiding의 연결이다. 하지만 이것은 “wave가 많아지면 ALU lane 수가 늘어난다”는 뜻이 아니다. 물리 ALU는 그대로이고 scheduler가 고를 후보가 늘어나는 것이다.

그리고 occupancy가 높다고 항상 빠르지도 않다.

- 이미 ALU가 충분히 바쁘고 latency-bound가 아니라면 wave를 더 올려도 이득이 작다.
- LDS tiling을 줄여 occupancy를 높였지만 global-memory traffic이 늘면 오히려 느려질 수 있다.
- VGPR를 억지로 줄여 더 많은 wave를 올리다가 spill이 생기면 scratch traffic 때문에 느려질 수 있다.
- wave가 많아져 cache working set이 커지면 cache thrashing이 심해질 수 있다.
- occupancy가 낮아도 ILP가 충분하거나 cache hit가 좋으면 빠를 수 있다.

그래서 목표는 “occupancy 100%”가 아니라 **현재 latency를 숨길 만큼의 ready wave를 확보하면서, 그 대가로 생기는 spill·traffic·recomputation을 최소화하는 것**이다.

## dispatch dimensions만으로 residency를 증명할 수 없는 이유

`global_work_size = 1,048,576`, `local_work_size = 256`이면 총 work-group은 많다. 이것은 GPU에 공급할 **전체 일감**이 충분하다는 증거일 수는 있다. 하지만 한 CU/WGP에 동시에 몇 group이 resident하는지는 알려 주지 않는다.

같은 NDRange라도 다음 두 kernel은 다를 수 있다.

~~~text
Kernel A: 256 work-items/WG, 8 KiB LDS, 40 VGPR/lane
Kernel B: 256 work-items/WG, 8 KiB LDS, 120 VGPR/lane
~~~

dispatch dimensions와 LDS가 같아도 B는 VGPR 때문에 더 적은 wave만 resident할 수 있다. 반대로 총 work-group이 몇 개 안 되면 자원 상한은 높아도 measured occupancy를 채울 일감이 없다.

즉 다음 둘은 별도 질문이다.

~~~text
일감이 충분한가?       <- global/local dispatch dimensions
동시에 몇 개가 사는가? <- compiled resource usage + target hardware limits
~~~

## 실제 진단 순서

### 1. 비교 조건을 먼저 고정한다

- target GPU와 driver build
- ANGLE/clspv revision과 build options
- input, global/local size, wave mode
- warm-up, clock/DVFS 조건

조건이 달라지면 occupancy 변화처럼 보이는 cache·clock·pipeline compilation 효과가 섞인다.

### 2. OpenCL 층의 요청량을 기록한다

- 각 `clSetKernelArg(..., size, NULL)`의 index와 byte 수
- static `__local` 선언
- `CL_KERNEL_LOCAL_MEM_SIZE`
- `CL_KERNEL_WORK_GROUP_SIZE`, local work size

여기서는 “application이 무엇을 요청했는가”를 확정한다. 아직 hardware residency를 확정하는 단계가 아니다.

### 3. clspv/SPIR-V/ANGLE 연결을 확인한다

- clspv reflection의 `ArgumentWorkgroup`, element size, specialization ID
- specialized element count가 `arg_size / element_size`와 맞는지
- local size와 dynamic-local 크기가 원하는 pipeline variant/key에 들어갔는지
- SPIR-V `Workgroup` variable과 specialization constant

여기서는 OpenCL argument가 descriptor로 잘못 취급되지 않았는지, byte와 element count가 어긋나지 않았는지 본다.

### 4. 최종 compiler 결과를 본다

- target ISA/disassembly
- allocated VGPR/SGPR
- LDS 또는 workgroup storage bytes
- scratch/spill
- wave32/wave64
- kernel의 work-group size 관련 metadata

source-level 추정 대신 **최종 pipeline variant**의 값을 써야 한다. register 사용량은 backend 최적화 뒤에 확정되기 때문이다.

### 5. architecture에 맞는 calculator로 자원별 상한을 각각 계산한다

~~~text
LDS limit   = ? work-groups
VGPR limit  = ? waves -> ? work-groups
SGPR limit  = ? waves -> ? work-groups
wave limit  = ? waves -> ? work-groups
WG/item limit = ? work-groups
minimum     = ? work-groups
~~~

여기서 최소값과 공동 최소값을 표시한다. LDS만 바꾼 A/B variant에서 minimum이 계속 VGPR 2라면, residency가 그대로인 것이 정상이다.

### 6. runtime counter로 “상한”과 “실제”를 분리한다

- active/resident waves 또는 measured occupancy
- limiting-resource/pipeline statistics
- VALU activity 또는 issue activity
- memory dependency/stall, cache miss, bandwidth
- kernel duration

theoretical occupancy가 올랐는데 measured occupancy가 그대로라면 dispatch가 작거나 launch/overlap 조건이 제한할 수 있다. measured occupancy가 올라도 시간이 그대로라면 latency가 이미 충분히 가려졌을 수 있다. 시간이 악화됐다면 spill, traffic, cache behavior를 다시 본다.

### 7. 한 축씩 sweep하되 계단 경계를 찾는다

dynamic `__local`을 32, 28, 24, 20 KiB처럼 줄이고 각 variant의 **최종 LDS allocation과 minimum limit**을 기록한다. 이어서 compiler option이나 source 변형으로 VGPR pressure를 바꾸되 spill도 함께 기록한다. 목적은 가장 낮은 숫자를 무작정 줄이는 것이 아니라, 어떤 threshold에서 어떤 병목이 다음 병목으로 넘어가는지 확인하는 것이다.

## 비유의 한계

놀이공원 검문소 비유는 “여러 독립 상한 중 최소값”을 기억하는 데는 좋다. 하지만 실제 GPU 자원은 표의 정수처럼 완전히 독립적이지 않다.

- local size가 바뀌면 work-group당 wave 수가 바뀌어 wave slot과 register 상한의 환산값도 함께 바뀐다.
- wave32/wave64 선택은 register 요구량과 slot 계산을 바꿀 수 있다.
- compiler 변형으로 VGPR를 줄이면 instruction 수나 scratch traffic이 늘 수 있다.
- LDS allocation과 work-group placement 범위는 architecture별 CU/WGP 구조에 묶인다.
- theoretical limit은 실행 중 ready 상태, dependency, cache miss, dispatch overlap을 말해 주지 않는다.

검문소는 서로 가만히 있지만 GPU 최적화에서는 한 검문소를 넓히다가 다른 검문소의 짐이 늘기도 한다. 그래서 마지막 판정은 언제나 target-specific compiler evidence와 runtime measurement가 함께 내려야 한다.

## 한 줄로 다시 풀기

~~~text
dynamic __local 감소
  -> LDS 기준 상한은 커질 수 있음
  -> 그러나 실제 residency = 모든 자원 상한의 minimum
  -> VGPR 기준 2가 남아 있으면 min(더 큰 LDS, 2, ...) = 2
  -> occupancy가 늘지 않을 수 있음
  -> 늘더라도 성능 향상은 latency/stall/traffic 측정으로 별도 확인
~~~

오늘 퀴즈의 X는 단순히 “VGPR도 봐야 한다”는 답이 아니다. **자원 최적화는 한 숫자를 줄이는 일이 아니라, 최소값이 어느 자원에서 다음 자원으로 이동하는지 추적하는 일**이라는 뜻이다.

## 1차 자료와 구현 근거

- [Khronos OpenCL Specification — `clSetKernelArg`](https://registry.khronos.org/OpenCL/specs/unified/html/OpenCL_API.html#clSetKernelArg): `__local` pointer argument의 `arg_value == NULL`, `arg_size` allocation 계약.
- [Khronos OpenCL Specification — `CL_KERNEL_LOCAL_MEM_SIZE`](https://registry.khronos.org/OpenCL/specs/unified/html/OpenCL_API.html#clGetKernelWorkGroupInfo): static/dynamic/implementation local-memory 합계의 query 정의.
- [Khronos OpenCL Specification — Memory Regions](https://registry.khronos.org/OpenCL/specs/unified/html/OpenCL_API.html#memory-regions): local memory는 한 work-group에 local하며 그 work-group의 work-item들이 공유한다.
- [clspv — OpenCL C on Vulkan](https://github.com/google/clspv/blob/8cffac9f97795ce7cc4e3447baa9284bfb9a824f/docs/OpenCLCOnVulkan.md#descriptor-allocation-and-data-transfer): pointer-to-local argument를 descriptor가 아닌 specialization-sized SPIR-V `Workgroup` 배열로 내리는 규칙.
- [ANGLE `CLKernelVk.cpp` at `4ca72bdf`](https://github.com/google/angle/blob/4ca72bdf5bc0f9334d1a62b3c10529631d8fc67b/src/libANGLE/renderer/vulkan/CLKernelVk.cpp#L253-L323): Workgroup argument의 `argSize` 저장.
- [ANGLE `CLKernelVk.cpp` at `4ca72bdf`](https://github.com/google/angle/blob/4ca72bdf5bc0f9334d1a62b3c10529631d8fc67b/src/libANGLE/renderer/vulkan/CLKernelVk.cpp#L405-L487): local argument element 수를 `VkSpecializationInfo`에 연결하고 compute pipeline을 얻거나 만드는 경로.
- [AMD GPUOpen — Occupancy explained](https://gpuopen.com/learn/occupancy-explained/): VGPR·SGPR·LDS·threadgroup size, theoretical/measured occupancy, latency hiding, limiting-resource 진단.
- [AMD GPUOpen — Radeon GPU Analyzer](https://gpuopen.com/rga/): target ISA, register pressure, LDS/scratch usage와 OpenCL source correlation.
- [AMD GPUOpen — Live VGPR Analysis](https://gpuopen.com/learn/live-vgpr-analysis-radeon-gpu-analyzer/): ISA control-flow 기반 live VGPR와 allocated VGPR 분석 방법.

## 관련 글

- [dynamic __local이 느려진 이유: ALU가 아니라 LDS residency부터 본다]({{< relref "2026-09-28-wrong-note-dynamic-local-lds-residency.md" >}})
- [Occupancy — CU 슬롯을 얼마나 채웠나]({{< relref "2026-04-13-gpu-occupancy.md" >}})
- [GPU register는 왜 개인 수첩이면서 공동 예산일까]({{< relref "2026-08-05-gpu-fun-fact-register-budget.md" >}})

## 관련 용어

[[occupancy]], [[local-memory]], [[work-group]], [[wavefront]], [[clspv]], [[SPIR-V]], [[ANGLE]]
