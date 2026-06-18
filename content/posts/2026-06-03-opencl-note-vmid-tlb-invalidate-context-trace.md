---
title: "VMID가 바뀌면 TLB invalidate도 범위가 맞아야 한다"
date: 2026-06-03
slug: "opencl-vmid-tlb-invalidate-context-trace"
draft: false
type: "note"
series: "opencl-driver-internals"
tags: ["opencl", "vulkan", "driver-dev", "gpu-vm", "vmid", "tlb", "descriptor", "pm4", "context-switch", "mapped-buffer", "trace-walkthrough"]
difficulty: "advanced"
layer: "CL"
---

어제까지는 `__global` buffer argument가 descriptor row로 내려가고, PTE update 뒤에는 TLB invalidate가 필요하다는 흐름을 따로 봤다. 오늘은 그 둘 사이의 더 낮은 질문을 본다.

> stale translation을 지웠다면, 정확히 어느 address space의 translation을 지운 것인가?

GPU는 여러 process/context의 address space를 오간다. 흔히 VMID 같은 작은 hardware context id가 현재 page table root와 translation cache entry를 구분하는 데 쓰인다. 그래서 PTE를 올바르게 쓰고 invalidate packet도 냈더라도, invalidate 범위나 VMID가 dispatch가 사용할 address space와 맞지 않으면 stale translation이 남을 수 있다.

~~~text
descriptor row says: use GPU VA 0x92001000
page table says:     VMID 7 maps 0x92001000 -> page B
TLB still has:       VMID 7, 0x92001000 -> old page A

dispatch runs under VMID 7
  -> shader access can still hit old translation unless VMID 7 entry was invalidated
~~~

핵심은 descriptor correctness, PTE contents, TLB invalidate scope, dispatch VMID를 한 줄로 연결해서 검증해야 한다는 점이다.

## VMID는 왜 필요한가

같은 GPU VA 값이라도 process/context가 다르면 다른 physical page를 가리킬 수 있다.

~~~text
VMID 4: VA 0x92001000 -> physical page X
VMID 7: VA 0x92001000 -> physical page B
~~~

GPU translation cache가 VA만 보고 entry를 재사용하면 큰일 난다. 그래서 translation entry에는 보통 address space를 구분하는 context 정보가 같이 붙는다. 이름과 세부 구현은 GPU마다 다르지만 driver debug 관점에서는 아래 질문이 중요하다.

- dispatch가 실제로 어떤 VMID/page-table-root로 실행되는가?
- PTE update는 그 VMID의 page table에 적용되었는가?
- TLB invalidate는 그 VMID의 stale entry를 버리도록 발행되었는가?
- invalidate 완료가 dispatch보다 앞에 ordering되었는가?

이 중 하나라도 끊기면 PTE dump와 descriptor dump가 모두 정상이어도 fault나 stale access가 난다.

## trace walkthrough: context switch 뒤 같은 VA를 다시 쓰기

OpenCL runtime이 `out_buf`를 새 BO로 다시 bind하고 dispatch한다고 하자. `out_buf`의 GPU VA range는 재사용되지만 backing page가 바뀐다.

~~~text
t0 previous submit
  vmid=7 out_buf_old bo=82 va=[0x92000000,0x92400000) -> page A
  dispatch completed fence=1401

t1 memory manager
  bo=82 released after fence=1401
  bo=91 allocated for new out_buf
  same va=[0x92000000,0x92400000) reused

t2 VM update
  vmid=7 page_table_root=PTR7
  pte_update_batch=318
  va=0x92001000 old=page A new=page B status=written

t3 translation visibility
  tlb_invalidate_batch=318 scope=vmid:7 status=completed

t4 dispatch submit
  submit=2200 queue=Q0 engine=compute0 vmid=7
  descriptor binding1 out_buf bo=91 va=[0x92000000,0x92400000) range=4096
  dispatch_direct packet=77
  release_mem fence=1402
~~~

이 순서에서는 descriptor row, page table, translation cache visibility, dispatch VMID가 같은 address space로 맞물린다.

