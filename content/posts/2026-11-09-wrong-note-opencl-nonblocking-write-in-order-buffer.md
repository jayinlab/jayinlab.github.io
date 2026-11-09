---
title: "비동기 write가 반환됐는데, 다음 kernel은 어느 weights를 읽을까"
date: 2026-11-09
slug: "opencl-nonblocking-write-in-order-buffer-visibility"
draft: false
type: "wrong-note"
series: "opencl-driver-internals"
tags: ["opencl", "angle", "vulkan", "synchronization", "buffer", "kernel-arguments"]
difficulty: "advanced"
animation: true
layer: "CL"
---

택배 접수증을 받았다고 배송이 끝난 것은 아니다. 그런데 배송 완료 뒤에만 출발하도록 묶어 둔 설치 기사까지, 접수증이 먼저 나왔다는 이유로 빈집에 도착하지는 않는다.

OpenCL에서도 두 질문을 나누면 길이 보인다.

- **host 질문:** `clEnqueueWriteBuffer(..., CL_FALSE, ...)`가 반환됐으니 입력 배열을 고쳐도 될까?
- **kernel 질문:** 같은 in-order queue에 그다음 enqueue한 kernel은 갱신된 buffer를 읽을까?

첫 질문은 **write 완료 전에는 안 된다**. 둘째는 **조건이 충족되면 갱신된 내용을 읽는다**. “비동기니까 아무것도 보장되지 않는다”로 묶으면, 서로 다른 시계 두 개를 한 시계로 읽게 된다.

이 글이 바로잡는 모델은 **비동기 반환 = 후속 kernel에도 갱신 미보장**이라는 일반화다. 질문이 남았다는 이유로 확정된 오개념이나 학습 실패로 단정하지는 않는다.

## 먼저 확정된 코드 사실

아래는 이번 글에서 직접 확인한 스펙과 공개 코드다. 링크는 움직이는 `main` 대신 확인 당시 commit으로 고정했다.

