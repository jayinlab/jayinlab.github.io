---
title: "wavefront"
date: 2026-04-13
slug: "wavefront"
type: "glossary"
term: "wavefront"
tags: ["gpu", "amd", "execution"]
related: ["work-item", "work-group", "NDRange"]
---

AMD GPU에서 **동일한 명령을 동시에 실행하는 work-item 묶음**. 보통 64개.

## 상세 설명

GPU는 [[work-item]]을 하나씩 실행하지 않는다. 여러 work-item을 한 묶음으로 만들어 **같은 명령을 같은 사이클에 실행**한다(SIMD 실행). AMD에서는 이 묶음을 wavefront, NVIDIA에서는 warp라고 부른다.

- AMD RDNA/GCN: 기본 wavefront 크기 = **64 lanes**
- AMD RDNA2+: wave32 모드(32 lanes)도 지원
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

64명이 탄 버스. 모두 운전기사(CP)의 지시를 동시에 따른다. 누군가 "나는 다른 행동 하겠다"고 하면, 나머지 63명은 기다려야 한다.
