---
title: "dispatch 전에 page table과 residency 순서를 고정하기"
date: 2026-05-29
slug: "opencl-page-table-residency-ordering"
draft: false
type: "note"
series: "opencl-driver-internals"
tags: ["opencl", "vulkan", "driver-dev", "gpu-vm", "residency", "pm4", "descriptor", "debugging"]
difficulty: "advanced"
layer: "OpenCL -> Vulkan -> UMD/KMD -> PM4"
---

최근 노트에서는 한 dispatch 주변의 문제를 여러 축으로 나눴다.

- descriptor/state contract가 맞는가
- cache visibility가 맞는가
- event/fence completion이 맞는가
- GPU VA와 residency가 맞는가

오늘은 그중 네 번째 축을 더 좁혀 본다. 특히 아래 질문이다.

> descriptor가 가리키는 GPU VA가 dispatch 시점에 실제로 접근 가능한 page table/residency 상태인가?

이 질문은 descriptor validation과 비슷해 보이지만 다르다. descriptor는 "shader가 어느 VA range를 읽고 쓸지"를 말한다. page table/residency는 "그 VA가 GPU가 접근할 수 있는 물리 backing과 lifetime을 갖고 있는지"를 말한다.

간단히 말하면 descriptor가 맞아도 page table update가 늦거나 BO가 resident가 아니면 VM fault가 날 수 있다.

~~~text
clSetKernelArg(buffer)
  -> descriptor record contains VA/range
  -> BO must be bound into GPU VM
  -> page table update must be visible to GPU page walker
  -> BO must remain resident until dispatch completes
  -> PM4 dispatch can safely run
~~~

## 작은 예제: descriptor는 맞는데 dispatch가 fault 나는 경우

앱 코드는 평범하다.

~~~c
clSetKernelArg(kernel, 0, sizeof(cl_mem), &in_buf);
clSetKernelArg(kernel, 1, sizeof(cl_mem), &out_buf);
clEnqueueNDRangeKernel(queue, kernel, 1, NULL, &global, &local, 0, NULL, &evt);
~~~

OpenCL runtime이나 ANGLE/OpenCL frontend는 kernel arg table을 채운다. clspv/SPIR-V reflection을 통해 in_buf, out_buf는 storage buffer binding으로 내려간다.

~~~text
arg0 in_buf  -> set=0 binding=0 storage_buffer read
arg1 out_buf -> set=0 binding=1 storage_buffer write
~~~

descriptor record도 겉으로는 정상일 수 있다.

~~~text
descriptor_records:
  binding0 arg0 in_buf  bo=81 va=[0x81000000,0x81400000) status=ok
  binding1 arg1 out_buf bo=82 va=[0x82000000,0x82400000) status=ok
~~~

하지만 GPU fault log가 이렇게 나온다면 이야기가 달라진다.

~~~text
fault:
  submit=144 engine=compute0 vmid=5
  fault_va=0x82001040 access=write reason=page_not_present
  last_completed_fence=990
  submitted_fence=991
~~~

fault_va=0x82001040은 out_buf descriptor range 안에 있다. 그러면 descriptor range mismatch보다는 page table/residency 쪽을 먼저 의심해야 한다.

가능한 원인은 여러 개다.

- out_buf BO가 dispatch 전에 GPU VM에 bind되지 않았다.
- bind는 했지만 page table update가 GPU page walker에 보이도록 flush/invalidate되지 않았다.
- KMD가 BO를 resident로 고정하기 전에 UMD가 dispatch를 제출했다.
- eviction이나 lifetime release가 fence completion보다 먼저 일어났다.
- VMID/context 전환에서 올바른 page table root가 쓰이지 않았다.

중요한 점은 이것이다. fault VA가 descriptor range 안에 있다는 사실만으로 shader bug라고 결론 내리면 안 된다. 그 주소가 GPU VM에서 실제로 valid였는지 따로 증명해야 한다.

## dispatch 전 ordering을 trace로 남기기

좋은 driver trace는 descriptor와 VM/residency를 같은 submit id로 묶는다.

~~~text
submit=144 queue=Q0 engine=compute0 kernel=write_out event=E220 fence_seq=991

descriptor_records:
  binding0 in_buf  bo=81 va=[0x81000000,0x81400000) access=read  status=ok
  binding1 out_buf bo=82 va=[0x82000000,0x82400000) access=write status=ok

vm_residency:
  bo=81 vm_bind_seq=4501 resident_seq=771 status=resident
  bo=82 vm_bind_seq=4502 resident_seq=772 status=resident
  pt_update_batch=209
  pt_flush_done=true
  vmid=5 page_table_root=0x0012_3400

pm4:
  wait_residency submit_deps=[771,772]
  wait_vm_update batch=209
  set_descriptor_base packet=61
  dispatch_direct packet=74
  fence_write seq=991 packet=88
~~~

여기서 driver가 확인하고 싶은 invariant는 아래다.

~~~text
BO bind/residency decision
  -> page table update emitted
  -> page table update visible to GPU page walker
  -> descriptor base / resource descriptor points at that VA
  -> dispatch
  -> fence/event completion
  -> residency release may happen after completion
~~~

descriptor_records만 있으면 shader가 어떤 주소를 쓰려 했는지는 알 수 있다. 하지만 vm_residency가 없으면 그 주소가 접근 가능했는지는 모른다.

