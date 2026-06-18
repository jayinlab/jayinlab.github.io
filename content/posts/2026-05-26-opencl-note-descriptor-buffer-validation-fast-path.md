---
title: "Descriptor buffer validation fast path: dispatch 전에 걸러야 할 것들"
date: 2026-05-26
slug: "opencl-descriptor-buffer-validation-fast-path"
draft: false
type: "note"
series: "opencl-deep-dive"
tags: ["opencl", "vulkan", "descriptor", "driver", "validation", "pm4", "debugging"]
difficulty: "advanced"
layer: "CL"
---

어제 노트에서는 하나의 OpenCL dispatch 문제를 세 축으로 나눴다.

- stale data: cache/fence visibility
- invalid descriptor: binding/state contract
- VM fault: address/residency/lifetime

오늘은 그중 두 번째 축인 descriptor validation을 더 좁혀 본다. 특히 descriptor buffer 스타일 경로에서는 dispatch 직전에 무엇을 빠르게 확인해야 하고, 무엇은 GPU 실행 뒤 fault/debug 로그로 넘겨야 하는지가 중요하다.

핵심은 이것이다.

> descriptor validation은 "shader가 기대하는 resource interface"와 "runtime이 실제로 채운 descriptor record"가 같은 계약인지 확인하는 fast path다.

cache flush나 fence wait로 고칠 수 있는 문제가 아니다. descriptor record가 틀리면 GPU는 잘못된 resource를 읽거나, 아예 유효하지 않은 주소를 따라간다.

## 작은 trace

아래 커널을 기준으로 생각하자.

~~~c
__kernel void add_bias(
    __global const float* x,
    __global float* y,
    __constant float* bias)
{
    int gid = get_global_id(0);
    y[gid] = x[gid] + bias[0];
}
~~~

OpenCL 표면에서는 arg index 세 개를 채우는 일처럼 보인다.

~~~c
clSetKernelArg(kernel, 0, sizeof(cl_mem), &x_buf);
clSetKernelArg(kernel, 1, sizeof(cl_mem), &y_buf);
clSetKernelArg(kernel, 2, sizeof(cl_mem), &bias_buf);
clEnqueueNDRangeKernel(queue, kernel, 1, NULL, &global, &local, 0, NULL, &evt);
~~~

하지만 clspv/SPIR-V와 Vulkan 쪽으로 내려가면 이 호출은 descriptor interface 계약으로 바뀐다.

~~~text
OpenCL arg0: __global const float* x
  -> SPIR-V StorageBuffer-like interface
  -> descriptor set/binding/range/type

OpenCL arg1: __global float* y
  -> writable storage resource
  -> descriptor set/binding/range/type + write access

OpenCL arg2: __constant float* bias
  -> readonly resource path
  -> descriptor set/binding/range/type + const/read-only assumptions
~~~

여기서 validation fast path가 해야 할 일은 "GPU가 이 주소를 실제로 page fault 없이 읽을 수 있는가"를 완전히 증명하는 것이 아니다. 그건 VM bind/residency와 fault record 쪽 책임이 섞인다. fast path는 dispatch 전에 잡을 수 있는 계약 위반을 싸게 걸러야 한다.

## dispatch 전에 잡을 수 있는 것

첫 번째는 shader interface와 descriptor layout의 불일치다.

~~~text
reflection says:
  binding 0 = x, storage buffer, readonly-ish use
  binding 1 = y, storage buffer, write
  binding 2 = bias, constant/readonly resource

runtime filled:
  binding 0 = x_buf, storage buffer
  binding 1 = y_buf, storage buffer
  binding 2 = missing
~~~

이런 문제는 GPU 실행까지 보내면 안 된다. command stream까지 내려간 뒤 fault나 hang으로 찾는 것은 너무 늦다.

dispatch 전 validation에서 볼 항목은 대략 아래다.

- arg index가 reflection의 expected binding과 연결되는가?
- descriptor type이 shader interface와 맞는가?
- buffer range가 최소 접근 범위를 덮는가?
- descriptor record offset이 alignment 요구를 만족하는가?
- pipeline layout cache key가 현재 shader resource interface를 반영하는가?
- readonly/write 같은 access assumption이 내부 최적화와 충돌하지 않는가?

descriptor buffer 경로라면 "descriptor set object를 bind했는가"보다 "GPU가 읽을 descriptor memory에 어떤 record bytes가 놓였는가"가 더 직접적인 질문이 된다.

~~~text
descriptor_buffer_base + descriptor_offset(binding 1)
  -> record bytes
  -> resource type
  -> GPU VA
  -> size/range
  -> format/stride/flags
~~~

따라서 validation 로그도 object 이름만 남기면 부족하다. descriptor buffer base, binding별 offset, record size, alignment, decoded range를 같이 남겨야 한다.

## dispatch 전에 완전히 증명하기 어려운 것

반대로 fast path가 모든 것을 책임지려 하면 느리고 복잡해진다.

예를 들어 descriptor record 안의 GPU VA가 어떤 BO range에 들어가는지 확인할 수는 있다. 하지만 아래까지 매 dispatch마다 무겁게 증명하려 하면 submit path가 비대해진다.

- 해당 BO가 모든 engine/VM context에서 지금 resident인지
- page table update가 이 submit보다 먼저 GPU에 보이는지
- 다른 queue의 release/invalidate가 이 dispatch의 read 전에 충분한지
- shader의 dynamic index가 실제로 어느 byte까지 접근할지

이 영역은 validation fast path와 fault/visibility 디버깅 사이의 경계에 있다.

~~~text
fast validation:
  descriptor record shape, type, binding, alignment, declared range

submit/VM tracking:
  BO lifetime, VM bind ordering, residency, page table visibility

