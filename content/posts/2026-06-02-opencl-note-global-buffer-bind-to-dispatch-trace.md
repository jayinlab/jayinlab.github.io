---
title: "__global 버퍼 하나는 dispatch 직전까지 어떻게 내려가나"
date: 2026-06-02
slug: "opencl-global-buffer-bind-to-dispatch-trace"
draft: false
type: "note"
series: "opencl-driver-internals"
tags: ["opencl", "clspv", "spirv", "vulkan", "descriptor", "pipeline-layout", "pm4", "cond-exec", "cache-visibility", "driver-dev", "trace-walkthrough"]
difficulty: "advanced"
layer: "CL"
---

OpenCL C의 `__global float *out`은 GPU 주소 하나로 곧바로 바뀌지 않는다. 먼저 shader가 요구하는 resource interface가 되고, runtime이 실행마다 실제 buffer를 연결하고, driver가 그 연결을 GPU가 읽을 state로 기록한 뒤 dispatch한다.

오늘은 `out` 하나만 따라간다. 핵심은 각 단계가 서로 다른 질문에 답한다는 점이다.

~~~text
__global float *out
  -> shader interface: 어떤 종류의 resource가 필요한가?
  -> pipeline layout: 어느 slot에 어떤 descriptor type이 와야 하는가?
  -> descriptor value: 이번 실행에서는 어느 buffer를 쓸 것인가?
  -> wait / cache action: producer가 쓴 최신 값이 보이는가?
  -> PM4 state + dispatch: GPU가 준비된 state로 실행을 시작하는가?
~~~

`__global`을 이해할 때 이 질문을 한 덩어리로 합치면 혼동이 생긴다. descriptor가 맞다고 cache visibility가 자동으로 해결되지 않고, wait를 추가했다고 잘못 채운 descriptor가 고쳐지지도 않는다.

## 출발점: 앱에는 buffer argument 하나만 보인다

아래 kernel은 `src`를 읽어 `out`에 쓴다.

~~~c
__kernel void scale(__global const float *src,
                    __global float *out,
                    const float factor)
{
    int gid = get_global_id(0);
    out[gid] = src[gid] * factor;
}
~~~

앱은 `cl_mem`을 argument로 넣고 kernel을 enqueue한다.

~~~c
clSetKernelArg(kernel, 0, sizeof(cl_mem), &src_buf);
clSetKernelArg(kernel, 1, sizeof(cl_mem), &out_buf);
clSetKernelArg(kernel, 2, sizeof(float), &factor);
clEnqueueNDRangeKernel(queue, kernel, 1, NULL, &global, &local,
                       1, &producer_event, &scale_event);
~~~

`producer_event`는 이전 command가 `src_buf`에 쓴 결과를 기다리기 위한 dependency다. 이 wait-list와 `out_buf` argument는 둘 다 필요하지만 역할은 다르다.

## 1. build 시점: `__global`은 shader interface 계약이 된다

clspv/SPIR-V 경로를 단순화하면 pointer argument는 buffer resource interface로 낮아진다.

~~~text
arg0 src: __global const float *
  -> StorageBuffer-like interface
  -> set=0 binding=0 type=storage_buffer access=read

arg1 out: __global float *
  -> StorageBuffer-like interface
  -> set=0 binding=1 type=storage_buffer access=write

arg2 factor: float
  -> small scalar path, such as push constant or kernarg data
~~~

정확한 set/binding 번호와 scalar lowering 방식은 compiler/runtime 설계에 따라 달라질 수 있다. 중요한 것은 build 결과가 **shader가 어떤 slot 규격을 기대하는지**를 고정한다는 점이다.

~~~text
pipeline layout schema
  binding 0: storage buffer, read
  binding 1: storage buffer, write
  scalar data: factor
~~~

이 시점에는 아직 이번 dispatch의 `src_buf`, `out_buf` 값이 결정되지 않았다. pipeline layout은 schema이고 descriptor update/bind는 실행별 row data다.

## 2. `clSetKernelArg` 시점: 실행별 buffer 값이 들어온다

