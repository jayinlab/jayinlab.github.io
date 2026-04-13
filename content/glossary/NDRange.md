---
title: "NDRange"
date: 2026-04-13
slug: "NDRange"
type: "glossary"
term: "NDRange"
tags: ["opencl", "execution"]
related: ["work-item", "work-group", "wavefront"]
---

OpenCL 커널을 실행할 때 지정하는 **실행 공간(execution space)의 크기와 모양**.

## 상세 설명

NDRange는 "N-Dimensional Range"의 약자다. 커널이 몇 개의 [[work-item]]으로, 어떤 모양으로 실행될지를 정의한다.

- 1D, 2D, 3D 중 하나로 지정 가능
- `global_work_size`: 전체 work-item 수
- `local_work_size`: 한 [[work-group]] 안의 work-item 수
- `global_work_size / local_work_size` = work-group 총 개수

```c
// 예시: 1024개 work-item을 64개씩 묶어 실행
size_t global = 1024;
size_t local  = 64;   // → 16개 work-group
clEnqueueNDRangeKernel(queue, kernel, 1, NULL, &global, &local, ...);
```

## 비유

공장 전체 생산 계획서. "총 1024개 제품을, 64명씩 팀을 나눠 만들어라."

GPU 드라이버는 이 NDRange를 받아 [[pm4-packet]] 형태의 dispatch 명령으로 변환하여 하드웨어에 전달한다.
