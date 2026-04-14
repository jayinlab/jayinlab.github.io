---
title: "Vulkan Pipeline Stage 빠른 정리 — barrier에서 stage 마스크가 뜻하는 것"
date: 2026-04-14
slug: "opencl-note-pipeline-stages"
draft: false
type: "note"
series: "opencl-deep-dive"
tags: ["vulkan", "barrier", "synchronization"]
difficulty: "intermediate"
layer: "VK"
---

`vkCmdPipelineBarrier`를 쓸 때 항상 마주치는 `VK_PIPELINE_STAGE_*` 마스크.  
"왜 이 stage인가"를 이해하지 못하면 너무 넓게 잡거나 너무 좁게 잡는 실수가 반복된다.  
compute 중심으로 자주 쓰는 stage만 정리한다.

---

## 1. Pipeline stage란

GPU는 명령을 파이프라인 단계로 나눠 처리한다.  
`vkCmdPipelineBarrier`는 **"이 앞 명령의 X stage가 끝날 때까지, 이 뒤 명령의 Y stage를 시작하지 마라"**를 표현한다.

```
srcStageMask  = "앞 명령의 어디까지 기다릴 것인가"
dstStageMask  = "뒤 명령의 어디부터 막을 것인가"
```

---

## 2. Compute에서 자주 쓰는 stage 목록

| Stage 이름 | 의미 | 언제 쓰나 |
|-----------|------|-----------|
| `TOP_OF_PIPE` | 파이프라인 진입 직후 (아무 작업 전) | srcMask에서 "아무것도 안 기다려도 될 때" |
| `BOTTOM_OF_PIPE` | 파이프라인 완전 종료 | dstMask에서 "모든 것이 끝난 후" |
| `COMPUTE_SHADER` | compute shader 실행 단계 | dispatch 전후 barrier에서 가장 흔히 사용 |
| `TRANSFER` | copy / blit / clear 명령 | buffer copy 전후 |
| `HOST` | CPU가 메모리에 직접 접근 | CPU write → GPU read 순서 보장 |
| `ALL_COMMANDS` | 모든 stage | 가장 넓은 범위 — 성능 비용 큼 |

---

## 3. Compute dispatch 전후 barrier 예시

### 케이스: dispatch A가 쓴 버퍼를 dispatch B가 읽는다

```c
// dispatch A
vkCmdDispatch(...);

// barrier
VkMemoryBarrier barrier = {
    .srcAccessMask = VK_ACCESS_SHADER_WRITE_BIT,
    .dstAccessMask = VK_ACCESS_SHADER_READ_BIT,
};
vkCmdPipelineBarrier(
    cmd,
    VK_PIPELINE_STAGE_COMPUTE_SHADER_BIT,   // srcStageMask
    VK_PIPELINE_STAGE_COMPUTE_SHADER_BIT,   // dstStageMask
    0, 1, &barrier, 0, NULL, 0, NULL
);

// dispatch B
vkCmdDispatch(...);
```

- `srcStageMask = COMPUTE_SHADER` → A의 compute shader가 끝날 때까지 기다림
- `dstStageMask = COMPUTE_SHADER` → B의 compute shader 시작 전에 barrier 발동
- `srcAccessMask = SHADER_WRITE` → A가 쓴 내용을
- `dstAccessMask = SHADER_READ` → B가 읽기 전에 flush/invalidate

---

## 4. Access mask와 stage mask의 관계

stage mask만으로는 **메모리 가시성(visibility)**이 보장되지 않는다.  
access mask가 함께 있어야 cache flush/invalidate가 일어난다.

```
stage mask  = "언제"  (실행 순서)
access mask = "무엇이" (메모리 내용의 가시성)

둘 다 맞아야 제대로 된 barrier
```

흔한 실수:
```c
// ❌ stage만 잡고 access mask를 0으로 두면
// 실행 순서는 맞아도 이전 캐시 내용이 남아있을 수 있음
.srcAccessMask = 0,
.dstAccessMask = 0,
```

---

## 5. "너무 넓게 잡으면" 어떤 손해인가

```c
// ❌ 과도하게 넓은 barrier
vkCmdPipelineBarrier(
    cmd,
    VK_PIPELINE_STAGE_ALL_COMMANDS_BIT,
    VK_PIPELINE_STAGE_ALL_COMMANDS_BIT,
    ...
);
```

- GPU가 완전히 멈춰서 모든 파이프라인이 비워질 때까지 기다림
- 필요 이상의 stall → 동시 실행 기회 제거
- 프로파일러에서 "GPU idle" 구간으로 보임

올바른 방법: **최소한의 stage와 access 마스크로 필요한 순서만 강제.**

---

## 6. OpenCL barrier vs Vulkan pipeline barrier

| | OpenCL `barrier()` | Vulkan `vkCmdPipelineBarrier` |
|--|-------------------|-------------------------------|
| 범위 | work-group 내부 | command buffer 전체 |
| 대상 | local/global memory | 버퍼/이미지/메모리 |
| 세분화 | 메모리 fence 플래그 | stage + access 마스크 |
| 발동 주체 | GPU 커널 코드 내 | CPU 기록 시점 |

---

## 핵심 3줄

```
1. srcStageMask = "앞 명령의 어디까지 끝나야 하나"
2. dstStageMask = "뒤 명령의 어디부터 막을 것인가"
3. access mask 없이 stage mask만 잡으면 메모리 가시성 미보장
```

---

## 관련 글

- [vkCmdPipelineBarrier 깊이 파기](/vulkan-pipeline-barrier/) — hazard 시나리오 animation
- [local memory/barrier 실습](/opencl-note-local-barrier/) — OpenCL barrier 맥락
- [clFinish 내부](/clfinish-internals/) — CPU-GPU 동기화 전체 그림

## 관련 용어

[[barrier]], [[pipeline-layout]], [[descriptor-set]]
