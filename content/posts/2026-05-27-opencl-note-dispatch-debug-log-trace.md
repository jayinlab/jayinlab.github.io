---
title: "한 dispatch 로그로 descriptor, fault VA, cache/fence를 같이 읽기"
date: 2026-05-27
slug: "opencl-dispatch-debug-log-trace"
draft: false
type: "note"
series: "opencl-deep-dive"
tags: ["opencl", "driver", "descriptor", "pm4", "cache", "fence", "vm-fault", "debugging"]
difficulty: "advanced"
layer: "OpenCL -> Vulkan -> PM4"
---

최근 며칠 동안 같은 dispatch 주변의 문제를 세 축으로 나눴다.

- descriptor/state contract가 틀린 경우
- cache/fence visibility가 부족해서 오래된 값을 보는 경우
- GPU VA나 residency가 깨져 VM fault가 나는 경우

오늘은 이 셋을 다시 하나로 합쳐서 본다. 합친다는 뜻은 원인을 섞는다는 뜻이 아니다. 하나의 dispatch debug log 안에 세 축을 모두 남기고, 읽을 때는 분리해서 판단하자는 뜻이다.

예제 경로는 아래 하나다.

~~~text
clEnqueueNDRangeKernel
  -> ANGLE/OpenCL kernel arg table
  -> clspv/SPIR-V descriptor interface
  -> Vulkan descriptor buffer + command buffer
  -> PM4 state setup / dispatch / cache action / fence
  -> optional VM fault record
~~~

핵심 질문은 이것이다.

> 이 dispatch가 무엇을 읽으려 했고, 그 주소가 유효했으며, 실행 뒤 값이 보이도록 만들었는가?

이 세 질문을 한 로그에서 동시에 대답할 수 있어야 한다.

## 예제 커널

아래처럼 입력 buffer 둘을 읽고 출력 buffer 하나에 쓰는 커널을 생각하자.

~~~c
__kernel void axpby(
    __global const float* x,
    __global const float* y,
    __global float* out,
    float a,
    float b)
{
    int gid = get_global_id(0);
    out[gid] = a * x[gid] + b * y[gid];
}
~~~

앱 표면에서는 arg를 채우고 dispatch를 enqueue한다.

~~~c
clSetKernelArg(kernel, 0, sizeof(cl_mem), &x_buf);
clSetKernelArg(kernel, 1, sizeof(cl_mem), &y_buf);
clSetKernelArg(kernel, 2, sizeof(cl_mem), &out_buf);
clSetKernelArg(kernel, 3, sizeof(float), &a);
clSetKernelArg(kernel, 4, sizeof(float), &b);
clEnqueueNDRangeKernel(queue, kernel, 1, NULL, &global, &local, 0, NULL, &evt);
~~~

여기서 arg0, arg1, arg2는 clspv/SPIR-V를 지나 descriptor-backed resource로 내려갈 가능성이 높다. arg3, arg4 같은 scalar는 별도 constant/push-like state로 묶일 수 있다. 중요한 점은 OpenCL arg index가 하드웨어까지 그대로 보존되는 것이 아니라, driver가 매핑 metadata를 남겨야 되살릴 수 있다는 것이다.

## 좋은 dispatch 로그의 뼈대

좋은 로그는 API 표면, descriptor record, PM4 packet range, fence/cache, fault context를 같은 submit id로 묶는다.

~~~text
submit=88 queue=Q0 engine=compute0 kernel=axpby
event=E42 fence_seq=3104 global=1048576 local=256

shader_interface:
  arg0 x   binding=0 type=storage_buffer access=read
  arg1 y   binding=1 type=storage_buffer access=read
  arg2 out binding=2 type=storage_buffer access=write
  arg3 a   scalar_offset=0
  arg4 b   scalar_offset=4

descriptor_records:
  binding0 arg0 x   bo=51 va=[0x71000000,0x71400000) desc_off=0x0000 status=ok
  binding1 arg1 y   bo=52 va=[0x72000000,0x72400000) desc_off=0x0020 status=ok
  binding2 arg2 out bo=53 va=[0x73000000,0x73400000) desc_off=0x0040 status=ok

pm4:
  packets=[180..224]
  set_user_data descriptor_base=0x74000000
  set_user_data scalar_block=0x74001000
  dispatch_direct packet=211
  cache_action=release/out_buf before fence
  fence_write seq=3104 packet=223
~~~

