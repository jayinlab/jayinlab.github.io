---
title: "OpenCL dispatch 디버깅: stale data, invalid descriptor, VM fault를 먼저 나누기"
date: 2026-05-25
slug: "opencl-dispatch-debug-three-axes"
draft: false
type: "note"
series: "opencl-deep-dive"
tags: ["opencl", "driver", "descriptor", "pm4", "cache", "fence", "vm-fault", "debugging"]
difficulty: "advanced"
layer: "CL"
---

OpenCL 커널이 깨졌을 때 증상은 비슷해 보인다.

- 결과 buffer 값이 오래된 것처럼 보인다.
- dispatch가 실행되자마자 GPU fault가 난다.
- descriptor validation이나 pipeline layout 호환성 쪽에서 막힌다.

하지만 드라이버 개발 관점에서는 이 셋을 같은 "동기화 문제"로 묶으면 안 된다. 오늘 노트는 하나의 작은 trace를 따라가면서, 문제를 세 축으로 먼저 나누는 연습이다.

~~~text
clSetKernelArg(__global x)
  -> clspv/SPIR-V StorageBuffer interface
  -> Vulkan descriptor / pipeline layout contract
  -> command buffer state + dispatch
  -> PM4-visible resource state / cache action / fence / VM fault record
~~~

핵심 질문은 이것이다.

> 값이 틀린 것인가, 주소를 잘못 가리킨 것인가, 아예 접근할 수 없는 주소인가?

이 질문 하나만 먼저 던져도 디버깅 방향이 크게 줄어든다.

## 예제 trace

아래처럼 단순한 커널을 생각하자.

~~~c
__kernel void scale(
    __global const float* x,
    __global float* y,
    float a)
{
    int gid = get_global_id(0);
    y[gid] = x[gid] * a;
}
~~~

앱 쪽 호출은 대략 이렇다.

~~~c
clSetKernelArg(kernel, 0, sizeof(cl_mem), &x_buf);
clSetKernelArg(kernel, 1, sizeof(cl_mem), &y_buf);
clSetKernelArg(kernel, 2, sizeof(float), &a);
clEnqueueNDRangeKernel(queue, kernel, 1, NULL, &global, &local, 0, NULL, &evt);
~~~

OpenCL API 표면에서는 arg0, arg1, arg2를 채우고 dispatch를 던진 것처럼 보인다. 하지만 ANGLE/clspv/Vulkan/driver 경로로 내려가면 서로 다른 계약이 생긴다.

| OpenCL 표면 | 뒤쪽 계약 | 깨졌을 때 먼저 의심할 축 |
|---|---|---|
| <code>x_buf</code>, <code>y_buf</code> | StorageBuffer descriptor, GPU VA, range | descriptor/VM |
| <code>a</code> | push-like scalar state 또는 uniform path | ABI/state |
| <code>evt</code> | completion fence 귀속 | fence/progress |
| 이전 command가 쓴 <code>x_buf</code> | memory visibility | cache/barrier |

여기서 중요한 점은 descriptor가 맞는 것과 최신 데이터가 보이는 것이 별개라는 점이다. 또한 최신 데이터 문제가 아닌데 barrier를 더 넣어도 VM fault는 고쳐지지 않는다.

## 축 1: stale data는 cache/fence visibility 문제다

첫 번째 증상은 커널이 끝났고 event도 COMPLETE인데, <code>y_buf</code> 값이 이전 값처럼 보이는 경우다.

~~~text
copy/update x_buf
  -> missing or too-weak visibility action
dispatch scale reads x_buf
  -> writes y_buf
event COMPLETE
host or next queue reads y_buf
  -> stale value observed
~~~

이 경우 descriptor가 완전히 틀렸다고 단정하면 멀리 돌아간다. shader가 올바른 buffer를 가리키고 있어도 cache domain 전환이나 release/invalidate action이 부족하면 오래된 값을 볼 수 있다.

PM4 관점에서는 packet ordering과 cache visibility를 분리해서 본다.

~~~text
DISPATCH scale
needed cache/release action for y_buf
EVENT_WRITE / fence seq=N
~~~

