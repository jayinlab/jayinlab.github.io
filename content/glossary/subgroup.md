---
title: "subgroup"
date: 2026-04-20
slug: "subgroup"
type: "glossary"
term: "subgroup"
tags: ["gpu", "execution", "vulkan", "opencl"]
related: ["wavefront", "work-group", "work-item"]
---

하드웨어 SIMD 락스텝으로 함께 실행되는 **작은 실행 묶음**.

## 상세 설명

subgroup은 work-group 내부의 더 작은 단위다.
하드웨어 파형 크기(warp/wavefront)와 밀접하게 연결된다.

- AMD: wavefront(보통 32/64)
- NVIDIA: warp(보통 32)

subgroup 연산(shuffle, ballot 등)은 work-group 전체 barrier보다 저비용일 때가 많다.

## 왜 중요한가

- 데이터 교환을 local memory + barrier 없이 처리할 수 있는 경우가 있다.
- divergence(분기 발산)와 lane 유휴율을 이해하는 핵심 단위다.
