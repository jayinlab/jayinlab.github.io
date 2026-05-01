---
title: "OpenCL에서 clFlush와 clFinish를 언제 나눠 써야 하는가"
date: 2026-05-01
slug: "opencl-note-clflush-vs-clfinish"
draft: false
type: "note"
series: "opencl-performance-basics"
tags: ["opencl", "command-queue", "clflush", "clfinish", "daily-facts"]
difficulty: "beginner"
animation: false
---

OpenCL 초반에는 `clFlush`와 `clFinish`를 비슷하게 느끼기 쉽다. 둘 다 queue에 쌓인 작업과 관련이 있지만, **의미와 비용이 다르다**.

핵심만 먼저 정리하면:

- `clFlush`: host가 queue에 쌓아둔 명령을 **device 쪽으로 밀어 넣는 힌트**
- `clFinish`: queue의 이전 명령이 **모두 끝날 때까지 host를 블로킹**

즉, `clFlush`는 "보내기"에 가깝고, `clFinish`는 "끝날 때까지 기다리기"에 가깝다.

## 왜 분리해서 생각해야 하나

성능 관점에서 `clFinish`를 루프마다 넣으면 host-device overlap이 깨진다.

```c
for (int i = 0; i < N; ++i) {
    clEnqueueNDRangeKernel(queue, kernel, ...);
    clFinish(queue); // 매 반복마다 동기화하면 파이프라이닝이 사라짐
}
```

이 패턴은 디버깅에는 직관적이지만, 실제 성능 측정에서는 과도한 직렬화를 만든다.

반대로 `clFlush`는 필요할 때만 넣어도 된다.

- 짧은 작업을 enqueue한 뒤 바로 다른 host 작업을 할 때
- 구현체/드라이버가 submit을 지연할 수 있어, 빠른 전달을 유도하고 싶을 때

## 실전 기준 (간단 체크)

1. **정답 검증/디버깅 단계**
   - 단순성을 위해 `clFinish`를 써도 됨
2. **성능 측정 단계**
   - 루프 안 `clFinish`는 제거
   - event profiling 또는 구간 단위 동기화로 전환
3. **submit cadence 점검 단계**
   - enqueue 구간 뒤 `clFlush` 유무를 비교해 차이를 관찰

## 한 줄 결론

- 정확도 확인: `clFinish`가 안전하지만 비쌈
- 처리량 최적화: `clFinish` 최소화, 필요 시 `clFlush` + event 기반 측정

---

## 관련 글

- [OpenCL에서 clFinish는 "GPU idle"을 보장하지 않는다](/opencl-wrong-note-clfinish-device-idle/)
- [OpenCL 노트: 작은 dispatch에서 submit overhead가 커지는 이유](/opencl-note-small-dispatch-submit-overhead/)

## 관련 용어

[[command-queue]], [[barrier]], [[command-buffer]]
