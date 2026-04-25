---
title: "Render Pass에서 Subpass Dependency를 왜 따로 쓰는가"
date: 2026-04-25
slug: "opencl-note-subpass-dependency"
draft: false
type: "note"
series: "opencl-deep-dive"
tags: ["vulkan", "synchronization", "render-pass", "subpass", "roadmap"]
difficulty: "intermediate"
---

Vulkan을 공부하다 보면 이런 질문이 생긴다.
이미 `vkCmdPipelineBarrier`가 있는데, 왜 Render Pass 안에서는 `subpass dependency`를 또 설정할까?

핵심은 역할 분리다.

- `vkCmdPipelineBarrier`: command buffer 전체 흐름에서 일반적인 동기화 도구
- `subpass dependency`: Render Pass 내부 attachment read/write 전환을 **렌더링 문맥에 맞게** 선언하는 도구

즉, 둘 다 동기화지만 적용되는 문맥과 최적화 포인트가 다르다.

---

## 직관: "attachment 수명 관리 계약"

Render Pass는 color/depth attachment를 여러 subpass에서 읽고/쓴다.
이때 GPU는 attachment를 tile memory 같은 내부 경로로 최적화할 수 있는데,
의존성이 불명확하면 보수적으로 flush/store/load를 더 많이 하게 된다.

`subpass dependency`는 다음을 명시한다.

1. 어떤 subpass 결과를
2. 다음 subpass의 어떤 stage/access에서
3. 어떤 순서/가시성으로 볼지

그래서 이것은 단순 barrier가 아니라, attachment 수명 전환 계약에 가깝다.

---

## 최소 사고 모델

Subpass A가 color attachment에 write,
Subpass B가 같은 attachment를 input attachment로 read한다고 하자.

이때 dependency가 없다면:
- 실행 순서가 애매하거나
- 메모리 가시성 보장이 부족해
- 벤더별로 undefined behavior에 가까운 결과가 나올 수 있다.

dependency를 넣으면:
- A의 write 완료 시점과
- B의 read 시작 시점이 연결되고
- 필요한 visibility가 보장된다.

---

## 자주 하는 실수

- stage/access를 `ALL_COMMANDS`/`MEMORY_READ|WRITE`로 과도하게 넓힘
  - 동작은 되지만 성능 손해 가능성이 큼
- "같은 Render Pass 안이니까 자동으로 안전하다"고 가정
  - attachment 전환(read-after-write)은 명시가 필요할 수 있음

---

## 기억용 한 줄

**Subpass dependency는 Render Pass 내부 attachment 전환을 위한 맞춤형 동기화 계약이다.**

---

## 관련 글

- [vkCmdPipelineBarrier 깊이 파기](/vulkan-pipeline-barrier/)
- [OpenCL→Vulkan→PM4 학습 로드맵](/wiki/learning-roadmap/)

## 관련 용어

[[barrier]], [[command-buffer]], [[descriptor-set]]
