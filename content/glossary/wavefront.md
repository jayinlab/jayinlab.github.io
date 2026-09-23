---
title: "wavefront"
date: 2026-04-13
slug: "wavefront"
type: "glossary"
term: "wavefront"
tags: ["gpu", "amd", "execution"]
related: ["work-item", "work-group", "NDRange"]
---

AMD GPU에서 **동일한 명령을 동시에 실행하는 work-item 묶음**. 크기는 아키텍처에 따라 다르다 — GCN은 64, RDNA는 32가 기본이다.

## 상세 설명

GPU는 [[work-item]]을 하나씩 실행하지 않는다. 여러 work-item을 한 묶음으로 만들어 **같은 명령을 같은 사이클에 실행**한다(SIMD 실행). AMD에서는 이 묶음을 wavefront, NVIDIA에서는 warp라고 부른다.

- **AMD GCN**: wavefront = **64 lanes** 고정
- **AMD RDNA (1세대~)**: 연산 폭이 32 lane이라 **wave32가 native**다. wave64도 쓸 수 있지만 vector instruction을 낮은 32개와 높은 32개로 **두 번에 나눠 실행**한다. compiler가 register 사용량·occupancy·분기 모양을 보고 kernel마다 고른다
- **NVIDIA**: warp = 32 lanes
- OpenCL은 이 차이를 숨기려고 sub-group 크기를 **implementation-defined**로 둔다. `sub-group은 32개`나 `64개`를 가정한 reduction·shuffle은 다른 GPU에서 조용히 틀린다
- 모든 lane이 같은 PC(Program Counter)에서 실행

### Divergence (분기 발산)

```c
if (get_local_id(0) % 2 == 0) {
    // 짝수 lane 실행 → 홀수 lane은 idle
} else {
    // 홀수 lane 실행 → 짝수 lane은 idle
}
```

분기가 생기면 wavefront 안에서 일부 lane이 idle 상태가 된다. 효율이 50%로 떨어질 수 있다.

## 비유

한 대의 버스. 모두 운전기사(CP)의 지시를 동시에 따른다. 누군가 "나는 다른 행동 하겠다"고 하면 나머지는 기다려야 한다. 정원은 GPU마다 다르다 — GCN 64명, RDNA 32명.
