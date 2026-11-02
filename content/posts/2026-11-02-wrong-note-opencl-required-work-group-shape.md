---
title: "8×8과 16×4는 둘 다 64인데, 드라이버는 왜 거절할까"
date: 2026-11-02
slug: "opencl-required-work-group-shape-is-not-just-product"
draft: false
type: "wrong-note"
series: "opencl-driver-internals"
tags: ["opencl", "angle", "clspv", "spirv", "vulkan", "work-group", "driver-dev"]
difficulty: "advanced"
animation: true
---

64명을 8열 8행으로 앉히든 16열 4행으로 앉히든 사람 수는 같다. 단순히 빈 강당을 채우는 일이라면 둘 다 괜찮다. 그런데 수업 지시가 “같은 행의 오른쪽 사람에게 종이를 넘기세요”라면? 좌석 배치가 수업의 일부가 된다.

GPU도 비슷하다. **GWS를 빠짐없이 덮는다는 사실과, 같은 kernel 실행 의미를 보존한다는 사실은 다르다.** 이번 오답노트는 “총 work-item 수가 같으면 비효율만 감수하고 실행할 수 있지 않을까?”라는 모델에서 출발한다. 답을 오류 코드로 외우는 대신, 무엇이 달라지는지 보자.

여기서 좌석은 `local ID`, 한 교실은 `work-group`이다. 교실의 행·열은 GPU의 물리적 배선이나 wave 배치를 뜻하지 않는다. 비유는 **논리적인 협력 범위**까지만 쓴다.

## 먼저 확정된 코드 사실

아래 소스는 2026-11-02에 확인한 고정 commit이다. 사용 중인 Android 드라이버와 같은 revision이라는 뜻은 아니다.

