---
title: "PM4 packet"
date: 2026-04-13
slug: "pm4-packet"
type: "glossary"
term: "PM4 packet"
tags: ["pm4", "gpu", "amd"]
related: ["command-buffer", "ring-buffer", "command-queue"]
---

AMD GPU의 **Command Processor(CP)가 이해하는 최소 명령 단위**.

## 상세 설명

PM4(Packet Meta-format 4)는 AMD GPU의 커맨드 스트림 포맷이다. 드라이버가 high-level API 명령(vkCmdDispatch 등)을 이 형식으로 변환하여 [[ring-buffer]]에 기록한다.

### 패킷 구조

```
[ Header (32bit) ][ Payload (N×32bit) ]

Header:
  [31:30] Type    — 항상 3 (Type-3 패킷)
  [29:16] Count   — payload 워드 수 - 1
  [15: 8] Opcode  — 명령 종류
  [ 7: 0] Predicate/flags
```

### 주요 Opcode (Type-3)

| Opcode | 이름 | 역할 |
|--------|------|------|
| `0x10` | `IT_INDIRECT_BUFFER` | 다른 버퍼의 패킷 실행 |
| `0x15` | `IT_DISPATCH_DIRECT` | compute shader 직접 실행 |
| `0x76` | `IT_SET_SH_REG` | shader 레지스터 설정 |
| `0x28` | `IT_EVENT_WRITE` | 이벤트/sync 신호 기록 |

## 제출 흐름

```
vkCmdDispatch
  → 드라이버: IT_SET_SH_REG (인자 설정) + IT_DISPATCH_DIRECT
    → ring buffer에 기록
      → GPU CP가 읽어 실행
```

## 비유

GPU에 보내는 **내부 우편물 한 장**. 봉투 앞면(header)에 "무슨 일인지"가 적혀 있고, 내용물(payload)에 세부 정보가 들어 있다.
