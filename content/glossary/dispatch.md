---
title: "dispatch"
date: 2026-09-26
slug: "dispatch"
type: "glossary"
term: "dispatch"
tags: ["opencl", "vulkan", "pm4", "dispatch", "execution"]
related: ["pm4-packet", "command-buffer", "NDRange", "work-group", "tiny-dispatch"]
---

compute 커널 한 번을 **GPU에 실행시키라고 지시하는 명령**.

## 상세 설명

API마다 부르는 이름이 다르다.

| API | 호출 | 부르는 이름 |
|---|---|---|
| OpenCL | `clEnqueueNDRangeKernel` | NDRange kernel 실행 |
| Vulkan | `vkCmdDispatch` / `vkCmdDispatchIndirect` | dispatch |
| PM4 (AMD 구현) | `IT_DISPATCH_*` 계열 패킷 | dispatch 패킷 |

「dispatch」는 원래 Vulkan·하드웨어 커맨드 쪽 말이고, OpenCL 사양에는 이 이름이 없다. 이 블로그에서는 **커널 실행 한 번**을 가리키는 공통 호칭으로 쓴다.

### 호출 하나가 패킷 하나는 아니다

한 번의 dispatch에도 보통 아래가 같이 따라와 커맨드 스트림에서는 **여러 패킷 시퀀스**로 전개된다.

- 실행 상태 설정(파이프라인·리소스 바인딩)
- 필요한 동기화·캐시 제어
- 실제 dispatch 트리거

몇 개가 붙는지는 드라이버·상태 변경량에 따라 달라지므로 고정 숫자로 외울 값이 아니다([[pm4-packet]]).

## 비유

주방에 **주문표 한 장**을 넣는 일. 주문표 한 장이 들어가면 접시·불·타이머 세팅 지시가 같이 나간다.
