---
title: "driver backend"
date: 2026-09-26
slug: "driver-backend"
type: "glossary"
term: "driver backend"
tags: ["driver", "vulkan", "opencl", "pm4"]
related: ["pm4-packet", "command-buffer", "submit-overhead", "SPIR-V"]
---

API 호출을 **하드웨어가 이해하는 커맨드와 ISA로 낮추는 드라이버 계층**.

## 상세 설명

사양이 정하는 것은 「무엇이 보장되는가」까지고, **어떻게 낮출지는 구현 자유**다. 그 자유가 사는 자리가 backend다.

```
OpenCL C / SPIR-V
  → (frontend) 컴파일·검증
    → (backend) 하드웨어 ISA 생성 · 커맨드 스트림 기록
      → ring buffer 제출
```

같은 [[SPIR-V]]를 넣어도 벤더·드라이버 버전마다 레지스터 할당, 명령 스케줄, 삽입되는 동기화가 달라 **성능과 ISA 모양이 달라질 수 있다.** 그래서 한 기계에서 잰 수치를 사양처럼 말하면 안 된다.

「driver backend」는 사양 용어가 아니라 구현을 가리킬 때 쓰는 통칭이다. 실제 구현체 이름은 따로다 — Mesa의 RADV, 벤더 UMD, [[clspv]]·[[ANGLE]] 같은 번역 계층 등.

## 비유

같은 설계도를 받은 **공장**. 도면(사양)은 하나인데 공장마다 공정이 달라 완성품의 마감이 다르다.
