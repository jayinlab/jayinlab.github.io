---
title: "AMD PM4 개요 — Type-3 패킷 구조와 Dispatch 패밀리 opcode"
date: 2026-04-13
slug: "opencl-note-pm4-overview"
draft: false
type: "note"
series: "opencl-deep-dive"
tags: ["pm4", "gpu", "amd"]
difficulty: "intermediate"
---

"OpenCL enqueue → Vulkan dispatch → 그다음은?"  
그다음이 PM4다. 드라이버가 하드웨어에 전달하는 **패킷 기반 command stream**.  
세부 비트필드 암기보다 **명령 스트림 mental model**을 먼저 만든다.

---

## PM4를 한 줄로

PM4는 GPU에 전달되는 **패킷 기반 command stream 포맷**이다.

```
CPU/드라이버 → PM4 패킷 작성 → Ring Buffer에 기록
                                    ↓
                           GPU CP(Command Processor)가 패킷 해석 → 실행
```

앱이 직접 PM4를 쓰지 않는다. Vulkan API 호출이 드라이버에 의해 최종적으로 PM4 패킷 시퀀스로 변환된다.

---

## Type-3 패킷 구조

PM4에는 여러 타입이 있지만, **Type-3이 실질적인 동작 명령**을 담는다.

```
[ Header: IT_TYPE=3 | Opcode | Count ]
[ Payload Word 0                     ]
[ Payload Word 1                     ]
[ ...                                ]
```

| 필드 | 의미 |
|------|------|
| IT_TYPE=3 | Type-3 패킷 (4비트) |
| Opcode | 무슨 명령인지 |
| Count | payload dword 수 - 1 |
| Payload | opcode에 따른 파라미터 |

---

## Dispatch 패밀리 주요 opcode

| Opcode | 이름 | 역할 |
|--------|------|------|
| `0x15` | `IT_DISPATCH_DIRECT` | 직접 dispatch (x/y/z 지정) |
| `0x1D` | `IT_DISPATCH_INDIRECT` | 버퍼에서 dispatch 파라미터 읽기 |
| `0x15` | `IT_SET_SH_REG` | Shader 레지스터 설정 |
| `0x46` | `IT_EVENT_WRITE` | 이벤트/fence 기록 |
| `0x32` | `IT_INDIRECT_BUFFER` | 다른 메모리의 패킷으로 점프 |

---

## OpenCL → Vulkan → PM4 연결 사다리

```
1. clEnqueueNDRangeKernel (OpenCL)
        ↓
2. vkCmdDispatch (Vulkan)
        ↓
3. 드라이버가 command stream 준비
        ↓
4. IT_SET_SH_REG (레지스터 설정 패킷들)
   IT_DISPATCH_DIRECT (dispatch 트리거)
        ↓
5. GPU CP가 패킷 해석 → Compute Engine에 작업 전달
        ↓
6. Wavefront 스케줄링 → Shader 실행
```

---

## 핵심 mental model 3줄

1. **PM4 = 패킷 스트림** — 개별 명령이 아니라 연속된 패킷의 흐름
2. **Type-3 = 실제 동작 명령 핵심 클래스** — 상태 설정 + dispatch 트리거
3. **Dispatch는 상태 설정 시퀀스 뒤에 트리거됨** — dispatch 패킷 하나만 보면 안 된다

---

## 자주 하는 오해

**오해**: "dispatch 패킷만 보면 된다"  
→ dispatch 앞에 shader 레지스터 설정, 리소스 바인딩 설정 등 많은 준비 패킷이 붙는다.  
"dispatch 비용"은 앞단 상태 전환 비용과 함께 봐야 한다.

**오해**: "PM4는 GPU마다 같다"  
→ AMD 내에서도 세대별 차이가 있다. 지금은 공통 mental model을 만들고, 이후 세대별 디테일로 들어간다.

---

## 이해 확인 질문

### Q1. PM4는 API 계층에서 어디쯤에 위치하나?

<details>
<summary>정답 보기</summary>

OpenCL/Vulkan 같은 상위 API 아래, 드라이버가 하드웨어에 제출하는 **하드웨어 근접 명령 스트림 계층**.  
앱이 직접 쓰지 않고, Vulkan API 호출이 드라이버에 의해 PM4 패킷으로 변환된다.

</details>

### Q2. 왜 Type-3를 먼저 잡아야 하나?

<details>
<summary>정답 보기</summary>

실제 동작(상태 변경/dispatch 트리거 등)을 담는 **핵심 패킷 클래스**라  
추적 가치가 가장 크기 때문.  
Type-0/1은 레거시 레지스터 기록 방식으로 현재 compute 경로에서 빈도가 낮다.

</details>

### Q3. dispatch 패킷만 보면 충분하지 않은 이유는?

<details>
<summary>정답 보기</summary>

dispatch 전에 필요한 shader 레지스터 설정, 리소스 바인딩 설정 패킷 시퀀스가  
실행 가능성을 결정하기 때문이다.  
이 준비 패킷들이 없으면 dispatch가 올바르게 동작하지 않는다.

</details>

### Q4. PM4 학습에서 먼저 외울 것은 비트필드인가, 시퀀스 구조인가?

<details>
<summary>정답 보기</summary>

**시퀀스 구조가 먼저**다.  
"dispatch 전에 어떤 설정 패킷들이 붙는가"의 흐름을 알아야  
개별 패킷의 비트필드가 왜 그 값인지 의미를 가진다.

</details>

### Q5. PM4 mental model 3줄을 적어봐.

<details>
<summary>정답 보기</summary>

1. PM4 = 패킷 스트림 (연속된 패킷의 흐름)
2. Type-3 = 실제 동작 명령 핵심 클래스
3. Dispatch는 상태 설정 시퀀스 뒤에 트리거됨

</details>

---

## 관련 글

- [PM4 제출 흐름](/pm4-submit-flow-animation/) — vkQueueSubmit → PM4 → ring → GPU 7단계 animation
- [PM4 Indirect Buffer](/pm4-indirect-buffer/) — IT_INDIRECT_BUFFER 패킷과 IB 계층 구조
- [clFinish 내부](/clfinish-internals/) — IT_EVENT_WRITE와 fence 연결

## 관련 용어

[[pm4-packet]], [[ring-buffer]], [[wavefront]], [[command-buffer]]
