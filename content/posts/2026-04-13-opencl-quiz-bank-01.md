---
title: "퀴즈 문제 창고 #01 — 10개 핵심 개념 문제 + 펼치기 정답"
date: 2026-04-13
slug: "opencl-quiz-bank-01"
draft: false
type: "bullet-note"
series: "opencl-deep-dive"
tags: ["opencl", "vulkan", "pm4", "quiz"]
difficulty: "intermediate"
layer: "CL"
---

막힌 문제를 꺼내보는 문제 창고.  
정답은 펼치기 버튼으로 숨겨두었다. 정답을 보기 전에 직접 답해보자.

---

## Q1. DescriptorSet/Binding 매핑

SPIR-V의 `DescriptorSet + Binding` 데코레이션은 호스트 측에서 어떤 객체 관계로 고정되는가?

<details>
<summary>정답 보기</summary>

`DescriptorSet + Binding`은 **Descriptor Set Layout의 binding 정의**  
(descriptor type, count, stage flags)와 매핑된다.

여러 set layout의 묶음이 Pipeline Layout의 계약 일부가 된다.

`SPIR-V Binding N → VkDescriptorSetLayoutBinding.binding = N`

</details>

---

## Q2. PM4 계층 위치

PM4는 소프트웨어 스택에서 어디에 가장 가까운가?

<details>
<summary>정답 보기</summary>

**Driver backend / GPU Command Processor에 가장 가깝다.**  
OpenCL API / 고수준 런타임과는 멀다.

`OpenCL API → Vulkan recording → driver backend → PM4 → GPU`

</details>

---

## Q3. Pipeline vs Descriptor Set

"what to execute" vs "with what resources"로 역할을 구분하라.

<details>
<summary>정답 보기</summary>

- **Pipeline**: 무엇을 실행할지 (셰이더/고정 상태 포함 실행 정의)
- **Descriptor Set**: 어떤 리소스로 실행할지 (버퍼/이미지 핸들)

분리 이유: 실행 정의와 실행 데이터를 독립적으로 재사용/교체하기 위해서.

</details>

---

## Q4. Pipeline Layout 정의

Pipeline Layout이 무엇이며 왜 호환성의 핵심인가?

<details>
<summary>정답 보기</summary>

Pipeline Layout = **set layout 배열 + push constant range의 계약**.

파이프라인이 기대하는 리소스 슬롯 규격과,  
실제 바인딩되는 descriptor set 규격이 이 계약에서 맞아야 호환된다.

</details>

---

## Q5. Compile chain vs Submit chain 분리 이유

실무상 왜 분리해서 생각해야 하나?

<details>
<summary>정답 보기</summary>

1. **디버깅 분리**: 컴파일/링크 문제와 런타임 바인딩·제출 문제를 분리 진단 가능
2. **성능 분석 분리**: 초기 컴파일/JIT 비용 vs 반복 제출 오버헤드 구분 가능

</details>

---

## Q6. clSetKernelArg는 어느 체인?

compile chain vs submit chain 중 어디에 속하나?

<details>
<summary>정답 보기</summary>

주로 **submit chain 측 상태 준비**에 가깝다.  
프로그램 빌드 산출물을 바꾸는 단계라기보다,  
실행 시점의 인자/리소스 바인딩 상태를 채우는 성격이기 때문.

</details>

---

## Q7. Layout mismatch 실패 시점

대부분 컴파일 단계인가, 바인드/검증 단계인가?

<details>
<summary>정답 보기</summary>

대부분 **바인드/검증(런타임) 단계**에서 터진다.  
컴파일 시점에는 실제 런타임에 어떤 descriptor set이 바인딩될지 확정되지 않기 때문이다.

</details>

---

## Q8. First dispatch latency 원인 3가지

첫 dispatch만 느린 대표 원인 3가지.

<details>
<summary>정답 보기</summary>

1. 파이프라인 생성/캐시 미스
2. 드라이버 백엔드 JIT/내부 컴파일
3. 첫 제출 시 초기화 비용 (command buffer/queue/메모리 관련 워밍업)

</details>

---

## Q9. Kernel signature 변경 후 실패 체인

Kernel arg 변경 후 bind-time 실패까지 원인 체인을 3~4단계로 써라.

<details>
<summary>정답 보기</summary>

1. OpenCL kernel 인자 (타입/순서/개수) 변경
2. clspv 산출 SPIR-V의 set/binding 인터페이스 변화
3. 기존 host-side descriptor set layout / pipeline layout 미갱신
4. 바인딩/dispatch 시 layout incompatibility 검증 실패

</details>

---

## Q10. tiny dispatch 빈발, CPU submit 오버헤드 급증 시 최적화

Vulkan 기록/제출 레벨 최적화 2가지와 PM4/드라이버 오버헤드 감소 연결.

<details>
<summary>정답 보기</summary>

1. **dispatch 배치 / command buffer 재사용**  
   recording 호출 수를 줄여 CPU submit 비용 감소

2. **submit 횟수 줄이기** (여러 dispatch를 한 submit으로 묶기, 불필요한 sync 제거)  
   드라이버 백엔드의 명령 스트림 구성 빈도를 낮춰 PM4 패킷 생성/관리 부담 감소

</details>

---

## 빠른 복습 암기 문장

```
Pipeline    = what to execute
Descriptor Set = with what resources
Pipeline Layout = contract (set layouts + push constants)
PM4 = driver backend 아래, HW에 가까운 명령 패킷 레벨
clSetKernelArg = submit chain (바인딩 상태 준비)
first-dispatch slow = pipeline cache miss + JIT + first submit init
```

---

## 관련 글

- [오답노트 #01](/opencl-wrong-note-barrier-scope/) — Q1, Q2 오답 정정 상세
- [오답노트 #02](/opencl-wrong-note-partial/) — Q3~Q10 오답 정정 상세
- [종합 다이어그램](/opencl-note-final-map/) — 체크리스트 확인

## 관련 용어

[[descriptor-set]], [[pipeline-layout]], [[pm4-packet]], [[ANGLE]], [[SPIR-V]]
