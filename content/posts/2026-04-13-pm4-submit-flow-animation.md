---
title: "PM4 제출 흐름 — vkQueueSubmit에서 GPU 실행까지 (Animation)"
date: 2026-04-13
slug: "pm4-submit-flow-animation"
draft: false
type: "note"
series: "opencl-deep-dive"
tags: ["pm4", "vulkan", "gpu", "amd", "animation", "command-buffer", "ring-buffer"]
difficulty: "intermediate"
animation: true
---

GPU에 "이 계산 실행해"라고 말하면, 실제로 어떤 일이 일어날까?

이 글은 `vkQueueSubmit`이 호출된 순간부터 Shader Engine이 workgroup을 실행하는 순간까지, **7단계 흐름을 직접 눈으로 따라갈 수 있도록** 만든 animation이다.

---

## 전체 계층 구조

```
Application
  └── vkQueueSubmit (VkCommandBuffer 제출)
        └── Driver (커맨드 파싱 → PM4 변환)
              ├── IT_SET_SH_REG  ← 커널 인자 레지스터 설정
              └── IT_DISPATCH_DIRECT  ← compute shader 실행
                    └── Ring Buffer (WPTR 전진 → GPU 신호)
                          └── GPU Command Processor
                                └── Shader Engine (workgroup 배분)
                                      └── wavefront 실행 (64 work-item/wavefront)
```

---

## Animation

"다음 단계" 버튼으로 한 단계씩, 또는 "자동 재생"으로 전체 흐름을 확인하세요.

{{< pm4_submit_anim >}}

---

## 각 단계 설명

### Step 1 — `vkQueueSubmit` 호출

App이 미리 기록해둔 [[command-buffer]]를 [[command-queue]](VkQueue)에 제출한다. 이 시점부터 드라이버가 동작을 시작한다.

```c
VkSubmitInfo submitInfo = { .commandBufferCount = 1, .pCommandBuffers = &cmdBuf };
vkQueueSubmit(queue, 1, &submitInfo, VK_NULL_HANDLE);
```

### Step 2 — 드라이버가 Command Buffer 파싱

드라이버는 `vkCmdDispatch` 같은 **Vulkan 추상 명령**을 GPU 하드웨어가 이해할 수 있는 [[pm4-packet]] 시퀀스로 변환한다. 이 과정은 CPU에서 일어난다.

### Step 3 — `IT_SET_SH_REG` 패킷 생성

커널 인자([[descriptor-set]] 주소, push constant 등)를 GPU 셰이더 레지스터에 세팅하는 패킷이다.

```
Header:  Type=3 | Count=N | Opcode=0x76 (SET_SH_REG)
Payload: 레지스터 번호 + 값들
```

dispatch 전에 반드시 이 패킷이 먼저 와야 한다. 레지스터를 먼저 설정해야 셰이더가 인자를 읽을 수 있기 때문이다.

### Step 4 — `IT_DISPATCH_DIRECT` 패킷 생성

실제 compute shader를 실행시키는 패킷이다. X/Y/Z workgroup 수를 payload에 담는다.

```
Header:  Type=3 | Count=3 | Opcode=0x15 (DISPATCH_DIRECT)
Payload[0]: DIM_X (workgroup 수 X축)
Payload[1]: DIM_Y (workgroup 수 Y축)
Payload[2]: DIM_Z (workgroup 수 Z축)
```

OpenCL의 `global_work_size / local_work_size`가 이 DIM 값이 된다.

### Step 5 — Ring Buffer에 기록 + WPTR 전진

드라이버가 생성한 패킷들을 [[ring-buffer]]에 순서대로 기록한다. 기록이 끝나면 **WPTR(Write Pointer) 레지스터를 업데이트**한다. 이것이 GPU에 보내는 신호다.

```
ring buffer: [SET_SH_REG header | payload | DISPATCH header | dim X/Y/Z | ...]
                                                                          ↑ WPTR
```

### Step 6 — GPU CP가 패킷 읽기

GPU의 Command Processor(CP)는 WPTR ≠ RPTR를 감지하면 즉시 읽기를 시작한다.

1. `IT_SET_SH_REG` 패킷 읽기 → 레지스터에 커널 인자 로드
2. `IT_DISPATCH_DIRECT` 패킷 읽기 → Shader Engine에 dispatch 신호
3. RPTR 전진

### Step 7 — Shader Engine에서 workgroup 실행

CP로부터 dispatch 신호를 받은 Shader Engine이 work-group들을 Compute Unit(CU)에 배분한다.

- 각 work-group은 [[wavefront]](64 work-item) 단위로 묶여 SIMD 실행
- 모든 work-group 처리가 끝나면 완료 이벤트 발생 → fence/semaphore 신호

---

## 핵심 요약

| 계층 | 역할 | 처리 위치 |
|------|------|-----------|
| vkQueueSubmit | 추상 명령 제출 | CPU (App) |
| PM4 변환 | 추상→하드웨어 명령 | CPU (Driver) |
| Ring buffer 기록 | 명령 전달 통로 | CPU write / GPU read |
| CP 디코드 | 패킷 해석 및 분배 | GPU |
| Shader Engine | 실제 연산 실행 | GPU |

<details>
<summary>OpenCL에서의 동일 흐름 보기</summary>

OpenCL에서 `clEnqueueNDRangeKernel`을 호출하면 ANGLE(on Vulkan)은 내부적으로 아래를 실행한다:

```
clEnqueueNDRangeKernel
  → ANGLE: vkCmdDispatch 기록 (VkCommandBuffer)
    → vkQueueSubmit
      → 드라이버: IT_SET_SH_REG + IT_DISPATCH_DIRECT 생성
        → Ring buffer → GPU
```

즉, OpenCL 사용자는 `clEnqueueNDRangeKernel` 한 줄을 호출하지만, 내부에서는 위의 7단계 전체가 일어난다.

</details>

---

## 관련 글

- [AMD PM4 개요: Type3와 Dispatch 패킷 패밀리](/opencl-note-9-amd-pm4-overview/)
- [Vulkan 관점 10줄 타임라인](/opencl-note-22-vulkan-10-line-timeline/)
- [ANGLE 코드 추적 2차: SPIR-V에서 Vulkan Pipeline/Layout으로](/opencl-note-7-angle-trace-phase2/)

## 관련 용어

[[pm4-packet]], [[ring-buffer]], [[command-buffer]], [[command-queue]], [[wavefront]], [[descriptor-set]]
