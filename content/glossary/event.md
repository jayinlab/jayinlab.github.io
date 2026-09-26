---
title: "event"
date: 2026-09-26
slug: "event"
type: "glossary"
term: "event"
tags: ["opencl", "synchronization", "event"]
related: ["command-queue", "barrier", "command-buffer"]
---

OpenCL에서 enqueue한 명령 하나의 **진행 상태를 가리키는 핸들**(`cl_event`).

## 상세 설명

`clEnqueue*` 호출에 마지막 인자로 주소를 넘기면 그 명령에 대응하는 event를 돌려받는다. 이 핸들로 두 가지를 한다.

1. **대기** — `clWaitForEvents`로 **그 명령만** 기다린다
2. **의존성 표기** — 다음 enqueue의 `event_wait_list`에 넣어 순서를 건다

### 실행 상태

`clGetEventInfo(CL_EVENT_COMMAND_EXECUTION_STATUS)`가 돌려주는 값은 사양이 정한 네 단계다.

| 상태 | 뜻 |
|---|---|
| `CL_QUEUED` | 큐에 들어갔다 |
| `CL_SUBMITTED` | 디바이스로 보냈다 |
| `CL_RUNNING` | 실행 중이다 |
| `CL_COMPLETE` | 끝났다 |

### clFinish와의 차이

`clWaitForEvents`는 **지정한 event만**, `clFinish(queue)`는 **그 [[command-queue]]의 이전 명령 전부**를 기다린다. 습관적으로 `clFinish`를 넣으면 큐 파이프라이닝이 깨져 커널·복사 겹치기 여지가 줄어든다.

### 곁가지

- `clCreateUserEvent`로 호스트가 직접 신호하는 event를 만들 수 있다(OpenCL 1.1부터).
- 시간 측정에는 큐를 만들 때 `CL_QUEUE_PROFILING_ENABLE`이 켜져 있어야 한다.
- Vulkan에는 이 역할이 `VkFence`·`VkSemaphore`·`VkEvent`로 쪼개져 있다 — 이름이 같은 `VkEvent`와 같은 물건이 아니다.

## 비유

택배 **운송장 번호**. 번호 하나로 그 소포만 조회하고, 「이 소포 도착 후에 시작」 같은 조건을 걸 수 있다.