PM4/cache tracking:
  cache action, release/acquire, fence position, event attribution
~~~

이 경계를 지키면 디버깅도 깨끗해진다. descriptor validation 실패는 "state contract 실패"로, GPU fault는 "VA/residency/lifetime 실패"로, stale read는 "visibility 실패"로 더 쉽게 분리된다.

## fast path 로그가 가져야 할 모양

좋은 validation 로그는 앱의 arg index와 driver 내부 descriptor 위치를 동시에 보여준다.

~~~text
kernel=add_bias pipeline_key=0x91ac
arg0 name=x    binding=0 type=storage_buffer access=read
  cl_mem=x_buf bo=41 va=0x71000000 size=65536
  desc_offset=0x0000 desc_size=32 align=32 status=ok

arg1 name=y    binding=1 type=storage_buffer access=write
  cl_mem=y_buf bo=42 va=0x71020000 size=65536
  desc_offset=0x0020 desc_size=32 align=32 status=ok

arg2 name=bias binding=2 type=storage_buffer access=read
  cl_mem=null
  desc_offset=0x0040 status=missing_arg
~~~

이 로그가 있으면 dispatch를 GPU에 보내기 전 arg2 누락을 바로 설명할 수 있다.

나쁜 로그는 이런 식이다.

~~~text
descriptor validation failed
~~~

이 정도로는 app layer, SPIR-V interface, Vulkan layout, PM4 user-data setup 중 어디가 틀렸는지 알 수 없다.

## PM4 관점에서는 어디까지 보이나

PM4 command stream은 OpenCL arg index를 그대로 알지 못한다. 하드웨어에 가까워질수록 보이는 것은 user-data register, descriptor table pointer, shader program, dispatch packet, cache/event packet 같은 형태다.

대략 이런 흐름이다.

~~~text
SET_SH_REG user_data descriptor_buffer_base
SET_SH_REG user_data kernel constants / dispatch dims
DISPATCH_DIRECT
EVENT_WRITE / fence
~~~

따라서 driver가 OpenCL/ANGLE/Vulkan 레벨의 arg mapping을 잃어버리면, PM4 dump만 보고는 "binding 2가 비었다"를 되살리기 어렵다. driver dev 입장에서는 submit debug metadata가 필요하다.

~~~text
PM4 packet range 120..148
  dispatch kernel=add_bias
  descriptor_buffer_base=0x72000000
  binding0 offset=0x0000 arg0 x_buf
  binding1 offset=0x0020 arg1 y_buf
  binding2 offset=0x0040 arg2 missing
  fence_seq=2308
~~~

이런 metadata는 성능 경로에 항상 켜둘 필요는 없다. 하지만 debug build, validation mode, crash dump mode에서는 매우 값어치가 있다.

## Driver dev 관점에서 의미하는 것

descriptor validation fast path는 submit path를 막는 마지막 방어선에 가깝다. 너무 약하면 GPU fault나 device lost에 가까운 증상으로 늦게 발견되고, 너무 강하면 정상 dispatch마다 비용이 커진다.

내가 구현 기준을 잡는다면 아래처럼 나눌 것이다.

1. kernel build/reflection 시점
   - arg index, SPIR-V binding, descriptor type, access flag, required alignment를 고정한다.
   - pipeline layout cache key에 resource interface를 포함한다.

2. clSetKernelArg 시점
   - arg table에 cl_mem, offset, size, access expectation을 기록한다.
   - type/range처럼 API 표면에서 바로 알 수 있는 오류는 여기서 먼저 잡는다.

3. dispatch record 작성 시점
   - descriptor bytes를 채우고 decoded descriptor summary를 남긴다.
   - missing arg, type mismatch, alignment mismatch, range underflow를 fast validation한다.

4. submit/crash dump 시점
   - PM4 packet range, descriptor base/offset, fence seq, BO/VA mapping을 연결한다.
   - GPU fault가 나면 fault VA를 descriptor range와 다시 매칭한다.

중요한 설계 원칙은 "descriptor correctness", "memory visibility", "VA validity"를 같은 flag로 합치지 않는 것이다. 세 값이 분리되어 있어야 로그가 원인을 좁힌다.

## App-facing takeaway

앱 개발자 입장에서는 descriptor라는 단어가 직접 보이지 않을 수 있다. 그래도 증상 해석에는 도움이 된다.

- validation이 kernel arg, descriptor, layout, binding을 말하면 sync보다 arg 타입/순서/range를 먼저 본다.
- 이전 kernel 결과가 가끔 오래되면 descriptor보다 dependency와 host/device visibility를 먼저 본다.
- device lost나 fault 주소가 보이면 out-of-bounds, 해제된 buffer, 잘못된 offset을 먼저 의심한다.

성능 최적화에서도 같은 구분이 중요하다. 불필요한 강한 barrier나 clFinish는 descriptor contract 오류를 고치지 못한다. 반대로 arg/range가 맞아도 producer-consumer visibility가 없으면 최신 값은 보장되지 않는다.

## 한 줄 요약

Descriptor buffer validation fast path는 dispatch 전에 shader interface와 descriptor record의 계약 위반을 싸게 걸러야 한다. 하지만 cache visibility와 VM residency까지 한 덩어리로 증명하려 하면 원인 분리가 흐려진다.

## 관련 글

- [OpenCL dispatch 디버깅: stale data, invalid descriptor, VM fault를 먼저 나누기]({{< relref "2026-05-25-opencl-note-dispatch-debug-three-axes.md" >}})
- [OpenCL address space -> descriptor -> PM4 state 계약 추적]({{< relref "2026-05-24-opencl-note-address-space-descriptor-contract.md" >}})