이 정도가 있으면 로그를 읽는 사람이 적어도 네 가지를 연결할 수 있다.

- OpenCL arg index와 SPIR-V/Vulkan binding의 대응
- descriptor record 안의 BO/VA/range
- PM4에서 descriptor base와 dispatch packet이 설정된 위치
- event COMPLETE 근거가 되는 fence와 그 앞의 cache action

반대로 아래처럼만 남기면 거의 도움이 되지 않는다.

~~~text
dispatch axpby submitted
event E42 complete
~~~

이 로그는 성공했을 때는 조용해 보이지만, 실패했을 때 원인을 나눌 수 없다.

## 읽기 1: descriptor 문제는 dispatch 전에 보인다

먼저 descriptor/state contract를 본다. 예를 들어 로그가 이렇게 나온다고 하자.

~~~text
shader_interface:
  arg2 out binding=2 type=storage_buffer access=write

descriptor_records:
  binding2 arg2 out desc_off=0x0040 status=range_too_small
  expected_min_bytes=4194304 actual_bytes=1048576
~~~

이 경우는 cache/fence 문제가 아니다. shader가 쓸 수 있다고 믿는 range와 runtime이 descriptor record에 넣은 range가 맞지 않는다.

driver는 가능하면 이 단계에서 dispatch를 GPU에 보내지 않아야 한다. 이미 command stream으로 내려간 뒤 VM fault나 device lost에 가까운 증상으로 보는 것은 너무 늦다.

확인 순서는 대략 이렇다.

~~~text
OpenCL arg index
  -> reflected binding/type/access
  -> descriptor record offset/alignment
  -> decoded VA/range/type
  -> pipeline layout compatibility
~~~

이 순서에서 실패하면 "state contract 실패"로 분류한다. barrier를 추가하거나 host wait를 늘려도 해결되지 않는다.

## 읽기 2: fault VA는 descriptor range에 먼저 맞춰 본다

이번에는 validation은 통과했지만 GPU fault가 났다고 하자.

~~~text
fault:
  submit=88 engine=compute0 vmid=3
  fault_va=0x73400020 access=write reason=page_not_present
  last_completed_fence=3103 submitted_fence=3104
  ib_stack=[ring+0x140, ib_main+0x2a0]
~~~

가장 먼저 할 일은 fault VA를 descriptor range와 대조하는 것이다.

~~~text
binding0 x   [0x71000000,0x71400000)
binding1 y   [0x72000000,0x72400000)
binding2 out [0x73000000,0x73400000)
fault_va     0x73400020
~~~

여기서는 fault VA가 out range 바로 뒤에 있다. 그러면 후보는 descriptor type보다 range/offset/global size 쪽으로 좁혀진다.

- global size가 buffer 크기보다 큰가?
- element size 계산이 빠졌는가?
- sub-buffer offset이 descriptor range에 반영됐는가?
- BO lifetime이나 VM bind가 dispatch 완료 전까지 유지됐는가?
- range 안 주소인데 page_not_present라면 residency/page table update ordering은 맞는가?

중요한 점은 fault VA가 source line을 바로 말해주지 않는다는 것이다. 먼저 descriptor/resource range에 맞춰야 한다. 그 다음에 shader access 패턴과 gid 범위를 본다.

## 읽기 3: stale data는 fence와 cache action 위치를 본다

이번에는 fault도 없고 descriptor도 맞는데, host가 읽은 out 값이 이전 값처럼 보인다고 하자.

~~~text
pm4:
  dispatch_direct packet=211
  fence_write seq=3104 packet=212
  cache_action=release/out_buf packet=214
~~~

이 로그는 이상하다. event COMPLETE의 근거가 되는 fence write가 cache release보다 앞에 있다. host나 다음 queue가 fence seq=3104만 보고 out_buf를 읽으면, dispatch가 끝났다는 사실과 out_buf가 필요한 domain으로 visible하다는 사실이 어긋날 수 있다.

좋은 순서는 적어도 아래 의미를 가져야 한다.

~~~text
dispatch writes out_buf
  -> required cache/release action
  -> fence/event write used for event COMPLETE
  -> host read or next consumer acquire/invalidate
~~~

stale data 의심 시에는 descriptor record를 계속 의심하기보다 visibility timeline을 본다.

- producer dispatch 뒤 필요한 release/cache action이 있는가?
- event COMPLETE에 쓰는 fence가 그 action 뒤에 있는가?
- host read path나 다음 queue consumer가 필요한 acquire/invalidate를 수행하는가?
- Vulkan stage/access mask가 실제 shader write와 transfer/host read를 덮는가?