runtime은 OpenCL argument table에 실제 `cl_mem`과 range 정보를 기록한다.

~~~text
kernel=scale
arg0 -> cl_mem=src_buf offset=0 size=4096
arg1 -> cl_mem=out_buf offset=0 size=4096
arg2 -> factor=2.0
~~~

enqueue를 record할 때 이 값은 descriptor record 또는 동등한 backend binding state로 바뀐다.

~~~text
descriptor binding 0 -> src_buf VA=0x71000000 range=4096
descriptor binding 1 -> out_buf VA=0x71010000 range=4096
~~~

여기서 자주 생기는 오해가 있다.

> SPIR-V에 `StorageBuffer`가 적혀 있으면 runtime이 잘못 연결한 buffer도 알아서 고쳐 줄까?

아니다. SPIR-V interface는 binding 1에 storage buffer가 와야 한다는 규격을 알려 준다. runtime이 binding 1을 비워 두거나 잘못된 range를 쓰면 shader 스스로 복구할 수 없다.

## 3. enqueue dependency: descriptor와 별도로 wait가 필요하다

이번 dispatch가 읽을 `src_buf`를 이전 dispatch가 썼다고 하자.

~~~text
producer dispatch writes src_buf
  -> release / cache action as required
  -> signal event dependency

scale dispatch waits producer_event
  -> dependency wait
  -> acquire / invalidate as required
  -> dispatch reads src_buf
~~~

descriptor binding 0이 올바른 `src_buf`를 가리켜도 producer-consumer ordering이 없으면 오래된 데이터를 읽을 수 있다. 반대로 wait와 invalidate가 정확해도 descriptor가 다른 buffer를 가리키면 결과는 틀린다.

driver 로그에서도 두 축을 분리하는 편이 좋다.

~~~text
binding_state: binding0=src_buf binding1=out_buf status=ok
dependency: wait_event=E17 status=satisfied
visibility: acquire_or_invalidate=issued
~~~

## 4. PM4 직전: state, wait, cache action, predication은 서로 다르다

하드웨어 근처에서는 OpenCL argument 이름보다 descriptor table pointer, user-data register, wait packet, cache action, dispatch packet이 보인다. 실제 packet 이름과 조합은 GPU 세대와 driver 구현에 따라 달라질 수 있지만, 개념 순서는 아래처럼 나눌 수 있다.

~~~text
WAIT_REG_MEM / equivalent dependency wait
ACQUIRE_MEM / equivalent invalidate or acquire action
SET_SH_REG descriptor_table_pointer
SET_SH_REG scalar_or_kernarg_pointer
COND_EXEC optional_predicate_region
DISPATCH_DIRECT
RELEASE_MEM / fence write
~~~

`COND_EXEC`는 조건에 따라 뒤의 packet 구간을 실행하거나 건너뛰는 predication 역할이다. dependency가 끝날 때까지 기다리는 wait packet도 아니고, 최신 cache line을 보이게 하는 invalidate도 아니다.

따라서 아래처럼 `COND_EXEC` 하나만 넣고 동기화가 끝났다고 보면 안 된다.

~~~text
COND_EXEC predicate_ready
DISPATCH_DIRECT
~~~

predicate가 참이어도 필요한 dependency wait나 cache action이 빠졌다면 stale read는 여전히 가능하다.

## trace walkthrough: `out_buf`를 바꾼 뒤 한 번 dispatch하기

같은 kernel에 새 output buffer를 넣는 실행 하나를 로그처럼 이어 보자.

~~~text
t0 build/reflection
  kernel=scale pipeline_layout=L7
  binding0=storage_buffer/read binding1=storage_buffer/write

t1 OpenCL argument update
  clSetKernelArg arg1 cl_mem=out_buf_B offset=0 size=4096

t2 runtime record
  descriptor_set=D19 pipeline_layout=L7
  binding0=src_buf_A VA=0x71000000 range=4096
  binding1=out_buf_B VA=0x71010000 range=4096
  compatibility(L7, D19)=ok

t3 dependency lowering
  wait producer_event=E17
  cache_action=acquire_or_invalidate_for_src_buf_A

