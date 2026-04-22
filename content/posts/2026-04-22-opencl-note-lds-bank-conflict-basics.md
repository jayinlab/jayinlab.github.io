---
title: "LDS bank conflict 기초 — 왜 같은 __local 접근인데 속도가 갈릴까"
date: 2026-04-22
slug: "opencl-note-lds-bank-conflict-basics"
draft: false
type: "note"
series: "opencl-deep-dive"
tags: ["opencl", "gpu", "local-memory", "lds", "bank-conflict", "performance"]
difficulty: "intermediate"
---

같은 `__local` 메모리를 써도 커널 성능이 크게 달라지는 대표 원인이 **LDS bank conflict**다.
핵심은 간단하다: 한 cycle에 여러 lane이 같은 bank로 몰리면 접근이 직렬화되어 지연이 늘어난다.

## 1) 한 줄 정의

- **LDS bank conflict**: 같은 wavefront(또는 warp) 안의 여러 lane이 같은 cycle에 같은 bank를 요청해, 하드웨어가 요청을 나눠 처리해야 하는 상태

## 2) 왜 느려지나

LDS는 "작은 공유 메모리"이지만 포트/뱅크 수는 유한하다.
접근 주소 패턴이 bank 분산을 잘 만들면 병렬 처리되고, 특정 stride 패턴이 bank를 겹치게 만들면 serialized access가 된다.

- conflict 적음 → 높은 실효 대역폭
- conflict 많음 → 대기 증가, occupancy가 높아도 성능이 안 나옴

## 3) 실전에서 자주 보는 패턴

- 2D 타일링에서 `tile[row][col]` 접근을 transpose할 때
- reduction에서 lane별 인덱스가 `stride`로 증가할 때
- 구조체 배열(SoA/AoS) 배치가 bank aliasing을 만들 때

즉, "알고리즘은 동일"해도 인덱스 수식 하나로 성능이 크게 바뀐다.

## 4) 완화 체크리스트

- `stride`를 bank 수의 배수로 고정하지 않기
- 필요 시 padding 컬럼 추가 (예: `TILE_DIM + 1`)
- 연속 lane이 연속 bank를 치도록 인덱스 재배열
- profiler에서 LDS 관련 stall 카운터 먼저 확인

## 초압축 암기

- LDS는 빠르지만 "무한 병렬"이 아니다.
- 성능은 연산량보다 **주소 패턴(bank 분산)**에 자주 좌우된다.
- `__local`을 썼다는 사실보다, **어떻게 인덱싱했는지**가 더 중요하다.

---

## 관련 글

- [GPU 메모리 coalescing — 왜 같은 연산인데 2배 이상 차이 날까]({{< relref "2026-04-14-opencl-note-memory-coalescing.md" >}})
- [Occupancy — CU 슬롯 얼마나 채웠나]({{< relref "2026-04-13-gpu-occupancy.md" >}})

## 관련 용어

- [[local-memory]], [[wavefront]], [[work-item]], [[work-group]]