fence가 signal됐다는 것은 "그 위치까지 실행됐다"는 표식이다. 하지만 fence 앞에 필요한 cache action이 없거나, 다음 consumer가 필요한 invalidate 없이 읽으면 완료와 관측 가능성이 어긋날 수 있다.

따라서 stale data 의심 시에는 아래를 먼저 본다.

- producer와 consumer 사이에 API-level dependency가 있는가?
- Vulkan sync로 내려갈 때 stage/access mask가 실제 read/write 경로를 덮는가?
- event/fence write가 필요한 cache/release action 뒤에 있는가?
- host read, queue 간 handoff, copy engine handoff 중 어느 경계에서 visibility가 필요한가?

## 축 2: invalid descriptor는 binding/state 계약 문제다

두 번째 증상은 dispatch 전 validation 또는 내부 assert가 descriptor/pipeline layout 쪽에서 실패하는 경우다.

예를 들어 clspv가 <code>x</code>를 <code>set=0, binding=0</code>, <code>y</code>를 <code>set=0, binding=1</code>로 만들었는데 runtime이 다른 layout을 bind하거나 descriptor offset/range를 잘못 채우면, 문제는 cache가 아니라 state contract다.

~~~text
SPIR-V interface:
  x -> StorageBuffer binding 0
  y -> StorageBuffer binding 1

Runtime state:
  binding 0 -> y_buf or wrong range
  binding 1 -> missing / incompatible descriptor type
~~~

이 경우 cache flush를 추가해도 해결되지 않는다. shader가 처음부터 다른 resource state를 보고 있거나, pipeline layout과 descriptor layout이 맞지 않기 때문이다.

descriptor-buffer 스타일 경로에서는 특히 "주소만 GPU가 읽을 수 있으면 된다"가 아니다. descriptor record의 alignment, range, type, layout compatibility, dynamic offset 계산이 모두 shader interface와 맞아야 한다.

확인할 항목은 아래와 같다.

- SPIR-V reflection 결과의 set/binding/type과 runtime layout이 일치하는가?
- <code>clSetKernelArg</code> index와 descriptor slot mapping이 안정적으로 연결되는가?
- descriptor buffer offset이 alignment 요구를 만족하는가?
- buffer range가 shader 접근 범위를 덮는가?
- pipeline layout cache key가 shader resource interface 변경을 반영하는가?

## 축 3: VM fault는 address/residency/lifetime 문제다

세 번째 증상은 GPU fault record에 VA, VMID, engine, fault status가 남는 경우다. 이때는 "값이 오래됐다"보다 한 단계 더 아래 문제일 가능성이 크다.

~~~text
descriptor binding is selected
  -> resource descriptor contains GPU VA
  -> shader memory instruction accesses VA
  -> VM translation/residency check fails
  -> fault record reports VA + engine + submit/fence context
~~~

VM fault는 보통 아래 후보를 먼저 본다.

- descriptor가 가리키는 GPU VA가 잘못됐다.
- buffer object lifetime이 dispatch 완료 전 끝났다.
- VM bind나 residency 보장이 submit 전에 완료되지 않았다.
- offset/range 계산이 buffer 끝을 넘었다.
- fault 주소가 arg0/arg1 중 어느 resource range에도 속하지 않는다.

여기서도 barrier를 더 넣는 처방은 위험하다. barrier는 접근 가능한 주소의 ordering/visibility를 다루는 도구이지, 존재하지 않거나 resident가 아닌 VA를 살려내는 도구가 아니다.

좋은 fault 로그는 event 이름 하나로 끝나지 않는다.

~~~text
submit=42 queue=Q0 engine=compute0 fence=1804
kernel=scale arg0=x_buf bo=17 va=0x7000_0000 size=4096
kernel=scale arg1=y_buf bo=18 va=0x7000_2000 size=4096
fault_va=0x7000_3008 vmid=3 last_completed_fence=1803
descriptor_slot=0 range=[0x7000_0000, 0x7000_1000)
~~~

이 정도 정보가 있어야 fault가 descriptor slot 문제인지, range 초과인지, residency 문제인지, 다른 dispatch의 fault인지 분리할 수 있다.

## 세 축을 한 표로 나누기

