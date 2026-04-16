---
title: "OpenCL 큰 그림 — Platform에서 clFinish까지 한 번에 보기"
date: 2026-04-16
slug: "opencl-note-opencl-intro-animation"
draft: false
type: "note"
series: "opencl-deep-dive"
tags: ["opencl", "gpu", "beginner", "command-queue", "ndrange"]
difficulty: "beginner"
animation: true
layer: "CL"
---

Vulkan 쪽 애니메이션([큰 그림 심화편](/opencl-note-big-picture-full/))에서 descriptor set, pipeline layout을 봤다면,  
이번에는 **OpenCL**로 같은 saxpy 커널을 실행하는 전 과정을 처음부터 끝까지 따라간다.

핵심 질문: OpenCL에서 GPU 버퍼를 커널에 연결하는 방법은 Vulkan과 무엇이 다른가?

---

{{< opencl_intro_anim >}}

---

## 12장면 구성

### 1막 — 주문 이야기 (장면 1–9)

| 장면 | 내용 | 핵심 API |
|------|------|---------|
| ① | 오늘 할 일 — saxpy | `y[i] = a × x[i] + y[i]` |
| ② | Platform & Device 선택 | `clGetPlatformIDs`, `clGetDeviceIDs` |
| ③ | Context & Command Queue | `clCreateContext`, `clCreateCommandQueue` |
| ④ | 버퍼 생성 + 데이터 복사 | `clCreateBuffer`, `clEnqueueWriteBuffer` |
| ⑤ | Program 컴파일 | `clCreateProgramWithSource`, `clBuildProgram`, `clCreateKernel` |
| ⑥ | 커널 인자 연결 ★ | `clSetKernelArg(k, 번호, 크기, &버퍼)` |
| ⑦ | NDRange 설정 | `global_size=1M`, `local_size=64` → 15,625 work-groups |
| ⑧ | 실행 명령 등록 | `clEnqueueNDRangeKernel` |
| ⑨ | GPU 처리 + 결과 수령 | wavefront 64개 동시 실행, `clEnqueueReadBuffer`, `clFinish` |

### 2막 — OpenCL 언어로 (장면 10–12)

| 장면 | 내용 | 핵심 포인트 |
|------|------|------------|
| ⑩ | API 이름으로 다시 보기 | 배달 비유 → OpenCL 이름 레이블 |
| ⑪ | OpenCL vs Vulkan 비교 | `clSetKernelArg`(직접) vs DSL→DS→bind(단계적) |
| ⑫ | 전체 API 흐름 매핑 | 비유 ↔ API ↔ 설명 3열 정리 |

---

## 핵심: 장면 ⑥ — clSetKernelArg

OpenCL 리소스 바인딩은 놀랍도록 간결하다.

```c
// arg0 ← x 버퍼 (GPU 메모리)
clSetKernelArg(kernel, 0, sizeof(cl_mem), &x_buf);
// arg1 ← y 버퍼
clSetKernelArg(kernel, 1, sizeof(cl_mem), &y_buf);
// arg2 ← 결과 버퍼
clSetKernelArg(kernel, 2, sizeof(cl_mem), &out_buf);
// arg3 ← 스칼라 a
clSetKernelArg(kernel, 3, sizeof(float), &a);
```

Vulkan에서 같은 작업에 필요한 것:
```
vkCreateDescriptorSetLayout(...)   // 칸 규격서
vkAllocateDescriptorSets(...)      // 실제 트럭 생성
vkUpdateDescriptorSets(...)        // 박스 배정
vkCmdBindDescriptorSets(...)       // dispatch 전 바인딩
```

**OpenCL = index 번호로 직접 꽂는다. Vulkan = 규격서-트럭-배정-바인딩 4단계.**

---

## 장면 ⑦: NDRange가 work-item을 나누는 방식