반대로 VM bind log만 있고 descriptor mapping이 없으면 fault VA를 OpenCL arg로 되돌리기 어렵다. 둘은 같이 있어야 한다.

## stale descriptor, stale cache, invalid VA를 분리하기

오늘 주제에서 가장 헷갈리는 부분은 세 증상이 모두 "값이 이상하다" 또는 "dispatch가 실패했다"처럼 보일 수 있다는 점이다.

| 증상 | 먼저 볼 축 | 대표 로그 |
|---|---|---|
| shader가 엉뚱한 buffer를 읽음 | stale descriptor/state | descriptor generation, descriptor base, binding metadata |
| consumer가 이전 값을 읽음 | stale cache/visibility | release/acquire, flush/invalidate, fence 위치 |
| GPU fault가 남 | invalid/non-resident VA | fault VA, VM bind, PTE, residency, BO lifetime |

예를 들어 out_buf가 이전 allocation의 VA를 가리키면 descriptor generation 문제일 수 있다.

~~~text
descriptor_records:
  binding1 out_buf expected_generation=18 actual_generation=17 status=stale
~~~

이 경우 page table을 아무리 잘 flush해도 shader는 잘못된 resource descriptor를 볼 수 있다.

반대로 descriptor generation은 맞는데 producer/consumer 사이 cache action이 빠졌다면 stale data 문제다.

~~~text
producer DISPATCH
producer SIGNAL
consumer WAIT
consumer DISPATCH
# missing release/acquire or invalidate for shared buffer
~~~

이 경우 VA는 valid하고 dispatch도 끝나지만 값이 오래될 수 있다.

마지막으로 descriptor도 맞고 cache ordering도 맞는데 page table update가 dispatch 뒤에 보이면 VM fault 쪽이다.

~~~text
SET_DESCRIPTOR_BASE out_buf_va=0x82000000
DISPATCH
PT_UPDATE_FLUSH batch=209
~~~

이 순서는 말이 안 된다. page table update visibility는 dispatch 전에 닫혀야 한다.

## UMD/KMD 경계에서 조심할 점

UMD는 대개 OpenCL/Vulkan 객체, descriptor state, command buffer/IB 구성을 잘 알고 있다. KMD는 BO residency, VM bind, scheduler, fence, fault report에 더 가깝다. 그래서 이 주제는 UMD/KMD 계약이 흐려지기 쉽다.

UMD가 KMD에 submit을 넘길 때 최소한 이런 정보가 필요하다.

~~~text
submit resources:
  bo=81 access=read  va_range=[0x81000000,0x81400000)
  bo=82 access=write va_range=[0x82000000,0x82400000)

requirements:
  bind_before_submit=true
  resident_until_fence=991
  vm_update_visible_before_dispatch=true
~~~

KMD는 이를 바탕으로 page table update, residency pin/validate, scheduling dependency를 처리해야 한다. 그리고 fault가 나면 UMD/OpenCL event로 되돌릴 수 있는 metadata를 잃지 않아야 한다.

~~~text
fault_va
  -> VMID/context
  -> BO or unmapped hole
  -> submit id / fence seq
  -> descriptor binding / OpenCL arg
  -> event terminal status
~~~

이 연결이 끊기면 clWaitForEvents는 그냥 오래 기다리거나, 앱은 의미 없는 generic failure만 받는다. driver dev 입장에서는 fault를 "GPU가 죽었다"로만 보지 말고 어느 resource contract가 깨졌는지 되돌릴 수 있어야 한다.

## what this means for driver dev

driver dev 관점에서 page table/residency ordering은 dispatch 준비 단계의 필수 invariant다.

- descriptor validation은 VA/range/type 계약을 확인하지만, page table/residency 유효성까지 자동으로 증명하지 않는다.
- submit trace에는 OpenCL arg, descriptor binding, BO id, VA range, VM bind seq, resident seq, fence seq를 함께 남기는 편이 좋다.
- PM4 dispatch 전에 VM update visibility가 닫혔는지 확인해야 한다. 특히 page table update flush/invalidate가 dispatch 뒤로 밀리면 안 된다.
- BO lifetime은 event/fence completion보다 길어야 한다. 완료 전 unbind/evict/release는 descriptor가 맞아도 fault를 만든다.
- fault path는 fence wait를 무한정 끌지 말고 OpenCL event를 terminal error로 전이시켜 waiter를 깨워야 한다.
- stale descriptor, stale cache, invalid VA를 같은 증상으로 뭉개지 말고 각각 다른 로그 필드로 분리해야 한다.

## app-facing takeaway

앱 개발자 입장에서는 이 내용이 곧바로 PM4를 읽으라는 뜻은 아니다. 하지만 증상을 나눠 생각하면 디버깅 방향이 빨라진다.

- 결과가 이전 값이면 먼저 event dependency와 cache/visibility 문제를 의심한다.
- GPU fault나 device lost에 가까우면 buffer 크기, sub-buffer offset, lifetime, enqueue 완료 전 release를 확인한다.
- 같은 kernel이라도 buffer 재사용과 비동기 queue 사용이 많아질수록 driver가 descriptor, residency, visibility를 동시에 맞춰야 하므로 문제가 더 미묘해진다.

최적화할 때 pinned/mapped buffer, staging copy, out-of-order queue, 여러 command queue를 섞는 선택은 성능뿐 아니라 이런 증상 분류도 어렵게 만든다. 빠른 경로를 쓰되, event wait와 buffer lifetime은 명확하게 유지하는 편이 좋다.

