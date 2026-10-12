---
title: "global_work_offset=128은 work-group 두 개를 빼는 뜻이 아니다"
date: 2026-10-12
slug: "opencl-global-offset-does-not-reduce-group-count"
draft: false
type: "wrong-note"
series: "opencl-deep-dive"
tags: ["opencl", "ndrange", "global-work-offset", "work-group", "angle", "clspv", "spirv", "vulkan", "dispatch", "driver-dev"]
difficulty: "intermediate"
animation: true
---

이번 주 1차원 NDRange 문항에서 `global_work_size=960`, `local_work_size=64`, `global_work_offset=128`을 보고 **앞의 work-group 두 개를 빼서 13개만 실행한다**는 계산이 나왔다. `128/64=2`라는 나눗셈 자체는 맞지만, 그 2가 무엇을 뜻하는지를 잘못 붙인 셈이다.

먼저 두 질문을 떼어 놓자.

- **몇 개 실행하나?** `960/64=15` work-group, work-item 960개.
- **어떤 global ID를 보나?** 첫 work-item의 `get_global_id(0)`가 128이고, 마지막이 1087이다.

택배 비유로는 박스 **960개**를 64개씩 **15대**의 트럭에 싣는다. 박스에 붙인 번호가 128부터 시작한다고 트럭 두 대를 취소하지는 않는다. 비유의 한계는 실제 GPU에서 ID는 주소나 메모리 영역 그 자체가 아니라 kernel이 계산에 사용할 값이며, work-group과 wave도 같은 단위가 아니라는 점이다.

## 먼저 확정된 코드 사실

