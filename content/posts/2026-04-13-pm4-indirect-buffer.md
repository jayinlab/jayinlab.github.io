---
title: "PM4 Indirect Buffer — 커맨드 스트림 안의 커맨드 스트림"
date: 2026-04-13
slug: "pm4-indirect-buffer"
draft: false
type: "note"
series: "opencl-deep-dive"
tags: ["pm4", "gpu", "amd", "animation", "command-buffer"]
difficulty: "advanced"
animation: true
layer: "UMD"
---

PM4 시리즈 2탄. [[pm4-packet]] 기초를 이해했다면, 이제 한 단계 더 들어간다.

`IT_INDIRECT_BUFFER` — Main Ring Buffer 안에서 "여기 말고 저쪽 메모리에 있는 패킷들을 실행해"라고 CP에게 알려주는 패킷이다. GPU 커맨드 시스템의 함수 호출에 해당한다.

---

## 왜 Indirect Buffer가 필요한가?

Main Ring Buffer는 드라이버가 직접 패킷을 기록하는 **고정 크기의 원형 버퍼**다. 크기에 제한이 있고, CPU가 직접 쓴다.

하지만 복잡한 렌더링/compute 워크로드는:
- 수천 개의 draw/dispatch 명령이 필요
- GPU가 직접 커맨드를 생성하기도 함 (Indirect Draw, Multi-Dispatch)
- 재사용할 수 있는 커맨드 시퀀스가 있음

이럴 때 **IB(Indirect Buffer)**를 쓴다. Main Ring에는 "저 메모리로 가서 실행해"라는 포인터만 남긴다.

---

## Animation

Main Ring → IT_INDIRECT_BUFFER → IB 점프 → 실행 → 복귀 흐름을 따라가세요.

{{< pm4_ib_anim >}}

---

## IT_INDIRECT_BUFFER 패킷 구조

```
[ Header: Type=3, Opcode=0x32 (IB), Count=2 ]
[ IB_BASE_LO: IB 시작 주소 하위 32bit       ]
[ IB_BASE_HI: IB 시작 주소 상위 32bit       ]
[ IB_SIZE:    실행할 dword 수               ]
```

CP는 이 패킷을 처리할 때:
1. 현재 PC(ring buffer 다음 주소)를 내부 스택에 저장
2. IB_BASE 주소로 PC를 이동
3. IB 안의 패킷들을 순서대로 실행
4. IB_SIZE dword를 모두 처리하면 스택에서 PC를 꺼내 복귀

---

## 계층 구조

IB는 중첩될 수도 있다 (IB 안의 IB). AMD 하드웨어는 보통 4단계까지 지원한다.

```
Main Ring Buffer
  └── IT_INDIRECT_BUFFER ──→ IB Level 1
                                └── IT_INDIRECT_BUFFER ──→ IB Level 2
                                                              └── DISPATCH_DIRECT
                                                              └── ...
                              ← 복귀
  └── IT_EVENT_WRITE
```

Vulkan의 **Secondary Command Buffer**(`vkCmdExecuteCommands`)가 이 IB 메커니즘 위에 구현된다.

---

## Vulkan Secondary Command Buffer와의 관계

```c
// Primary command buffer (→ Main Ring)
vkBeginCommandBuffer(primaryCmdBuf, ...);
vkCmdExecuteCommands(primaryCmdBuf, 1, &secondaryCmdBuf);  // ← IT_INDIRECT_BUFFER
vkEndCommandBuffer(primaryCmdBuf);

// Secondary command buffer (→ IB)
vkBeginCommandBuffer(secondaryCmdBuf, ...);
vkCmdDispatch(secondaryCmdBuf, ...);  // ← DISPATCH_DIRECT
vkEndCommandBuffer(secondaryCmdBuf);
```

드라이버는 `vkCmdExecuteCommands`를 `IT_INDIRECT_BUFFER` 패킷으로 변환한다.

---

## 언제 쓰는가

| 사용 케이스 | 설명 |
|------------|------|
| Secondary Command Buffer | Vulkan multi-threading: 여러 스레드가 각각 IB 생성 |
| GPU-generated commands | GPU 자체가 IB를 채운 뒤 실행 (Indirect Dispatch) |
| Pre-recorded command sequences | 자주 쓰는 커맨드 시퀀스를 IB로 캐시 |

---

## 관련 글

- [PM4 제출 흐름](/pm4-submit-flow-animation/) — Main Ring Buffer와 기본 패킷 구조
- [vkCmdPipelineBarrier](/vulkan-pipeline-barrier/) — IB 경계에서의 동기화
- [clFinish 내부 구현](/clfinish-internals/) — IT_EVENT_WRITE가 fence와 어떻게 연결되는가

## 관련 용어

[[pm4-packet]], [[ring-buffer]], [[command-buffer]], [[command-queue]]
