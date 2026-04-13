---
title: "ring buffer"
date: 2026-04-13
slug: "ring-buffer"
type: "glossary"
term: "ring buffer"
tags: ["gpu", "pm4", "amd", "execution"]
related: ["pm4-packet", "command-buffer", "command-queue"]
---

드라이버와 GPU 사이에서 **[[pm4-packet]]을 전달하는 원형 메모리 버퍼**. GPU 커맨드 스트림의 물리적 통로.

## 상세 설명

ring buffer(또는 command ring)는 드라이버가 GPU에 명령을 전달하는 핵심 메커니즘이다. 원형(circular) 구조이므로 끝에 도달하면 다시 처음으로 돌아간다.

### 구조

```
[  PM4 pkt  |  PM4 pkt  |  PM4 pkt  |  ...  |  PM4 pkt  ]
 ↑ RPTR (GPU가 읽는 위치)            ↑ WPTR (드라이버가 쓰는 위치)
```

- **WPTR (Write Pointer)**: 드라이버가 새 패킷을 쓰는 위치. 패킷 기록 후 WPTR을 전진시키고 GPU에 알린다.
- **RPTR (Read Pointer)**: GPU CP(Command Processor)가 현재 읽는 위치. 패킷 처리 후 자동으로 전진.
- WPTR == RPTR: 버퍼가 비어 있음 (GPU가 따라잡은 상태)

### 제출 흐름

```
1. 드라이버: PM4 패킷을 ring buffer[WPTR]에 기록
2. 드라이버: WPTR 레지스터 업데이트 (GPU에 신호)
3. GPU CP:  WPTR != RPTR 감지 → 패킷 읽기 시작
4. GPU CP:  패킷 디코드 및 실행
5. GPU CP:  RPTR 전진
```

### 크기

일반적으로 수십 KB ~ 수 MB. 너무 빠르게 채우면 드라이버가 대기(throttle)한다.

## 비유

공장 컨베이어 벨트. 드라이버가 앞에서 물건(PM4 패킷)을 올리고, GPU가 뒤에서 꺼내 처리한다. 벨트는 원형이라 무한히 돌아간다.