1. OpenCL API의 non-blocking write 설명은 “**As the write is non-blocking the implementation can return immediately.**”라고 한다. 즉 구현은 write 완료를 기다리지 않고 반환할 수 있다. 이어서 “**When the write command has completed, the memory pointed to by _ptr_ can then be reused by the application.**”라고 못 박는다. host source의 재사용 기준은 API 반환이 아니라 write 완료다. [OpenCL-Docs `api/opencl_runtime_layer.asciidoc` L1073–1086](https://github.com/KhronosGroup/OpenCL-Docs/blob/fdffbd7027c56366873345bcff1178d1a8469411/api/opencl_runtime_layer.asciidoc#L1073-L1086)
2. in-order의 정의는 “**Commands and any side effects associated with commands appear to the OpenCL application as if they execute in the same order they are enqueued**”다. 명령과 그 부수 효과가 enqueue 순서대로 실행된 것처럼 보여야 한다. 내부 엔진을 반드시 하나씩 직렬 가동하라는 뜻은 아니다. [동일 commit `api/opencl_architecture.asciidoc` L256–273](https://github.com/KhronosGroup/OpenCL-Docs/blob/fdffbd7027c56366873345bcff1178d1a8469411/api/opencl_architecture.asciidoc#L256-L273)
3. 더 강한 근거는 memory ordering 규칙이다. in-order queue의 선행 command 완료 event에는 “**including the event implied ... due to the in-order queue**”가 포함되고, 이 event가 후속 command와 “**global-synchronizes-with**” 관계를 이룬다. 앱에 event handle을 반환하지 않았어도 암묵적 의존성이 있다. event 대기에 의해 선행 command의 메모리 연산이 후속 command의 연산보다 global-happen-before한다는 규칙도 함께 제시된다. [동일 파일 L1945–1982](https://github.com/KhronosGroup/OpenCL-Docs/blob/fdffbd7027c56366873345bcff1178d1a8469411/api/opencl_architecture.asciidoc#L1945-L1982)
4. `clSetKernelArg`는 `_arg_value_`가 가리키는 argument data를 복사한다. `global`/`constant` pointer 인자라면 그 값은 buffer memory object를 지정한다. 이는 **그 buffer의 전체 내용을 복제한다는 문장이 아니다**. [runtime layer L10929–10946](https://github.com/KhronosGroup/OpenCL-Docs/blob/fdffbd7027c56366873345bcff1178d1a8469411/api/opencl_runtime_layer.asciidoc#L10929-L10946)
5. OpenCL C는 `constant` address space를 “**read-only variables that are accessible globally**”로 설명한다. kernel 쪽 read-only 의미이지, host에서 enqueue한 합법적인 write까지 영원히 금지한다는 뜻은 아니다. [동일 commit `OpenCL_C.txt` L2781–2788](https://github.com/KhronosGroup/OpenCL-Docs/blob/fdffbd7027c56366873345bcff1178d1a8469411/OpenCL_C.txt#L2781-L2788)
6. ANGLE의 `CLCommandQueueVk::enqueueWriteBuffer`는 wait-list를 처리하고, blocking이면 `finishInternal()` 뒤 `copyFrom`을 호출한다. non-blocking 분기에서는 `HostWriteTransferConfig`를 만들고 `addToHostTransferList`를 호출한다. 이 함수만 읽어서 “항상 DMA copy command 하나를 기록한다”고 할 수 없다. [ANGLE `CLCommandQueueVk.cpp` L323–351](https://github.com/google/angle/blob/b6c37bfbcdf0aff66d82392e82649adcbaf706f2/src/libANGLE/renderer/vulkan/CLCommandQueueVk.cpp#L323-L351)
7. 같은 ANGLE 파일에서 `finishInternal()`은 `flushInternal()`과 `finishQueueSerialInternal(...)`을 부른다. `onResourceAccess`는 buffer read/write를 추적하고 필요한 경우 flush하는 경로를 가진다. 이것은 구현의 일부이며, 위 write가 언제 어떤 cache 조치를 거치는지 전부 입증한 것은 아니다. [L2522–2560](https://github.com/google/angle/blob/b6c37bfbcdf0aff66d82392e82649adcbaf706f2/src/libANGLE/renderer/vulkan/CLCommandQueueVk.cpp#L2522-L2560)

여기까지가 코드/스펙에서 직접 확인한 부분이다. 아래부터는 해석이다.

## 1. 하나의 buffer, 서로 다른 세 가지 상태

먼저 `weights`가 평범한 OpenCL buffer이고 kernel 인자가 `__constant float *weights`라고 하자. SVM, external memory, `CL_MEM_USE_HOST_PTR`의 alias 특수 사례는 여기서 제외한다.

| 상태 | 무엇을 기억하는가 | 무엇이 바꾸는가 |
|---|---|---|
| host source `next_weights` | write에 제공할 CPU 쪽 바이트 | host의 합법적인 수정 |
| kernel argument | 사용할 `cl_mem` object | `clSetKernelArg` |
| buffer contents | kernel이 읽는 데이터 | write/copy/다른 producer command |

scalar `float alpha`를 인자로 주면 `clSetKernelArg`는 그 scalar 바이트를 복사한다. 이후 host의 `alpha` 변수만 바꿔서는 kernel 인자가 바뀌지 않는다.

반면 buffer 인자에 `&weights`를 주면 buffer object를 지정하는 값을 설정한다. **object를 고정하는 것과 그 object의 내용을 얼리는 것은 다르다.** 같은 buffer에 새 weights를 써 넣는다고 매번 `clSetKernelArg`를 다시 호출할 필요는 없다. 다른 buffer object로 교체한다면 다시 설정해야 한다.

`__constant`도 이름 때문에 헷갈리기 쉽다. 여기서는 kernel이 그 경로로 쓰지 못한다는 뜻이다. buffer 생성 때의 host 접근 제한 flags와는 별개이며, 이 예제는 host write가 허용된 buffer를 전제한다. runtime은 다음 dispatch 전에 바뀐 내용을 올바르게 보이게 해야 한다. “constant cache에 있으니 옛값을 읽어도 된다”는 예외는 없다.

## 2. host는 기다리지 않고, kernel은 의존성을 따른다

다음은 오류 처리를 생략한 순서 예제다. 모든 호출이 성공하고, 같은 host thread가 같은 **in-order** queue에 넣으며, 범위는 유효하고 다른 writer는 없다고 가정한다. `kernel`은 이미 같은 `weights` object에 바인딩돼 있다.

```c
cl_event write_done;
clEnqueueWriteBuffer(q, weights, CL_FALSE, 0, bytes,
                     next_weights, 0, NULL, &write_done);
clEnqueueNDRangeKernel(q, kernel, 1, NULL, &gws, &lws,
                       0, NULL, NULL);
clWaitForEvents(1, &write_done);
clReleaseEvent(write_done);
/* next_weights may now be modified or freed. */
```

**kernel enqueue를 위해 write 완료를 host에서 기다리지 않았다.** 마지막 wait는 kernel을 위한 것이 아니라 host source를 재사용하기 위한 것이다. 그 wait가 반환돼도 kernel 완료까지 보장되는 것은 아니다.

```mermaid
sequenceDiagram
    participant H as Host thread
    participant Q as In-order queue
    participant W as Write command
    participant K as Kernel command
    H->>Q: enqueue W, CL_FALSE
    Q-->>H: API returns; W may be incomplete
    H->>Q: enqueue K; same weights object
    Q->>W: execute W when ready
    W-->>Q: W complete; updated buffer available
    Q->>K: K consumes updated weights
    H->>Q: wait for W event
    Q-->>H: W complete; source may be reused
    Note over H,K: Host wait return and K execution may overlap
```

이것은 물리 엔진의 실측이 아니라, 관측해야 할 의존관계의 그림이다.

API 반환 시점에 write가 **이미 끝났을 수도, 아직 아닐 수도** 있다. `CL_FALSE`는 “반드시 늦게 끝난다”가 아니라 “완료 대기를 요구하지 않는다”다. 어느 경우에도 같은 in-order queue의 후속 kernel이 선행 write를 무시해도 된다는 뜻은 아니다.

또한 그림의 `write complete → kernel` 화살표는 단순한 시각적 순서가 아니다. 앞에서 확인한 global-synchronizes-with 관계가 **갱신된 buffer를 소비할 근거**다. 앱은 여기서 Vulkan barrier를 직접 넣지 않는다. 필요한 내부 메모리 의존성은 OpenCL 구현의 책임이다.

## 3. 정말 위험한 것은 host 입력을 먼저 바꾸는 일

다음 코드는 잘못된 재사용 예다.

```c
clEnqueueWriteBuffer(q, weights, CL_FALSE, 0, bytes,
                     next_weights, 0, NULL, &write_done);
memset(next_weights, 0, bytes); /* Wrong: no completion proof. */
clEnqueueNDRangeKernel(q, kernel, 1, NULL, &gws, &lws,
                       0, NULL, NULL);
```

in-order가 보장하는 것은 **write command와 kernel command 사이**의 의존성이다. host의 `memset`을 queue command로 바꿔 주지 않는다. 구현이 source를 아직 읽는 중일 수 있으므로 write 완료 전에는 덮어쓰거나 해제해서는 안 된다. 이 경우 “kernel이 새값을 읽는다”는 결론의 전제부터 깨진다.

구현이 우연히 enqueue 안에서 source를 복사했더라도, 그것을 모든 실행의 계약으로 삼을 수는 없다. 빠른 장치에서 통과하던 코드가 batching 정책이나 host-memory 배치가 바뀐 뒤 깨질 수 있는 이유다.

재사용 시점은 목적별로 나눈다.

- host source를 다시 채울 때: **write event 완료**를 확인한다.
- 같은 buffer를 다음 kernel이 소비할 때: **queue 의존성**을 세운다.
- kernel 결과를 CPU에서 읽을 때: 별도의 read/map과 그 완료 규칙을 따른다. `clFinish`만 했다고 일반 buffer가 host pointer로 바뀌지는 않는다.

## 4. 다른 queue라면 연결선을 직접 만든다

같은 device, 같은 context, 같은 buffer여도 **다른 queue** 사이에는 위의 in-order 연결이 자동으로 생기지 않는다. out-of-order queue에서도 enqueue 순서만으로 부족하다.

```c
clEnqueueWriteBuffer(copy_q, weights, CL_FALSE, 0, bytes,
                     next_weights, 0, NULL, &write_done);
clFlush(copy_q);
clEnqueueNDRangeKernel(compute_q, kernel, 1, NULL, &gws, &lws,
                       1, &write_done, NULL);
clFlush(compute_q);
```

이번에는 kernel의 wait-list가 연결선이다. `copy_q`의 flush는 **producer가 진행되도록 하는 조건**이고, event 의존성은 **consumer가 무엇을 기다려야 하는가**다. 둘 중 하나를 다른 하나로 대체하면 안 된다. 모든 객체는 호환되는 context에 속하고 event는 유효해야 한다. source 메모리도 여전히 write 완료까지 유지해야 한다.

OpenCL 사양은 다른 queue의 command가 event를 기다릴 때 producer queue를 `clFlush` 또는 implicit flush를 하는 blocking 호출로 진행시키라고 요구한다. `clFlush` 반환은 완료 증거가 아니다. [runtime layer L14604–14623](https://github.com/KhronosGroup/OpenCL-Docs/blob/fdffbd7027c56366873345bcff1178d1a8469411/api/opencl_runtime_layer.asciidoc#L14604-L14623)

매번 `clFinish`를 넣어도 합법적인 순서를 만들 수는 있다. 다만 host가 다음 작업을 넣기 전에 기다리므로, queue가 표현할 수 있던 의존성을 host 직렬 대기로 바꾸게 된다. 아래 기존 그림은 **그 대기가 어느 층을 통과하는지** 보는 대조용이다. write→kernel의 정확한 시간축은 위 Mermaid가 담당한다.

{{< clfinish_anim >}}

그림의 ANGLE queue serial·GFX9 fence 기록은 구현 예다. 이번 weights 갱신이 그 packet을 썼다는 실측 증거가 아니며, 모든 OpenCL backend가 같은 대기 경로를 사용한다는 뜻도 아니다.

## 5. ANGLE 아래로 내릴 때: binding, data, dependency를 따로 본다

Android + AMDGPU 스택을 디버깅한다면, 질문은 “비동기인가?” 하나로 끝나지 않는다.

**첫째, binding.** clspv/SPIR-V의 interface와 runtime의 descriptor가 어느 buffer/range를 가리키는가? 같은 object를 계속 사용하는데 데이터만 바뀌는 상황이라면 descriptor handle이 동일한 것은 자연스럽다. descriptor cache hit가 데이터 불변의 증거는 아니다.

**둘째, data.** host source에서 OpenCL buffer로 어느 범위가 갱신됐는가? 확인한 ANGLE 코드에는 host transfer list가 등장한다. 따라서 이 write를 무조건 `vkCmdCopyBuffer`나 DMA engine으로 그리지 않는다. 실제 경로와 host-visible memory 처리 여부는 추가로 추적해야 한다.

**셋째, dependency.** producer의 쓰기가 consumer의 읽기에 보이도록 runtime이 무엇을 했는가? GPU transfer write라면 transfer→compute 접근 의존성을 살펴볼 수 있고, host write 경로라면 해당 memory의 coherency·flush와 제출 시점 등을 확인해야 한다. 이것은 **경로별 진단 가설**이지, 이번 ANGLE write가 특정 Vulkan barrier를 사용한다는 확인 사실이 아니다.

| 확인할 증거 | 답하려는 질문 | 그것만으로는 모르는 것 |
|---|---|---|
| `cl_mem` id·descriptor buffer/range | 같은 저장 영역을 읽는가 | 최신 write의 가시성 |
| source 유지 기간·write offset/size | 올바른 바이트를 안전하게 제공했는가 | 후속 kernel 의존성 |
| queue id·enqueue 순번·wait-list | CL 수준 연결선이 있는가 | 구체 Vulkan lowering의 정당성 |
| 실제 memory 경로·barrier·submit 기록 | backend가 계약을 어떻게 구현했는가 | 측정하지 않은 다른 경로 |

이번 글에는 대상 Android 기기의 ANGLE build, 생성 SPIR-V, Vulkan capture, AMDGPU submit/PM4 dump가 없다. 따라서 특정 cache flush, semaphore, PM4 opcode가 발생했다고 주장하지 않는다. **OpenCL 계약을 증명하는 것과 그 기기의 구현이 계약을 지켰는지 검증하는 것은 다른 작업**이다.

## 수정된 모델

- **처음의 모델:** 비동기 write는 반환 시 미완료일 수 있으므로, 이미 바인딩된 buffer를 읽는 다음 kernel도 옛값을 읽을 수 있다.
- **충돌한 사실:** 같은 in-order queue에는 선행 command 완료와 후속 command 사이의 암묵적 메모리 동기화가 있다. buffer 인자 설정은 내용 전체의 snapshot이 아니다.
- **수정된 모델:** host 반환은 host source 재사용의 기준이 아니다. kernel은 buffer binding과 queue 의존성을 따라, 선행 write가 갱신한 내용을 읽는다. host source는 write 완료까지 보존한다.

택배 비유가 설명하지 못하는 것은 마지막 부분이다. 실제 runtime은 배송과 설치를 서로 다른 엔진·host 작업·memory 경로로 나눌 수 있고, 명령의 물리적 실행을 겹칠 수도 있다. 중요한 것은 트럭 수가 아니라 **관측 가능한 데이터와 의존성 계약이 유지되는가**다.

---

## 관련 글

- [clFlush 뒤에도 read 목적지를 읽으면 안 되는 이유: 제출과 완료의 경계]({{< relref "2026-10-19-wrong-note-nonblocking-read-flush-completion.md" >}})
- [ANGLE descriptor row 추적: schema는 맞는데 value가 틀릴 때]({{< relref "2026-06-08-opencl-note-angle-descriptor-row-live-value.md" >}})
- [clFinish의 완료 대기 — OpenCL 보장과 Vulkan·AMDGPU 구현 예]({{< relref "2026-04-13-clfinish-internals.md" >}})

## 관련 용어

[[command-queue]], [[event]], [[descriptor-set]], [[barrier]], [[clspv]], [[SPIR-V]]
