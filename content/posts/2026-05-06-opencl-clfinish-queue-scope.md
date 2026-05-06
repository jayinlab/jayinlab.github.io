---
title: "clFinish는 디바이스 전체 대기가 아니다: queue 단위 완료를 정확히 보기"
date: 2026-05-06
slug: "opencl-clfinish-queue-scope"
draft: false
type: "note"
series: "opencl-deep-dive"
tags: ["opencl", "synchronization", "queue", "clfinish"]
difficulty: "beginner"
---

OpenCL을 처음 볼 때 `clFinish(queue)`를 "GPU가 완전히 멈출 때까지 기다리는 함수"로 이해하기 쉽다.  
하지만 실제 의미는 더 좁다.

핵심은 하나다.

- `clFinish(queue)`는 **해당 queue에 enqueue된 작업이 끝날 때까지** 기다린다.

즉, 같은 컨텍스트 안에 queue가 여러 개라면, 다른 queue의 작업은 계속 진행될 수 있다.

## 왜 이 차이가 중요한가

실제 성능 분석에서 가장 흔한 오해가 여기서 나온다.

- "`clFinish`를 넣었는데도 GPU 사용률이 남아있네?"
- "동기화했는데 왜 로그 순서가 예상과 다르지?"

이런 경우 대부분은 **queue 범위를 섞어서 관찰**했기 때문이다.

## 최소 예시

```c
// queueA, queueB는 같은 디바이스/같은 컨텍스트에 속한다고 가정
clEnqueueNDRangeKernel(queueA, kernelA, ...);
clEnqueueNDRangeKernel(queueB, kernelB, ...);

clFinish(queueA); // kernelA 완료는 보장
// 이 시점에 kernelB는 아직 실행 중일 수 있음
```

위 코드에서 `clFinish(queueA)` 직후에 host가 관찰하는 상태는:

- `queueA`의 작업: 완료 보장
- `queueB`의 작업: 미완료 가능

## 실무에서 안전하게 보는 습관

1. 완료 기준을 "디바이스"가 아니라 "queue"로 먼저 정의한다.  
2. 여러 queue를 쓰면 queue별 이벤트 타임라인을 따로 기록한다.  
3. 전체 완료가 필요하면 queue별 `clFinish` 혹은 이벤트 의존 그래프를 명시적으로 구성한다.

## 한 줄 정리

`clFinish`는 "GPU 전체 정지 스위치"가 아니라, **특정 command queue의 완료 대기**다.

---

## 관련 글

- [clFinish에서 진짜 기다리는 것: fence부터 wake-up까지]({{< relref "2026-04-28-opencl-wrong-note-clfinish-device-idle.md" >}})
- [OpenCL 이벤트 wait list는 자동 병렬화 장치가 아니다]({{< relref "2026-05-04-opencl-wrong-note-event-waitlist-parallelism.md" >}})

## 관련 용어

- [[command-queue]], [[barrier]], [[work-group]]
