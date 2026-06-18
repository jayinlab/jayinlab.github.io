---
title: "kernel arg에서 pipeline layout compatibility까지: schema와 value를 분리해서 보기"
date: 2026-06-05
slug: "opencl-kernel-arg-layout-compat-trace"
draft: false
type: "note"
series: "opencl-driver-internals"
tags: ["opencl", "angle", "clspv", "spirv", "vulkan", "descriptor", "pipeline-layout", "driver-dev", "trace-walkthrough", "optimization"]
difficulty: "advanced"
layer: "CL"
---

OpenCL 앱에서는 `clSetKernelArg`로 buffer 하나를 넣고 `clEnqueueNDRangeKernel`을 호출한다.  
하지만 ANGLE/OpenCL-to-Vulkan 경로로 내려가면 driver가 보는 질문은 둘로 갈라진다.

~~~text
schema-level question:
  이 kernel/pipeline은 어떤 set/binding/type/range 규칙을 요구하는가?

value-level question:
  이번 dispatch에서는 그 slot에 어떤 buffer/offset/range 값이 들어왔는가?
~~~

어제는 event wait-list와 cache visibility를 분리했다. 오늘은 그 옆 축인 descriptor/pipeline layout compatibility를 같은 방식으로 분리한다.  
최근 quiz feedback에서 `pipeline layout compatibility`와 `descriptor row correctness`의 차이가 맞긴 했지만 확신이 낮았고, VM/PTE/TLB 쪽은 아직 너무 하위 계층으로 느껴진다는 신호가 있었다. 그래서 오늘은 PM4/VM으로 깊게 내려가기보다 OpenCL/Vulkan 경계에서 확실히 잡아야 하는 계약을 trace로 본다.

## 예제: 같은 kernel, 다른 buffer

아래 kernel은 입력 buffer를 읽고 출력 buffer에 쓴다.

~~~c
__kernel void scale(__global const float *src,
                    __global float *dst,
                    float factor)
{
    int gid = get_global_id(0);
    dst[gid] = src[gid] * factor;
}
~~~

앱은 실행마다 `src`와 `dst`만 바꿀 수 있다.

~~~c
clSetKernelArg(kernel, 0, sizeof(cl_mem), &src_a);
clSetKernelArg(kernel, 1, sizeof(cl_mem), &dst_a);
clSetKernelArg(kernel, 2, sizeof(float), &factor);
clEnqueueNDRangeKernel(queue, kernel, 1, NULL, &global, &local,
                       0, NULL, &event_a);

clSetKernelArg(kernel, 0, sizeof(cl_mem), &src_b);
clSetKernelArg(kernel, 1, sizeof(cl_mem), &dst_b);
clEnqueueNDRangeKernel(queue, kernel, 1, NULL, &global, &local,
                       0, NULL, &event_b);
~~~

host 입장에서는 “같은 kernel에 buffer 값만 바꿨다”가 전부다.  
driver/runtime 입장에서는 **layout schema는 그대로인지**, **descriptor value만 바뀐 것인지**를 먼저 확인해야 한다.

## 1. build/reflection: schema가 만들어진다

OpenCL C가 clspv/SPIR-V 경로를 타면 kernel argument는 shader resource interface로 표현된다. 단순화하면 아래처럼 볼 수 있다.

~~~text
kernel scale
  arg0 src: __global const float*
    -> set=0 binding=0 descriptor_type=storage_buffer access=read

  arg1 dst: __global float*
    -> set=0 binding=1 descriptor_type=storage_buffer access=write

  arg2 factor: float
    -> push-constant-like scalar path or kernarg data
~~~

이 정보로 Vulkan 쪽 `descriptor set layout`과 `pipeline layout` key가 만들어진다.

~~~text
pipeline_layout_key L_scale:
  set 0:
    binding 0 = storage_buffer, count=1, compute-visible
    binding 1 = storage_buffer, count=1, compute-visible
  scalar_range:
    factor bytes
~~~

여기서 중요한 점은 아직 `src_a`, `dst_a` 같은 실제 buffer 값이 없다는 것이다.  
이 단계는 “이 pipeline은 어떤 모양의 resource table을 기대하는가?”를 정한다.

## 2. clSetKernelArg: value가 채워진다

`clSetKernelArg`는 schema를 새로 만드는 호출이 아니다. 대부분의 정상 fast path에서는 이미 정해진 slot에 이번 실행의 값을 채운다.