| 증상 | 먼저 볼 축 | 대표 로그 | 잘못된 처방 |
|---|---|---|---|
| 결과가 오래된 값 | cache/fence visibility | barrier, cache action, fence order | descriptor만 다시 bind |
| validation/layout 실패 | descriptor/state contract | set/binding/type/range/layout | barrier 추가 |
| GPU page fault | VM/residency/lifetime | fault VA, BO, VMID, fence | cache flush 추가 |
| event COMPLETE가 너무 빠름 | fence attribution/order | event range, fence seq, IB 위치 | 앱 wait만 늘리기 |

실전에서는 여러 문제가 겹칠 수 있다. 그래도 첫 분류는 중요하다. 분류가 틀리면 로그를 더 많이 찍어도 엉뚱한 방향으로 쌓인다.

## Driver dev 관점에서 의미하는 것

드라이버 코드는 이 세 축을 자료구조와 로그에서도 분리해야 한다.

1. descriptor/state path
   - kernel arg table, SPIR-V reflection, descriptor layout, pipeline layout cache key를 추적한다.
   - <code>clSetKernelArg</code>가 어떤 resource descriptor와 user-data state로 내려갔는지 남긴다.

2. visibility path
   - event waitlist, Vulkan barrier, PM4 cache/release action, fence write 위치를 추적한다.
   - "완료됨"과 "다음 consumer가 볼 수 있음"을 같은 boolean으로 합치지 않는다.

3. VM/fault path
   - BO id, GPU VA range, VM bind state, residency, last completed fence를 fault 로그와 연결한다.
   - fault VA를 source line이 아니라 descriptor/resource range에 먼저 매핑한다.

내가 드라이버 쪽 코드를 본다면, submit debug dump에 최소한 아래 열을 넣고 싶다.

~~~text
submit_id, queue_id, engine, kernel_name,
arg_index, binding, descriptor_type, bo_id, va_range,
barrier_summary, cache_action_summary,
fence_seq, last_completed_fence, fault_va
~~~

이렇게 해야 "descriptor는 맞았는데 stale read인지", "descriptor부터 틀렸는지", "descriptor는 맞지만 VA/residency가 틀렸는지"를 빠르게 갈라낼 수 있다.

## App-facing takeaway

앱 개발자에게 보이는 조언은 더 짧다.

- 값이 가끔 오래되면 dependency와 host/device handoff를 먼저 의심한다.
- validation이 descriptor/layout을 말하면 kernel arg 타입, buffer range, 빌드된 kernel interface를 먼저 확인한다.
- GPU fault나 device lost에 가까운 증상은 out-of-bounds, 해제된 buffer, 잘못된 offset 같은 주소 문제를 먼저 줄인다.

성능 최적화에서도 같은 구분이 유용하다. 불필요한 <code>clFinish</code>나 강한 barrier는 stale data를 숨길 수는 있지만, descriptor layout 문제나 range 초과를 고치지 못한다. 반대로 모든 문제를 주소 문제로 보면 필요한 memory dependency를 놓칠 수 있다.

## 한 줄 요약

OpenCL dispatch 디버깅은 먼저 세 축으로 나눈다. 최신 값이 안 보이면 cache/fence visibility, shader가 무엇을 읽는지 틀리면 descriptor/state contract, GPU가 주소에 접근하지 못하면 VM/residency/lifetime 문제다.

## 관련 글

- [OpenCL address space -> descriptor -> PM4 state 계약 추적]({{< relref "2026-05-24-opencl-note-address-space-descriptor-contract.md" >}})
- [GPU VM bind/residency/fault triage: buffer가 GPU에서 보인다는 뜻]({{< relref "2026-05-17-opencl-note-vm-bind-residency-fault-triage.md" >}})
- [PM4 packet ordering과 cache visibility를 분리해서 보기]({{< relref "2026-05-10-opencl-note-pm4-ordering-vs-cache-visibility.md" >}})
- [Descriptor와 pipeline layout compatibility: 같은 모양이어야 재사용된다]({{< relref "2026-05-11-opencl-note-descriptor-pipeline-layout-compat-contract.md" >}})

## 관련 용어

[[descriptor-set]], [[pipeline-layout]], [[clspv]], [[pm4-packet]], [[command-queue]], [[barrier]]