t4 PM4-visible command stream
  WAIT_REG_MEM dependency_fence>=17
  ACQUIRE_MEM required_cache_scope
  SET_SH_REG descriptor_table=D19_gpu_address
  COND_EXEC optional_dispatch_predicate
  DISPATCH_DIRECT groups=(64,1,1)
  RELEASE_MEM signal scale_event=E18
~~~

이 trace에서 pipeline layout `L7`은 그대로 재사용된다. 바뀐 것은 descriptor set `D19`에 들어간 실행별 값이다. `E17` wait와 acquire/invalidate는 최신 `src_buf_A`를 보기 위한 별도 작업이다. 선택적인 `COND_EXEC`는 그 어느 쪽도 대신하지 않는다.

## 실패를 세 갈래로 먼저 나누기

하나의 dispatch가 이상할 때는 아래 세 질문부터 분리한다.

| 증상 | 먼저 볼 축 | 대표 확인값 |
|---|---|---|
| 다른 buffer를 읽거나 validation 실패 | descriptor/state correctness | pipeline layout, binding, type, range, descriptor bytes |
| 가끔 이전 값이 보임 | memory visibility | event dependency, wait, release/acquire, flush/invalidate |
| GPU fault 또는 device lost | VA/lifetime validity | BO lifetime, GPU VA, residency, PTE, TLB invalidate 이력 |

세 축은 연결될 수 있지만 같은 flag로 합치면 로그가 원인을 숨긴다. 예를 들어 descriptor range 안에 GPU VA가 있어도 BO lifetime이나 translation visibility까지 자동으로 증명되지는 않는다.

## what this means for driver dev

- build/reflection metadata에는 arg index, set/binding, descriptor type, access mode, pipeline layout key를 남긴다.
- `clSetKernelArg` 또는 동등한 runtime 경로에서는 실행별 `cl_mem`, offset, range를 추적하고 dispatch record의 descriptor bytes와 연결한다.
- pipeline layout compatibility 검사와 descriptor value validation을 분리한다. schema가 맞는 것과 이번 buffer 값이 맞는 것은 다른 질문이다.
- submit debug trace에는 wait packet, cache action, descriptor table pointer, 선택적 `COND_EXEC`, dispatch, fence write 순서를 함께 남긴다.
- `COND_EXEC`, dependency wait, cache flush/invalidate를 대체 가능한 것으로 취급하지 않는다.
- descriptor correctness, cache visibility, VA/lifetime validity를 별도 상태와 로그 필드로 유지한다.

## app-facing takeaway

앱에서 `clSetKernelArg`를 호출할 때는 argument 순서, buffer lifetime, range를 먼저 정확히 맞춘다. 이전 command 결과를 읽는다면 event wait-list도 별도로 유지해야 한다. 무조건적인 `clFinish`를 추가해도 잘못된 argument binding은 고쳐지지 않는다.

작은 H2D 전송에서는 mapped/pinned buffer가 항상 staging보다 빠른 것도 아니다. copy 하나를 줄여도 map/unmap, CPU cache maintenance, synchronization 비용이 더 크면 staging이 이길 수 있다. buffer path는 end-to-end latency로 비교한다.

---

## 관련 글

- [OpenCL address space는 어떻게 descriptor 계약이 되나]({{< relref "2026-05-24-opencl-note-address-space-descriptor-contract.md" >}})
- [Descriptor buffer validation fast path: dispatch 전에 걸러야 할 것들]({{< relref "2026-05-26-opencl-note-descriptor-buffer-validation-fast-path.md" >}})
- [Pipeline Layout(정적 계약)과 Descriptor Set(동적 값) 혼동 정리]({{< relref "2026-04-23-opencl-wrong-note-layout-vs-binding-update.md" >}})
- [dispatch 전에 PTE만 쓰고 끝내면 안 되는 이유]({{< relref "2026-06-01-opencl-note-pte-tlb-invalidate-dispatch-trace.md" >}})

## 관련 용어

- [[descriptor-set]], [[pipeline-layout]], [[SPIR-V]], [[command-buffer]], [[pm4-packet]]
