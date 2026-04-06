---
title: "OpenCL Quiz Problem Bank #01 — ANGLE→clspv→SPIR-V→Vulkan→PM4"
date: 2026-04-06
slug: "opencl-quiz-problem-bank-01"
draft: false
---

매일 퀴즈에서 막힌 문제를 다시 꺼내보는 문제 창고 문서.
정답은 펼치기 버튼(`<details>`)으로 숨겨 두었다.

---

## Q1) DescriptorSet/Binding 매핑
셰이더의 `DescriptorSet + Binding`은 호스트 측에서 어떤 객체 관계로 고정되는가?

<details>
  <summary>정답 보기</summary>

`DescriptorSet + Binding`은 **Descriptor Set Layout의 binding 정의**(descriptor type, count, stage flags)와 매핑된다.
이 여러 set layout의 묶음이 Pipeline Layout의 계약(contract) 일부가 된다.

</details>

## Q2) PM4 계층 위치
PM4는 스택에서 어디에 가장 가깝나?

<details>
  <summary>정답 보기</summary>

한 줄 요약: **closest to driver backend/GPU command processor, far from OpenCL API/high-level runtime**.

</details>

## Q3) Pipeline vs Descriptor Set
“what vs with-what”로 역할을 구분하라.

<details>
  <summary>정답 보기</summary>

- **Pipeline**: 무엇을 실행할지(셰이더/고정 상태 포함 실행 정의)
- **Descriptor Set**: 어떤 리소스로 실행할지(버퍼/이미지/샘플러 바인딩값)

분리 이유: 실행 정의와 실행 데이터 바인딩을 독립적으로 재사용/교체하기 위해서.

</details>

## Q4) Pipeline Layout 정의
Pipeline Layout이 무엇이며 왜 호환성의 핵심인가?

<details>
  <summary>정답 보기</summary>

Pipeline Layout = **set layout 배열 + push constant range**의 계약.
파이프라인이 기대하는 리소스 슬롯 규격과, 실제 바인딩되는 descriptor set 규격이 이 계약에서 맞아야 호환된다.

</details>

## Q5) Compile chain vs Submit chain 분리 이유
실무상 왜 분리해서 생각해야 하나?

<details>
  <summary>정답 보기</summary>

예시 이점:
1. **디버깅 분리**: 컴파일/링크 문제와 런타임 바인딩·제출 문제를 분리 진단 가능
2. **성능 분석 분리**: 초기 컴파일/JIT 비용 vs 반복 제출 오버헤드(커맨드 기록·제출) 구분 가능

</details>

## Q6) clSetKernelArg는 어느 체인?
compile vs submit 중 어디에 속하나?

<details>
  <summary>정답 보기</summary>

주로 **submit chain 측 상태 준비**에 가깝다.
프로그램 빌드 산출물을 바꾸는 단계라기보다, 실행 시점의 인자/리소스 바인딩 상태를 채우는 성격이기 때문.

</details>

## Q7) Layout mismatch 실패 시점
대부분 컴파일 단계인가, 바인드/검증 단계인가?

<details>
  <summary>정답 보기</summary>

대부분 **바인드/검증(런타임) 단계**에서 터진다.
컴파일 시점에는 실제 런타임에 어떤 descriptor set이 바인딩될지 확정되지 않는 경우가 많기 때문이다.

</details>

## Q8) First dispatch latency 원인
첫 dispatch만 느린 대표 원인 3가지.

<details>
  <summary>정답 보기</summary>

대표적으로:
1. 파이프라인 생성/캐시 미스
2. 드라이버 백엔드 JIT/내부 컴파일
3. 첫 제출 시 초기화 비용(명령 버퍼/큐/메모리 관련 워밍업)

</details>

## Q9) 시나리오: shader edit 후 descriptor incompatibility
Kernel signature 변경 후 bind-time 실패까지 원인 체인을 3~4단계로 써라.

<details>
  <summary>정답 보기</summary>

