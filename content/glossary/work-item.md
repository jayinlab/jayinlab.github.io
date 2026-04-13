---
title: "work-item"
date: 2026-04-13
slug: "work-item"
type: "glossary"
term: "work-item"
tags: ["opencl", "execution"]
related: ["work-group", "NDRange", "wavefront"]
---

GPU에서 실행되는 **가장 작은 논리 스레드 단위**.

## 상세 설명

OpenCL에서 커널(kernel) 함수 하나를 실행하는 단위다. CPU의 스레드와 유사하지만, GPU에서는 수천 개의 work-item이 동시에 병렬 실행된다.

- 각 work-item은 고유한 `get_global_id()` 값을 가진다
- work-item끼리 직접 통신할 수 없다 — [[work-group]] 내에서만 [[barrier]]로 동기화 가능
- 실제 GPU 하드웨어에서는 여러 work-item이 [[wavefront]](AMD) 또는 warp(NVIDIA) 단위로 묶여 동일한 명령을 실행한다

## 비유

공장 조립 라인의 **작업자 한 명**. 같은 작업 지시서(커널 코드)를 받지만, 각자 다른 부품 번호(global ID)를 담당한다.
