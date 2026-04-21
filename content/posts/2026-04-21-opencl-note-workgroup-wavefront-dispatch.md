---
title: "work-group → wavefront: dispatch 한 번으로 GPU 안에서 무슨 일이 벌어지나"
date: 2026-04-21
slug: "opencl-note-workgroup-wavefront-dispatch"
draft: false
type: "note"
series: "opencl-deep-dive"
tags: ["opencl", "vulkan", "dispatch", "wavefront", "work-group", "pm4", "performance"]
difficulty: "beginner"
---

이전 노트에서 GWS/LWS → dispatch 매핑을 봤다. 여기서는 **dispatch 한 번으로 GPU 안에서 어떤 계층이 어떻게 펼쳐지는지** 전체 granularity 흐름을 정리한다.

## 단계별 시각화 — work-group → wavefront → dispatch → QueueSubmit

{{< dispatch_granularity_anim >}}

---

## 핵심 혼동 정리: local_size vs groupCount는 완전히 다른 개념

같은 숫자(8×8)를 두 곳에 쓰면 헷갈린다. 이 노트에서는 **다른 숫자**로 명확히 구분한다.

| | 역할 | 어디에 박히나 | 이 예제 |
|---|---|---|---|
| `local_size` | 트럭 1대 크기 (work-group 크기) | 셰이더에 고정 | **32** |
| `groupCount` | 트럭 대수 (work-group 개수) | `vkCmdDispatch()` 인자 | **4** |

```glsl
// 셰이더 (컴파일 타임에 고정)
layout(local_size_x = 32, local_size_y = 1, local_size_z = 1) in;
```

```cpp
// 실행 시점
vkCmdDispatch(4, 1, 1);  // groupCount = 4, 트럭 4대
```

총 work-item = `32 × 4 = 128` ✓

---

## 계층별 흐름 (GWS=128, LWS=32 예제)

### 1) work-item → work-group

- GWS = 128 → LWS = 32으로 나누면 **work-group 4개** 생성
- 각 work-group은 local memory를 공유하고 독립적으로 실행

### 2) work-group → wavefront

work-group 1개가 몇 개의 wavefront로 쪼개지냐는 `local_size ÷ wavefront_size`:

- AMD GCN (wavefront = 64): `32 < 64` → 1 wavefront (절반만 채움)
- RDNA / NVIDIA (warp = 32): `32 = 32` → 1 wavefront/warp

dispatch(4,1,1) → **4 wavefronts** (RDNA 기준)

wavefront 수는 하드웨어마다 다르다. local_size를 wavefront_size의 배수로 맞추는 게 occupancy에 유리하다.

### 3) dispatch(4,1,1)

`vkCmdDispatch(4, 1, 1)` = "work-group 4개를 실행해라". GPU가 즉시 실행하는 게 아니라 **command buffer에 기록**하는 것이다.

### 4) command buffer에 여러 dispatch 담기

```cpp
vkCmdBindPipeline(..., kernel_A);
vkCmdDispatch(4, 1, 1);           // kernel A
vkCmdPipelineBarrier(...);         // 의존성 동기화
vkCmdBindPipeline(..., kernel_B);
vkCmdDispatch(16, 1, 1);          // kernel B (다른 크기)
```

아직 GPU에는 아무것도 전달되지 않았다.

### 5) vkQueueSubmit → 한방에 전달

```cpp
vkQueueSubmit(queue, 1, &submitInfo, fence);
```

이 시점에 command buffer 전체가 ring buffer를 통해 GPU에 전달된다. 드라이버가 각 dispatch를 `IT_DISPATCH_DIRECT` PM4 패킷으로 변환한다.

**dispatch를 N번 따로 submit하는 것과 한 command buffer에 담아서 submit 1번 하는 것은 성능이 완전히 다르다.**

---

## 자주 하는 오해

- 오해 1: `vkCmdDispatch` 호출 = GPU 즉시 실행
  - ❌ 기록만 함. GPU 실행은 `vkQueueSubmit` 이후

- 오해 2: dispatch(4,1,1)이면 work-item 4개
  - ❌ group 4개. work-item 수 = `4 × local_size = 128`

- 오해 3: wavefront 수 = work-group 수
  - ❌ `work-group당 wavefront 수 = local_size ÷ wavefront_size`

---

## 초압축 암기

- `local_size` = 트럭 크기 (셰이더 고정)
- `dispatch(N)` = 트럭 N대 출발 (group 개수)
- `total work-items = local_size × groupCount`
- `wavefronts = groupCount × ceil(local_size / wavefront_size)`
- `vkCmdDispatch` → 기록, `vkQueueSubmit` → 실제 전송

---

## 관련 글

- [OpenCL GWS/LWS가 Vulkan Dispatch로 내려갈 때]({{< relref "2026-04-21-opencl-note-gws-lws-to-vulkan-dispatch.md" >}})
- [Tiny Dispatch에서 진짜 병목: GPU 연산보다 Submit 경로]({{< relref "2026-04-20-opencl-note-small-dispatch-submit-overhead.md" >}})

## 관련 용어

- [[work-group]], [[work-item]], [[wavefront]], [[NDRange]], [[command-buffer]]