가능한 체인 예:
1. OpenCL kernel 인자(타입/순서/개수) 변경
2. clspv가 생성한 SPIR-V의 set/binding 또는 리소스 인터페이스 변화
3. 기존 host-side descriptor set layout / pipeline layout을 재생성하지 않음(또는 일부만 갱신)
4. 바인딩/디스패치 시 layout incompatibility 검증에서 실패

</details>

## Q10) 시나리오: tiny dispatch 빈발, CPU submit 오버헤드 급증
Vulkan 기록/제출 레벨 최적화 2가지와 PM4/드라이버 오버헤드 감소 연결.

<details>
  <summary>정답 보기</summary>

예시:
1. **디스패치 배치/명령 버퍼 재사용(secondary/템플릿화 포함)**
   - 기록/드라이버 처리 호출 수를 줄여 CPU submit 비용 감소
2. **제출 횟수 줄이기(여러 dispatch를 한 submit로 묶기, 불필요한 sync 축소)**
   - 드라이버 백엔드의 명령 스트림 구성 빈도를 낮춰 PM4 패킷 생성/관리 부담 감소

</details>

---

## 오답만 모아 재퀴즈 (이번 세션 기준)
아래는 이번 답변에서 틀렸거나(또는 미응답) 한 문제들만 모은 재퀴즈다.
정답은 동일하게 버튼으로 확인.

- 대상: **Q1, Q2, Q4, Q5, Q6, Q7, Q8, Q9, Q10**

### RQ1) DescriptorSet/Binding 매핑을 정확한 객체 관계로 다시 써보기
<details>
  <summary>정답 보기</summary>

`DescriptorSet + Binding` -> Descriptor Set Layout의 binding 정의.
그리고 이 set layout 묶음이 Pipeline Layout 계약의 핵심이 된다.

</details>

### RQ2) PM4의 계층 위치를 “closest/far from” 한 줄로 쓰기
<details>
  <summary>정답 보기</summary>

closest to driver backend / GPU command processor,
far from OpenCL API/high-level runtime.

</details>

### RQ3) Pipeline Layout 정의(구성요소 2개 포함)
<details>
  <summary>정답 보기</summary>

Pipeline Layout = set layout 배열 + push constant ranges.
파이프라인/디스크립터 바인딩 호환성 검증의 계약점.

</details>

### RQ4) Compile chain vs Submit chain 분리 이유 2개
<details>
  <summary>정답 보기</summary>

(예)
1) 컴파일 문제와 런타임 바인딩/제출 문제를 분리 디버깅
2) 초기 JIT/컴파일 비용과 반복 제출 오버헤드를 분리 최적화

</details>

### RQ5) clSetKernelArg는 어느 체인인지 + 이유
<details>
  <summary>정답 보기</summary>

submit chain 쪽 상태 준비에 가깝다.
빌드 산출물 생성보다는 실행 인자/바인딩 상태 설정이기 때문.

</details>

### RQ6) Layout mismatch가 보통 컴파일 실패가 아닌 이유
<details>
  <summary>정답 보기</summary>

실제 바인딩되는 descriptor set 조합은 런타임에 결정되는 경우가 많아,
보통 bind/validation 단계에서 incompatibility가 드러난다.

</details>

### RQ7) First dispatch latency 원인 3개
<details>
  <summary>정답 보기</summary>

pipeline 생성/캐시 미스, backend JIT, 첫 제출 초기화 비용.

</details>

### RQ8) 시나리오: kernel signature 변경 -> bind 실패 체인 3~4단계
<details>
  <summary>정답 보기</summary>

인자 인터페이스 변경 -> SPIR-V resource interface 변화 -> host layout 미갱신 -> bind/dispatch 검증 실패.

</details>

### RQ9) tiny dispatch 빈발 시 submit 최적화 2개
<details>
  <summary>정답 보기</summary>

(예)
- dispatch 배치/명령 버퍼 재사용
- submit 횟수 축소 + 불필요 sync 감소
=> driver backend 처리/PM4 패킷 관리 오버헤드 완화.

</details>

---

## 빠른 복습용 암기 문장
- Pipeline = what to execute
- Descriptor Set = with what resources
- Pipeline Layout = contract(set layouts + push constants)
- PM4 = driver backend 아래, HW 쪽에 가까운 명령 패킷 레벨