```c
size_t global_size = 1000000;   // 전체 work-item 수
size_t local_size  = 64;        // work-group 하나의 크기

// work-group 수 = 1,000,000 / 64 = 15,625

clEnqueueNDRangeKernel(
    q,            // command queue
    kernel,       // cl_kernel
    1,            // 1D
    NULL,         // global offset
    &global_size,
    &local_size,
    0, NULL, NULL // 이벤트 없음
);
```

커널 코드 안에서:
```c
int i = get_global_id(0);  // 0 ~ 999,999
out[i] = a * x[i] + y[i];
```

모든 work-item이 자기 `i` 번호로 동시에 계산한다.

---

## 장면 ⑨: 전체 실행 흐름 (코드 요약)

<details>
<summary>전체 코드 보기 — saxpy_opencl.c (핵심 흐름)</summary>

```c
// 1. Platform & Device
cl_platform_id platform;
cl_device_id device;
clGetPlatformIDs(1, &platform, NULL);
clGetDeviceIDs(platform, CL_DEVICE_TYPE_GPU, 1, &device, NULL);

// 2. Context & Queue
cl_context ctx = clCreateContext(0, 1, &device, NULL, NULL, &err);
cl_command_queue q = clCreateCommandQueueWithProperties(ctx, device, 0, &err);

// 3. Buffers
cl_mem x_buf = clCreateBuffer(ctx, CL_MEM_READ_ONLY|CL_MEM_COPY_HOST_PTR,
                               N*sizeof(float), host_x, &err);
cl_mem y_buf = clCreateBuffer(ctx, CL_MEM_READ_WRITE|CL_MEM_COPY_HOST_PTR,
                               N*sizeof(float), host_y, &err);
cl_mem out_buf = clCreateBuffer(ctx, CL_MEM_WRITE_ONLY,
                                N*sizeof(float), NULL, &err);

// 4. Program & Kernel
cl_program prog = clCreateProgramWithSource(ctx, 1, &src, &srcLen, &err);
clBuildProgram(prog, 1, &device, NULL, NULL, NULL);
cl_kernel k = clCreateKernel(prog, "saxpy", &err);

// 5. SetKernelArg (★ 핵심 — descriptor set 없이 직접!)
clSetKernelArg(k, 0, sizeof(cl_mem), &x_buf);
clSetKernelArg(k, 1, sizeof(cl_mem), &y_buf);
clSetKernelArg(k, 2, sizeof(cl_mem), &out_buf);
clSetKernelArg(k, 3, sizeof(float), &a);

// 6. Enqueue & Execute
size_t gsize = N, lsize = 64;
clEnqueueNDRangeKernel(q, k, 1, NULL, &gsize, &lsize, 0, NULL, NULL);

// 7. Read result
clEnqueueReadBuffer(q, out_buf, CL_FALSE, 0, N*sizeof(float), host_out, 0,NULL,NULL);
clFinish(q);

// 8. Cleanup
clReleaseMemObject(x_buf); clReleaseMemObject(y_buf); clReleaseMemObject(out_buf);
clReleaseKernel(k); clReleaseProgram(prog);
clReleaseCommandQueue(q); clReleaseContext(ctx);
```

</details>

---

## OpenCL vs Vulkan 핵심 비교 3줄

```
1. OpenCL: clSetKernelArg(k, index, size, &buf) — index 번호로 직접 바인딩
2. Vulkan:  DSL → AllocDS → WriteDS → BindDS — 4단계 명시적 바인딩
3. OpenCL = 이식성·간결함 우선 / Vulkan = 낮은 수준 GPU 제어 우선
```

---

## 관련 글

- [GPU 배송센터 심화편 (Vulkan)](/opencl-note-big-picture-full/) — Vulkan 버전 같은 saxpy
- [Arg0→슬롯 미니 예제](/opencl-note-arg0-to-slot/) — clspv로 OpenCL→Vulkan 변환
- [초등학생 큰 그림](/opencl-note-big-picture-kids/) — 배송센터 비유 9단계

## 관련 용어

[[work-item]], [[NDRange]], [[command-queue]], [[descriptor-set]], [[SPIR-V]], [[clspv]]