driver trace에서 보고 싶은 invariant는 아래다.

~~~text
descriptor VA/range for this dispatch
  -> BO bind/residency for the dispatch VMID
  -> PTE update in that VMID page table
  -> TLB invalidate covering that VMID and VA/global scope as required
  -> dispatch recorded under the same VMID/page-table-root
  -> fence/event completion before lifetime release
~~~

## 실패 trace: invalidate는 있었지만 VMID가 다르다

문제가 있는 로그는 겉보기에는 그럴듯하다.

~~~text
pte_update_batch=319 vmid=7 va=0x92001000 new=page B status=written
tlb_invalidate_batch=319 scope=vmid:4 status=completed
submit=2201 vmid=7 descriptor_va=0x92001000
DISPATCH_DIRECT

fault:
  submit=2201 vmid=7 fault_va=0x92001040 access=write reason=page_not_present
~~~

여기서 `tlb_invalidate`라는 단어만 보면 필요한 작업을 한 것처럼 보인다. 하지만 dispatch는 VMID 7에서 실행되었고 invalidate는 VMID 4에 적용되었다. VMID 7의 stale translation은 그대로 남을 수 있다.

비슷한 변형도 있다.

| 로그에 보이는 것 | 실제 위험 |
|---|---|
| PTE update 완료 | translation cache가 아직 old entry를 들고 있을 수 있음 |
| TLB invalidate 완료 | scope가 다른 VMID/context일 수 있음 |
| descriptor range 정상 | VA가 valid하다는 뜻이지 translation visibility를 증명하지는 않음 |
| fence signal 없음 | dispatch 전 fault, hang, reset 중 어느 쪽인지 추가 증거가 필요함 |

그래서 fault triage는 `fault_va`만 보지 말고 `fault_vmid`, page-table-root, PTE batch, invalidate batch, descriptor generation을 같은 submit id로 묶어야 한다.

## descriptor row correctness와 VMID correctness는 별도다

어제 본 `__global` binding trace를 오늘 상황에 붙이면 구분이 더 선명해진다.

~~~text
shader interface:
  binding1 = storage buffer write

runtime descriptor row:
  binding1 -> out_buf bo=91 va=[0x92000000,0x92400000)

KMD VM state:
  vmid=7 PTR7 maps 0x92001000 -> page B
  required invalidate scope includes vmid=7

PM4-visible submit:
  SET_DESCRIPTOR_BASE descriptor_table=D44
  SET_CONTEXT_REG vmid/page-table-root selection, conceptually
  WAIT_VM_UPDATE batch=319
  TLB_INVALIDATE scope=vmid:7
  DISPATCH_DIRECT
~~~

여기서 PM4-visible 이름들은 trace에서 확인하고 싶은 역할을 드러내기 위한 개념적 표기다. 실제 packet/register 이름과 VMID/page-table-root programming 방식은 GPU 세대와 driver stack마다 달라질 수 있다.

descriptor row가 맞다는 말은 shader가 어떤 VA range를 접근할지를 정확히 기록했다는 뜻이다. 하지만 그 VA가 dispatch VMID에서 새 translation으로 보이는지는 KMD/VM ordering 쪽 질문이다.

반대로 VMID와 TLB invalidate가 정확해도 descriptor row가 binding 1 대신 binding 0에 들어갔다면 shader는 여전히 잘못된 buffer를 쓴다. 두 검사는 서로를 고쳐 주지 않는다.

## reset 또는 context switch 뒤에는 epoch도 같이 본다

GPU reset 뒤에는 더 조심해야 한다. reset은 queue/context의 진행 상태를 무효화할 수 있고, VMID 재사용도 일어날 수 있다. 이때 stale metadata를 그대로 믿으면 이전 epoch의 완료나 invalidate를 새 dispatch에 잘못 연결할 수 있다.

~~~text
before reset:
  epoch=12 vmid=7 fence=1401 invalidate_batch=318