1. OpenCL C는 `reqd_work_group_size(X,Y,Z)`를 enqueue의 local size로 사용해야 할 크기라고 정의하고, compiler가 이에 맞춰 최적화할 수 있다고 설명한다. `work_group_size_hint`와 같은 단순 힌트가 아니다. [OpenCL_C.txt L3757–3766](https://github.com/KhronosGroup/OpenCL-Docs/blob/0027b7f1a5e97b1bf5256888757479e012a5cb59/OpenCL_C.txt#L3757-L3766)

   > “This allows the compiler to optimize the generated code appropriately for this kernel.”

   한국어로는 “이로써 compiler가 이 kernel에 적합하게 생성 코드를 최적화할 수 있다.” **특정 최적화를 반드시 한다는 보장은 아니다.**

2. OpenCL API는 명시적 local size가 required size와 다르면 `CL_INVALID_WORK_GROUP_SIZE`를 규정한다. [opencl_runtime_layer.asciidoc L12156–12161](https://github.com/KhronosGroup/OpenCL-Docs/blob/0027b7f1a5e97b1bf5256888757479e012a5cb59/api/opencl_runtime_layer.asciidoc#L12156-L12161)

   > “if _local_work_size_ is not `NULL` and if the _local_work_size_ does not match the required work-group size for _kernel_”

   즉 “local size를 명시했고 kernel의 required work-group size와 일치하지 않는 경우”다. 곱이 같은지는 이 조건을 대신하지 않는다.

3. ANGLE은 compile size를 조회한 뒤 각 차원 `i`에서 `compileWorkGroupSize[i] != 0 && local_work_size[i] != compileWorkGroupSize[i]`를 검사하여 위 오류를 반환한다. 총수 상한 검사는 그 뒤 별개다. [validationCL.cpp L2593–2636](https://github.com/google/angle/blob/bff8dbeeb49e0486cef84e216ebd4cc603efdf51/src/libANGLE/validationCL.cpp#L2593-L2636), [L2698–2712](https://github.com/google/angle/blob/bff8dbeeb49e0486cef84e216ebd4cc603efdf51/src/libANGLE/validationCL.cpp#L2698-L2712)

4. ANGLE Vulkan backend는 reflection의 `kernelCompileWorkgroupSize`에 kernel 이름이 있으면 그 세 성분을 `compileWorkGroupSize`에 저장한다. 없으면 `(0,0,0)`이다. API의 `CL_KERNEL_COMPILE_WORK_GROUP_SIZE`도 source/IL에서 지정한 크기, 미지정이면 `(0,0,0)`을 반환한다. [CLKernelVk.cpp L365–378](https://github.com/google/angle/blob/bff8dbeeb49e0486cef84e216ebd4cc603efdf51/src/libANGLE/renderer/vulkan/CLKernelVk.cpp#L365-L378), [API L11511–11518](https://github.com/KhronosGroup/OpenCL-Docs/blob/0027b7f1a5e97b1bf5256888757479e012a5cb59/api/opencl_runtime_layer.asciidoc#L11511-L11518)

5. clspv는 LLVM의 `reqd_work_group_size` metadata를 읽어 reflection의 `PropertyRequiredWorkgroupSize`에 X/Y/Z를 기록한다. 별도의 실행 모드 생성 경로에서는 `BuiltinDimVec.empty()`이고 required metadata가 있으며 non-uniform 옵션이 꺼진 조건에서 `OpExecutionMode … LocalSize X Y Z`를 만든다. 따라서 “항상 literal LocalSize만 찾으면 된다”로 일반화하면 안 된다. [SPIRVProducerPass.cpp L8263–8278](https://github.com/google/clspv/blob/f56e11463cd5c86035a1663fe5a5e0164400fa7b/lib/SPIRVProducerPass.cpp#L8263-L8278), [L3719–3744](https://github.com/google/clspv/blob/f56e11463cd5c86035a1663fe5a5e0164400fa7b/lib/SPIRVProducerPass.cpp#L3719-L3744)

여기까지가 코드/스펙에서 직접 확인한 부분이다. 아래부터는 해석이다.

이하의 숫자·kernel·로그는 계약을 설명하기 위한 예시다. 실제 clspv 산출물이나 AMDGPU 실행 trace를 확보한 결과가 아니다.

## 1. 타일링 계산은 맞다 — 그런데 증명한 것이 하나뿐이다

offset은 0, GWS는 `(32,16)`, 모든 work-group이 full-size인 2D 예시로 고정하자.

| local shape | group count | group당 work-items | 전체 work-items |
|---|---|---|---|
| `(8,8)` | `(4,2)` | 64 | 512 |
| `(16,4)` | `(2,4)` | 64 | 512 |

둘 다 각 축을 정확히 나눈다. non-uniform tail도 없다. 따라서 **“둘 다 GWS를 채운다”는 직관은 옳다.** 다만 이것은 실행량 계산이지 required shape의 호환성 증명은 아니다.

아래 기존 그림은 이 구분의 바탕인 local size와 group count를 보여 준다. **그림의 GWS는 별도 예제 `(64,64)`다.** 특히 `LWS=NULL`에서 8×8 또는 16×4를 선택하는 장면은 **required shape가 지정되지 않은 kernel**로 한정해 읽는다. required 계약을 무시하고 고를 수 있다는 뜻이 아니다. 이번 비교에서는 혼동을 피하려고 local size를 명시한다.

{{< gws_lws_dispatch_anim >}}

정적 요약: `global size = local size × group count`는 이 uniform 예제에서 성립한다. local size는 한 팀의 모양이고 group count는 팀의 개수다. 같은 전체 인원이어도 팀 구성이 같지는 않다.

## 2. global ID 하나를 고정하면 차이가 보인다

uniform·offset 0인 예시에서는 축마다 다음처럼 분해할 수 있다.

```text
global_id[d] = group_id[d] * local_size[d] + local_id[d]
```

global ID `(9,5)`를 보자.

| local shape | group ID | local ID | 그 group이 맡는 global 영역 |
|---|---|---|---|
| `(8,8)` | `(1,0)` | `(1,5)` | x=8..15, y=0..7 |
| `(16,4)` | `(0,1)` | `(9,1)` | x=0..15, y=4..7 |

같은 global 위치를 계산하더라도 **동료 work-item과 local ID가 바뀐다.** `__local` 저장소와 work-group barrier의 협력 범위도 그 group을 따른다. 같은 총수로 포장했다고 같은 계산 단위가 되는 것이 아니다.

반대로 kernel이 오직 `get_global_id`로 독립적인 원소만 처리한다면 두 shape의 출력이 같을 수도 있다. 그것도 옳은 관찰이다. 하지만 **특정 입력·kernel에서 출력이 우연히 같음**과 **API가 그 호출을 유효하게 허용함**은 다른 주장이다.

## 3. compiler는 무엇을 믿을 수 있을까

다음 kernel은 8×8 교실을 전제로 한다.

<details>
<summary>전체 코드 보기 — row_neighbor.cl</summary>

```c
__attribute__((reqd_work_group_size(8, 8, 1)))
__kernel void row_neighbor(__global const float *in,
                           __global float *out,
                           uint width)
{
    __local float tile[8][8];
    size_t x = get_global_id(0);
    size_t y = get_global_id(1);
    size_t lx = get_local_id(0);
    size_t ly = get_local_id(1);
    tile[ly][lx] = in[y * width + x];
    barrier(CLK_LOCAL_MEM_FENCE);
    out[y * width + x] = tile[ly][(lx + 1) & 7];
}
```

</details>

예제 조건은 GWS `(32,16)`, `width=32`, 입력·출력 각각 512 floats, 서로 겹치지 않는 두 buffer다. local size `(8,8)`에서는 각 work-item이 자기 slot을 쓴 뒤 모두 barrier를 통과하고, 같은 행에서 오른쪽 slot을 읽는다. 행 끝은 그 **8칸짜리 행 내부**에서 wrap한다. image 전체의 오른쪽 이웃 연산은 아니다.

여기에 `(16,4)`를 **억지로 실행한다고 가정**하면 `lx=8..15`가 존재한다. `tile[ly][lx]`는 선언한 행의 범위를 벗어난다. API를 지킨 구현은 이 invalid enqueue를 먼저 거절하므로, 이 상황에서 어떤 GPU 출력이 나올지 예측하는 것이 목표가 아니다. 이 반례는 runtime이 shape를 임의로 바꿀 때 source의 가정까지 깨질 수 있음을 보여 준다.

compiler는 required shape로부터 local ID 범위나 `get_local_size` 값을 활용할 수 있다. 상수 전파·주소 계산 단순화 등은 **가능한 해석**이지 이 예제에서 실제 발생했다고 확인한 사실은 아니다. 이를 확정하려면 해당 옵션의 IR·SPIR-V·backend 산출물을 비교해야 한다.

중요한 순서는 이렇다.

- 먼저 source가 required shape라는 약속을 건다.
- compiler와 runtime이 그 약속을 사용할 수 있다.
- runtime은 “이번에는 최적화를 안 한 것 같으니 다른 shape도 허용”이라고 계약을 완화하지 않는다.

## 4. 그러면 driver가 알아서 고쳐 주면 안 될까

**물리적 실행을 재배치하는 일**과 **OpenCL에 보이는 논리 shape를 바꾸는 일**을 나누면 답이 쉬워진다.

8×8의 논리 group을 하드웨어에서 wave32 두 개 또는 wave64 하나로 실행하는 것은 가능한 backend 모델이다. 실제 wave mode는 target과 compiler 선택을 확인해야 한다. 어느 쪽이든 앱에 보이는 local ID와 group의 공유·동기화 의미는 보존해야 한다. required `(8,8,1)`은 wave64 강제 선언이 아니다.

반면 supplied `(16,4,1)`을 그대로 받아들이는 것은 논리 shape 변경이다. runtime이 몰래 `(8,8,1)`로 되돌리면 이번에는 앱이 요청한 다른 local shape를 실행한 셈이 된다. 이 API는 불일치를 그런 방식으로 조정하라고 하지 않고 오류로 규정한다.

“compiler가 다른 shape용 코드를 다시 만들면?”이라는 질문도 가능하다. required 선언을 바꾸어 **별도 variant를 build하고 그 variant의 올바른 shape로 enqueue**하는 설계는 할 수 있다. 하지만 kernel 내부의 고정 배열·이웃 관계가 새 shape에서도 맞는지 검토해야 한다. 기존 required kernel에 대한 invalid 호출을 조용히 성공시키는 것과는 별개의 작업이다.

required가 없는 kernel의 local-size 선택, specialization을 활용하는 구현의 pipeline variant 선택도 별도 문제다. 둘을 required 계약을 우회하는 근거로 쓰지 않는다.

## 5. ANGLE → clspv/SPIR-V → Vulkan → AMD에서 무엇을 확인할까

이번에 읽은 코드로 만들 수 있는 **추적 체크리스트**다. end-to-end 실측을 완료했다는 선언이 아니다.

```text
OpenCL enqueue: requested local shape (16,4,1)
    vs CL_KERNEL_COMPILE_WORK_GROUP_SIZE (8,8,1)
ANGLE validation: dimension mismatch → CL_INVALID_WORK_GROUP_SIZE
    ↓ valid enqueue인 경우에만 이후 기록을 추적
clspv: required-size reflection / actual workgroup-size representation
Vulkan: selected entry point / pipeline specialization / dispatch group count
AMD backend: actual workgroup state / wave mode / resource usage
PM4: that target's command trace, if obtained
```

driver 개발에서 첫 로그는 “64명인가?”보다 다음 두 tuple이어야 한다.

```text
requested_local = (16,4,1)
compiled_required = (8,8,1)
validation_result = CL_INVALID_WORK_GROUP_SIZE
```

그다음 source attribute → clspv reflection → ANGLE compile-size query가 같은 세 성분인지 확인한다. source만 보고 Vulkan shader가 정확히 어떤 실행 모드로 나왔다고 단정하지 않는다. 위 clspv 코드에도 조건 분기가 있다.

Vulkan 쪽에서는 **shader local size와 dispatch group count를 별개로 읽는다.** `(4,2,1)`이라는 dispatch count를 보고 local size까지 `(4,2,1)`이라고 읽으면, 교실 크기와 교실 개수를 다시 섞게 된다. specialization이 관여한다면 SPIR-V만 아니라 pipeline 생성 시 적용된 값도 확인한다.

이번 글에서는 사용자의 Android 빌드·Vulkan capture·AMD ISA·PM4를 확보하지 못했다. 따라서 이 오류가 어떤 PM4 field를 만들었다거나, wave mode·VGPR·LDS 수치가 얼마였다고 쓰지 않는다. frontend validation에서 거절된 호출을 곧바로 AMD scheduler 문제로 보내지도 않는다.

## 6. 오답 모델을 닫는 한 문장

- **처음 모델:** 총 work-item 수가 같고 GWS를 채우면, shape 차이는 성능 문제일 뿐이다.
- **충돌한 사실:** local shape가 바뀌면 local ID·group 구성·공유 범위가 바뀐다. required shape의 불일치는 API상 오류다.
- **수정 모델:** GWS 타일링은 실행량의 조건이고, required shape는 compiler와 runtime이 지키는 차원별 실행 계약이다.

외울 것은 “8×8을 16×4로 바꾸면 X”가 아니다. **총수는 일을 얼마나 하는지 말하고, shape는 누구와 어떤 좌표로 협력하는지 말한다.** 둘 다 64라는 사실은 전자를 설명하지만 후자를 보존하지 않는다.

## 이어서 읽기

- [GWS/LWS가 Vulkan Dispatch로 내려갈 때]({{< relref "2026-04-21-opencl-note-gws-lws-to-vulkan-dispatch.md" >}})
- [non-uniform tail은 초과 invocation을 지우는 문제가 아니다]({{< relref "2026-10-05-wrong-note-non-uniform-tail-regions.md" >}})
