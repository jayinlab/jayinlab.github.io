---
title: "first-run 지연 줄이기 — pipeline cache, warm-up, 측정 체크리스트"
date: 2026-04-13
slug: "opencl-note-first-run-latency"
draft: false
type: "note"
series: "opencl-deep-dive"
tags: ["opencl", "vulkan", "angle", "performance"]
difficulty: "intermediate"
layer: "UMD"
---

"SPIR-V가 있는데 왜 첫 실행이 느리지?" — 이 현상은 여러 단계가 합쳐진 결과다.  
이 노트는 지연 원인을 분해하고, ANGLE + clspv + Vulkan 프레임에서 실제로 쓸 수 있는 완화 전략을 정리한다.

---

## 지연이 생기는 위치

```
T0 ──── T1 ──────── T2 ────────── T3 ─────── T4 ─────── T5
앱 시작  program     build 완료    pipeline   첫 enqueue  완료
        create 완료              준비 완료   호출
          ↑            ↑              ↑          ↑
     소스 등록      clspv+SPIR-V   Vulkan JIT   submit
```

| 구간 | 주요 비용 |
|------|---------|
| T1→T2 | clspv 컴파일 + SPIR-V 생성 |
| T2→T3 | Vulkan shader module + pipeline 생성, backend JIT |
| T3→T4 | descriptor/layout 검증, 초기 상태 준비 |
| T4→T5 | 첫 dispatch + 드라이버 JIT (cold ISA) |

즉, "컴파일 1개"가 아니라 **여러 단계 누적 비용**이다.

---

## 완화 전략 (우선순위)

### A. Program binary/IL 캐시

가능한 경우 `clCreateProgramWithBinary` 또는 `clCreateProgramWithIL` 경로 활용.  
앱 재시작 시 source 재컴파일(T1→T2) 부담 제거.

### B. Vulkan pipeline cache 영속화

파이프라인 캐시를 파일로 저장/복원.  
동일 드라이버/환경에서 T2→T3 비용 완화.

```c
// 이전 실행에서 저장한 cache data 로드
VkPipelineCacheCreateInfo cacheInfo = {
    .initialDataSize = savedSize,
    .pInitialData = savedData,
};
vkCreatePipelineCache(device, &cacheInfo, NULL, &pipelineCache);
```

### C. Warm-up dispatch

앱 초기화 시 작은 workload로 핵심 커널을 미리 한 번 실행.  
실제 사용 시 체감 지연 감소.

```
앱 시작
  → 백그라운드에서 warm-up dispatch 실행 (사용자 눈에 안 보이는 시간)
  → 사용자가 실제로 쓸 때는 pipeline이 이미 준비됨
```

### D. 조합 폭 줄이기

specialization 상수/매크로 옵션 조합을 최소화하면  
생성해야 할 파이프라인 수가 줄어든다.

### E. 백그라운드 준비

UI/초기 응답과 무거운 build 준비를 분리해서  
사용자 체감 성능을 개선한다.

---

## 측정 템플릿

```
T0: 앱 시작
T1: clCreateProgramWithSource/Binary 완료
T2: clBuildProgram 완료
T3: pipeline 준비 완료 (첫 enqueue 직전)
T4: clEnqueueNDRangeKernel 호출
T5: clFinish 반환

Build 비용        = T2 - T1
Pipeline 준비 비용 = T3 - T2
첫 dispatch 비용  = T5 - T4
총 cold-start     = T5 - T0
```

T2~T3 비용이 크면 pipeline cache 우선.  
T4~T5 비용이 크면 warm-up 또는 JIT 캐시 확인.

---

## "ISA를 직접 주면 더 빠르지 않나?"

아이디어는 타당하지만 범용 프레임에서 제약이 크다.

- ISA는 GPU 아키텍처/드라이버 버전에 강하게 종속
- 호환성/검증/유지보수 비용이 큼
- 구현체 전용 binary 포맷은 이식성 낮음

현실적 분업:
- 앱/미들웨어 → SPIR-V + pipeline cache까지
- 최종 ISA/JIT → 드라이버 담당

---

## 이해 확인 질문

### Q1. first-run 지연을 "컴파일 비용" 하나로 보면 왜 위험한가?

<details>
<summary>정답 보기</summary>

실제로는 build, pipeline 생성, backend JIT, 초기 submit 비용이 누적된다.  
원인 분리가 안 되면 pipeline cache를 넣어야 할 자리에 source 캐시를 넣는 식의  
잘못된 최적화를 하게 된다.

</details>

### Q2. pipeline cache와 warm-up을 같이 쓰면 어떤 이점이 있나?

<details>
<summary>정답 보기</summary>

- **pipeline cache**: 재시작 시 pipeline 생성 비용(T2→T3)을 줄임
- **warm-up**: 첫 번째 실제 사용 전에 지연을 사용자 체감 경로 밖으로 이동

둘을 함께 쓰면 cold-start 총비용과 체감 지연 모두 줄어든다.

</details>

### Q3. ISA를 앱이 직접 들고 다니는 전략의 큰 단점 2개는?

<details>
<summary>정답 보기</summary>

1. 하드웨어/드라이버 버전 종속성 — GPU가 바뀌거나 드라이버가 업데이트되면 쓸 수 없다
2. 유지보수 부담 — 지원 대상 GPU마다 별도 binary를 관리해야 한다

</details>

### Q4. 최적화 전에 반드시 해야 할 선행 작업은?

<details>
<summary>정답 보기</summary>

**측정을 먼저 한다.**  
T0~T5 타임스탬프로 compile chain vs submit chain 비용을 구간별로 분리 계측해야  
어느 구간이 병목인지 알고 정확한 전략을 선택할 수 있다.

</details>

### Q5. build 비용 vs pipeline 준비 비용 중 어느 것이 더 크면 어떤 전략을 선택할까?

<details>
<summary>정답 보기</summary>

- **build 비용(T1→T2)이 크다** → program binary 캐시 / clCreateProgramWithBinary 경로
- **pipeline 준비 비용(T2→T3)이 크다** → Vulkan pipeline cache 영속화 + warm-up

</details>

---

## 관련 글

- [Build/캐시 경계](/opencl-note-build-cache/) — 각 단계별 비용 발생 원인
- [clFinish 내부](/clfinish-internals/) — T5 시점의 내부 동작
- [ANGLE 추적 2차](/opencl-note-angle-phase2/) — pipeline 생성 지점 추적

## 관련 용어

[[ANGLE]], [[SPIR-V]], [[clspv]], [[pipeline-layout]], [[command-queue]]