after reset:
  epoch=13 vmid=7 reused
  page_table_root may be reprogrammed
  old fence/invalidate evidence must not prove new dispatch readiness
~~~

따라서 trace에는 VMID만이 아니라 context epoch 또는 page-table-root identity도 남기는 편이 좋다. 같은 VMID 숫자가 보인다는 이유만으로 같은 address space라고 단정하면 reset recovery나 context switch bug를 놓친다.

## mapped/pinned transfer 예제로 보면

앱 개발자에게는 이 이야기가 너무 driver 내부처럼 보일 수 있다. 하지만 mapped/pinned buffer 최적화에서도 같은 구조가 작게 드러난다.

~~~text
mapped/pinned path:
  CPU writes mapped memory
  runtime performs required flush / ownership / visibility work
  GPU dispatch reads through descriptor VA
  VM/residency/translation must remain valid until completion
~~~

작은 transfer에서 mapped/pinned가 staging보다 느릴 수 있는 이유는 copy 수만의 문제가 아니다. map/unmap, CPU cache flush, device visibility, residency pressure, synchronization이 모두 end-to-end path에 들어간다. driver 입장에서는 descriptor와 VM/TLB가 정확해야 하고, app 입장에서는 이 비용을 실제 workload 크기와 빈도로 측정해야 한다.

## what this means for driver dev

- submit trace에는 `submit id`, OpenCL event, descriptor generation, BO id, VA range, VMID, page-table-root, context/reset epoch, PTE batch, TLB invalidate batch, dispatch packet, fence seq를 같이 남긴다.
- `PTE update 완료`, `TLB invalidate 완료`, `dispatch VMID 선택`을 별도 상태로 기록한다. invalidate가 있었다는 사실만으로 올바른 address space를 비웠다고 단정하지 않는다.
- fault log의 `fault_va`는 반드시 `fault_vmid`와 함께 본다. VA가 descriptor range 안에 있으면 descriptor bug를 배제하기 전에 PTE permission, residency, TLB scope, context epoch를 확인한다.
- VMID 재사용이나 reset recovery 뒤에는 이전 epoch의 fence/invalidate 증거를 새 submit readiness로 재사용하지 않는다.
- descriptor correctness, cache visibility, translation visibility, BO lifetime을 별도 로그 필드로 유지한다. 한 축이 정상이어도 다른 축의 correctness를 증명하지 않는다.
- PM4 packet ordering을 볼 때는 invalidate packet이 dispatch보다 앞에 있는지만 보지 말고, 그 packet의 scope가 dispatch VMID/page-table-root와 맞는지도 본다.

## app-facing takeaway

앱에서는 VMID를 직접 다루지 않는다. 그래도 buffer 재사용 직후에만 fault가 나거나 값이 이상하면 kernel 코드만 보지 말고 buffer lifetime, event dependency, map/unmap 시점, queue reuse를 같이 확인한다.

성능 쪽에서는 mapped/pinned buffer를 copy 절감 하나로 판단하지 않는다. 작은 transfer나 잦은 동기화에서는 staging copy가 더 단순하고 빠를 수 있으므로, end-to-end latency와 CPU/GPU synchronization 비용을 함께 재는 편이 맞다.

---

## 관련 글

- [__global 버퍼 하나는 dispatch 직전까지 어떻게 내려가나]({{< relref "2026-06-02-opencl-note-global-buffer-bind-to-dispatch-trace.md" >}})
- [PTE update 뒤 TLB invalidate가 필요한 이유: dispatch 전 VA translation trace]({{< relref "2026-06-01-opencl-note-pte-tlb-invalidate-dispatch-trace.md" >}})
- [dispatch 전에 page table과 residency 순서를 고정하기]({{< relref "2026-05-29-opencl-note-page-table-residency-ordering.md" >}})
- [GPU reset 뒤 timeline을 그대로 믿으면 안 되는 이유]({{< relref "2026-05-30-opencl-note-reset-epoch-terminal-event.md" >}})

## 관련 용어

- [[descriptor-set]], [[command-buffer]], [[pm4-packet]], event