~~~text
kernel_arg_table for dispatch A:
  arg0 -> cl_mem src_a, offset=0, size=4096
  arg1 -> cl_mem dst_a, offset=0, size=4096
  arg2 -> factor=2.0

descriptor values for dispatch A:
  binding 0 -> VA(src_a), range=4096
  binding 1 -> VA(dst_a), range=4096
~~~

다음 dispatch에서 `src_b`, `dst_b`로 바뀌어도 schema는 그대로일 수 있다.

~~~text
pipeline layout:
  L_scale unchanged

descriptor values for dispatch B:
  binding 0 -> VA(src_b), range=4096
  binding 1 -> VA(dst_b), range=4096
~~~

이게 driver가 좋아하는 경로다. layout compatibility는 유지되고, 실행별 descriptor row만 업데이트된다.

## 3. trace walkthrough: OpenCL enqueue에서 Vulkan bind까지

한 dispatch를 로그처럼 펼치면 아래 순서가 된다.

~~~text
t0 compile/reflection
  kernel=scale
  reflected_interface:
    arg0 -> set0/binding0/storage_buffer/read
    arg1 -> set0/binding1/storage_buffer/write
    arg2 -> scalar bytes
  pipeline_layout_key=L_scale

t1 clSetKernelArg
  arg0=src_a
  arg1=dst_a
  arg2=2.0
  arg_table_generation=31

t2 enqueue
  command=NDRANGE scale
  captures arg_table_generation=31
  global=(4096,1,1), local=(64,1,1)

t3 Vulkan-ish record
  choose pipeline P_scale with layout L_scale
  allocate/update descriptor row D88
    binding0 = src_a VA/range
    binding1 = dst_a VA/range
  compatibility(P_scale.layout, D88.layout) = ok

t4 submit-visible state
  bind pipeline P_scale
  bind descriptor row/table D88
  push/update scalar factor
  dispatch groups=(64,1,1)
~~~

`compatibility(P_scale.layout, D88.layout) = ok`는 schema 검증이다.  
`binding0 = src_a VA/range`는 value 검증이다.

둘 중 하나만 맞아도 충분하지 않다.

## 4. schema mismatch와 value bug는 증상이 다르다

첫 번째 실패는 schema mismatch다.

~~~text
pipeline P_scale expects:
  binding0 = storage_buffer
  binding1 = storage_buffer

descriptor layout D_bad declares:
  binding0 = uniform_buffer
  binding1 = storage_buffer
~~~

이 경우 driver는 같은 `binding0` 번호를 봐도 호환이라고 보면 안 된다. shader가 storage buffer load/store 규칙을 기대하는데 runtime이 uniform buffer 규칙의 descriptor table을 연결하면 ABI가 깨진다.

두 번째 실패는 value bug다.

~~~text
layout compatibility:
  ok

descriptor values:
  binding0 -> src_a VA/range
  binding1 -> old_dst VA/range   // expected dst_a
~~~

이 경우 layout은 맞다. 하지만 이번 dispatch에 들어간 descriptor row 값이 틀렸다.  
validation layer나 driver log가 “layout compatible”만 보여 주면 문제를 놓칠 수 있다.

세 번째 실패는 lifetime/range bug다.

~~~text
layout compatibility:
  ok

descriptor values:
  binding0 -> src_a VA=0x70000000 range=4096
  binding1 -> dst_a VA=0x70001000 range=4096

resource state:
  dst_a released too early or range shorter than shader access
~~~

이것도 schema 문제와 다르다. binding type은 맞고 descriptor row도 의도한 buffer를 가리키지만, buffer lifetime/range가 shader access를 버티지 못한다.

## 5. event wait-list와도 분리된다

이 dispatch가 이전 kernel이 쓴 `src_a`를 읽는다면 event wait-list도 필요하다.

~~~text
descriptor correctness:
  binding0 points to src_a

dependency correctness:
  wait producer_event that writes src_a

visibility correctness:
  producer shader-write is visible to consumer shader-read
~~~

descriptor가 `src_a`를 정확히 가리킨다고 해서 이전 write가 보이는 것은 아니다.  
반대로 wait-list와 cache action이 정확해도 descriptor가 `old_src`를 가리키면 최신 `src_a`를 읽을 수 없다.

그래서 driver trace는 최소한 아래 축을 분리해 남겨야 한다.