여기서도 단순히 clFinish를 더 넣는 것은 원인 확인에 약하다. wait는 실행 진행을 기다릴 수 있지만, 필요한 visibility action이 command stream에 없으면 문제를 구조적으로 설명하지 못한다.

## 세 로그를 한 번에 분류하기

같은 axpby dispatch라도 로그의 중심은 다르게 읽힌다.

| 로그 단서 | 먼저 의심할 축 | 다음 확인 |
|---|---|---|
| missing_arg, type_mismatch, range_too_small | descriptor/state contract | arg table, reflection, descriptor record |
| fault_va가 descriptor range 밖 | address/range/lifetime | gid 범위, offset, BO lifetime |
| fault_va가 range 안인데 page fault | VM/residency | VM bind, page table visibility, residency |
| fence가 cache action보다 앞 | cache/fence visibility | release/acquire 위치, event attribution |
| last completed fence가 fault submit 앞 | command progress/fault | IB stack, checkpoint, event error propagation |

이 표의 목적은 정답을 자동으로 고르는 것이 아니다. 첫 질문을 틀리지 않게 만드는 것이다.

## Driver dev 관점에서 의미하는 것

driver dev 입장에서는 debug metadata의 소유권을 명확히 해야 한다.

1. kernel build/reflection
   - OpenCL arg index, SPIR-V binding, descriptor type, access, scalar layout을 고정한다.

2. dispatch 준비
   - arg table에서 descriptor record를 만들고 decoded descriptor summary를 남긴다.
   - missing arg, type mismatch, alignment/range mismatch는 GPU 제출 전에 잡는다.

3. command stream 생성
   - PM4 packet range, descriptor base, scalar/user-data setup, dispatch packet 위치를 submit id에 묶는다.

4. completion/fault 처리
   - cache action, fence write, last completed fence, fault VA, IB stack을 같은 event range와 연결한다.

내가 보고 싶은 invariant는 짧다.

~~~text
descriptor record is valid
AND required VA/residency is established before dispatch
AND required visibility action precedes the completion fence
~~~

이 셋 중 어느 하나라도 빠지면 OpenCL event가 앱에 보여주는 의미와 GPU 내부 상태가 어긋난다.

## App-facing takeaway

앱 개발자에게는 이 모든 로그가 직접 보이지 않을 수 있다. 그래도 증상 분류에는 그대로 도움이 된다.

- validation이 arg, descriptor, layout을 말하면 kernel arg 순서와 buffer range를 먼저 본다.
- fault나 device lost에 가까우면 out-of-bounds, sub-buffer offset, buffer lifetime을 먼저 줄인다.
- 값이 가끔 오래되면 dependency, event waitlist, host/device handoff를 먼저 본다.

성능 최적화에서도 같은 감각이 필요하다. 모든 문제를 clFinish로 덮으면 원인 분리가 사라지고, 불필요한 동기화가 늘어난다. 반대로 dependency가 필요한 곳을 descriptor 문제로만 보면 최신 값 보장을 놓친다.

## 한 줄 요약

하나의 OpenCL dispatch debug log는 arg-to-descriptor mapping, fault VA-to-resource mapping, cache action-to-fence ordering을 함께 담아야 한다. 하지만 읽을 때는 descriptor correctness, VA/residency validity, memory visibility를 끝까지 분리해야 한다.

## 관련 글

- [Descriptor buffer validation fast path: dispatch 전에 걸러야 할 것들]({{< relref "2026-05-26-opencl-note-descriptor-buffer-validation-fast-path.md" >}})
- [OpenCL dispatch 디버깅: stale data, invalid descriptor, VM fault를 먼저 나누기]({{< relref "2026-05-25-opencl-note-dispatch-debug-three-axes.md" >}})
- [GPU fault는 OpenCL event와 error로 어떻게 올라오나]({{< relref "2026-05-20-opencl-note-gpu-fault-to-event-error.md" >}})
- [PM4 IB chain과 checkpoint: command stream 진행률은 어디서 관찰되나]({{< relref "2026-05-23-opencl-note-ib-chain-checkpoint-observability.md" >}})

## 관련 용어

[[descriptor-set]], [[pipeline-layout]], [[SPIR-V]], [[pm4-packet]], [[fence]], [[GPU-VM]], [[cache]], [[command-queue]]