- Khronos의 `clEnqueueNDRangeKernel` 명세는 `_global_work_offset_`을 “work-item의 global ID를 계산하는 데 쓰는 offset”이라고 정의한다. `_global_work_size_`는 실행할 global work-item의 **개수**, `_local_work_size_`는 work-group의 work-item **개수**를 기술한다. 즉 offset과 size는 API에서부터 별도의 입력이다.
  Source: [OpenCL-Docs `api/opencl_runtime_layer.asciidoc` L12015–12038](https://github.com/KhronosGroup/OpenCL-Docs/blob/main/api/opencl_runtime_layer.asciidoc#L12015-L12038)
- 같은 명세는 global ID가 global size와 global offset을 사용해 계산된다고 설명한다. 이 예시처럼 `960`이 `64`로 정확히 나뉘면 non-uniform remainder는 생기지 않는다. 나누어떨어지지 않을 때의 remainder에는 별도의 지원 조건과 규칙이 있다.
  Source: [OpenCL-Docs L12075–12117](https://github.com/KhronosGroup/OpenCL-Docs/blob/main/api/opencl_runtime_layer.asciidoc#L12075-L12117)
- 공개 ANGLE Vulkan backend의 확인한 revision에서 `enqueueNDRangeKernel`은 `createUniformRegions(...)`를 순회한다. region offset push constant에는 `enqueueNDRange.globalWorkOffset + uniformRegion.globalWorkOffset`을 넣고, dispatch에는 **별도로** `uniformRegion.getWorkgroupCount()`에서 얻은 count를 넣는다.
  Source: [ANGLE `CLCommandQueueVk.cpp` L1387–1437, commit 48739e4](https://chromium.googlesource.com/angle/angle/+/48739e490fbcc602e4c86dac545e9fd32d0f9e6c/src/libANGLE/renderer/vulkan/CLCommandQueueVk.cpp#1387)
- ANGLE 코드에는 region의 group offset도 별도로 있다. 이 값은 `uniformRegion.globalWorkOffset / enqueueNDRange.localWorkSize`로 계산한다. 위의 **사용자 지정** `enqueueNDRange.globalWorkOffset=128`을 그대로 2개의 region group offset이라고 읽는 코드가 아니다.
  Source: [ANGLE `CLCommandQueueVk.cpp` L1410–1428, 같은 revision](https://chromium.googlesource.com/angle/angle/+/48739e490fbcc602e4c86dac545e9fd32d0f9e6c/src/libANGLE/renderer/vulkan/CLCommandQueueVk.cpp#1410)

여기까지가 코드/스펙에서 직접 확인한 부분이다. 아래부터는 해석이다.

## 숫자를 두 축으로 고정하기

이 글의 1차원 **uniform** 예시에서는 다음처럼 펼칠 수 있다.

~~~text
GWS = 960, LWS = 64, global_work_offset = 128
work-group count = 960 / 64 = 15
local ID = 0..63, group ID = 0..14
global ID = 128 + group ID × 64 + local ID
first group: gid 128..191
last group:  gid 1024..1087
~~~

따라서 `128/64=2`는 이 NDRange의 **실행량을 빼는 항**이 아니다. `global_work_offset`을 0에서 128로 바꿔도 GWS/LWS가 그대로라면 work-group count는 15로 남는다. 반대로 *global_work_size 자체를* 832로 바꾸면 그때는 `832/64=13` group이 된다. 이 둘은 호출 인자가 다르다.

아래 기존 애니메이션은 offset이 0이고 나누어떨어지는 예시에서 GWS/LWS가 Vulkan group count로 내려가는 길을 보여 준다. **애니메이션 자체는 이번 `offset=128`을 표시하지 않는다.** Step 3의 group-count 계산만 가져오고, ID 시작점은 위 수식으로 따로 더해야 한다.

{{< gws_lws_dispatch_anim >}}

## OpenCL → ANGLE/clspv → Vulkan에서 어디를 볼까

이 조건의 논리적 분리는 다음과 같다.

~~~text
OpenCL enqueue: GWS=960, LWS=64, offset=128
  ├─ 실행 모양: 15 groups × 64 work-items
  └─ 논리적 global ID: 128..1087

ANGLE Vulkan 경로(확인한 revision):
  ├─ uniform-region workgroup count → dispatch count
  └─ NDRange global offset + region offset → region-offset push constant

clspv/SPIR-V shader interface:
  └─ 그 offset을 실제 get_global_id 계산에 어떻게 쓰는지 산출물로 확인

AMD driver/PM4:
  └─ 제출된 dispatch와 state는 target trace로 확인
~~~

공개 ANGLE 코드에서 **offset을 전달하는 자리**와 **group count를 dispatch에 전달하는 자리**가 다른 것은 확인했다. 하지만 이 글만으로 특정 Android+AMDGPU build의 SPIR-V가 어떤 instruction 조합으로 `get_global_id`를 만들었는지, driver가 어떤 PM4 packet을 냈는지는 확인하지 못한다. ANGLE의 확인한 revision도 모든 배포 버전의 동작을 보장하지 않는다.

또 하나의 실무 함정: `gid`를 그대로 배열 index로 쓰면 `gid=128..1087`이다. 버퍼가 960개 원소뿐인 예시라면 그것으로 안전하다고 할 수 없다. 의도한 배열이 0..959라면 kernel이 `get_global_id(0) - get_global_offset(0)` 같은 상대 index를 쓰거나, 버퍼 범위와 indexing 계약을 별도로 맞춰야 한다. **offset은 버퍼 포인터를 자동으로 이동시키지 않는다.** 이 문단은 API 입력을 kernel indexing에 적용한 설계 해석이며, 실제 buffer size와 kernel 코드를 보지 않고 안전성을 판정할 수는 없다.

## 교정된 모델과 한 번 더 계산

- **처음의 기술 모델:** offset 128은 64개짜리 group 두 개를 건너뛰므로 `15-2=13` group이다.
- **충돌한 사실:** offset은 global ID 계산 입력이고, 실행할 work-item 수는 GWS로 지정한다. ANGLE도 offset push constant와 dispatch group count를 별도로 다룬다.
- **수정된 모델:** `GWS/LWS`가 uniform group count를 정하고, offset은 그 work-item들에게 부여할 global ID의 시작점을 옮긴다.

변형 문제로 `GWS=256`, `LWS=32`, `offset=96`을 넣으면 **8 group, group ID 0..7, global ID 96..351**이다. `96/32=3`을 빼서 5 group으로 만들지 않는다. 이 구분이 붙으면 그다음에야 SPIR-V의 ID lowering과 실제 AMD dispatch trace를 서로 대조할 수 있다.

---

## 관련 글

- [GWS/LWS가 Vulkan Dispatch로 내려갈 때]({{< relref "2026-04-21-opencl-note-gws-lws-to-vulkan-dispatch.md" >}})
- [non-uniform tail은 초과 invocation을 지우는 문제가 아니다]({{< relref "2026-10-05-wrong-note-non-uniform-tail-regions.md" >}})

## 관련 용어

- [[NDRange]], [[work-group]], [[work-item]], [[SPIR-V]]