~~~text
submit_id=502
kernel=scale
pipeline_layout_key=L_scale
descriptor_layout_key=DL_scale_set0
layout_compat=ok
arg_table_generation=31
descriptor_row=D88
binding0={cl_mem=src_a, va=0x70000000, range=4096, generation=14}
binding1={cl_mem=dst_a, va=0x70001000, range=4096, generation=22}
wait_events=[producer_src_a]
visibility_action=shader_write -> shader_read for src_a
dispatch_groups=(64,1,1)
~~~

이 정도로 나누면 “layout은 맞는데 값이 틀린 문제”와 “값은 맞는데 wait/visibility가 빠진 문제”를 빠르게 갈라낼 수 있다.

## 6. app optimization과 연결되는 지점

앱 개발자는 보통 pipeline layout key를 직접 만지지 않는다. 그래도 성능에는 영향을 준다.

반복 dispatch에서 kernel signature와 argument shape를 자주 흔들면 runtime은 reflection, layout lookup, descriptor allocation/update, pipeline cache key 확인을 더 자주 탄다. 반대로 같은 kernel schema를 유지하고 buffer value만 바꾸면 driver가 fast path를 유지하기 쉽다.

~~~text
good shape for repeated dispatch:
  same kernel interface
  same arg count/type
  same set/binding schema
  changing descriptor values only

expensive shape:
  frequent kernel variants
  changing scalar/resource lowering shape
  changing descriptor layout or push-constant range
  repeated one-off pipeline layout keys
~~~

이 말은 “kernel을 절대 나누지 말라”는 뜻은 아니다. 알고리즘상 필요한 specialization은 할 수 있다. 다만 성능을 볼 때 kernel execution time만 보지 말고 layout/pipeline/descriptor churn 비용도 같이 봐야 한다.

## what this means for driver dev

- `pipeline layout compatibility`는 schema-level 검사로 둔다. set/binding/type/count/stage visibility/scalar range가 같은 계약인지 확인한다.
- `descriptor row correctness`는 value-level 검사로 둔다. 이번 dispatch의 `cl_mem`, VA, offset, range, generation이 의도와 맞는지 확인한다.
- `clSetKernelArg` capture 시점과 enqueue record 시점을 로그에서 분리한다. enqueue가 어떤 arg table generation을 캡처했는지 남긴다.
- layout cache miss와 descriptor value update miss를 같은 “bind 실패”로 뭉개지 않는다. 원인 코드가 달라야 재사용성 문제와 값 버그를 구분할 수 있다.
- event wait-list, cache visibility, descriptor correctness를 같은 validation bit로 합치지 않는다. 각각 ordering, memory visibility, resource binding을 증명한다.
- PM4/command-stream 직전 trace에는 pipeline id, descriptor table pointer, scalar/kernarg pointer, wait/cache action, dispatch packet을 같은 submit id로 묶는다.

## app-facing takeaway

반복 실행에서는 kernel interface를 가능한 안정적으로 유지하고, 자주 바뀌는 것은 buffer value와 scalar value로 제한하는 편이 좋다. 그래야 runtime/driver가 pipeline layout과 descriptor layout을 재사용하기 쉽다.

또 `clFinish`를 추가해도 잘못된 argument binding은 고쳐지지 않는다. 결과가 이상할 때는 먼저 “내가 기다렸는가?”와 “내가 맞는 buffer를 slot에 넣었는가?”를 따로 확인해야 한다.

---

## 관련 글

- [__global 버퍼 하나는 dispatch 직전까지 어떻게 내려가나]({{< relref "2026-06-02-opencl-note-global-buffer-bind-to-dispatch-trace.md" >}})
- [Descriptor/Pipeline Layout 호환 계약: 왜 드라이버는 '같아 보이는 바인딩'도 거절할까]({{< relref "2026-05-11-opencl-note-descriptor-pipeline-layout-compat-contract.md" >}})
- [event wait-list에서 PM4 cache visibility까지: buffer handoff trace]({{< relref "2026-06-04-opencl-note-event-waitlist-cache-visibility-trace.md" >}})
- [OpenCL address space는 어떻게 descriptor 계약이 되나]({{< relref "2026-05-24-opencl-note-address-space-descriptor-contract.md" >}})

## 관련 용어

- [[descriptor-set]], [[pipeline-layout]], [[SPIR-V]], [[command-queue]]
