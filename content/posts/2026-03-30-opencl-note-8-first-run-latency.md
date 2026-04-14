---
title: "OpenCL Note #11 — ANGLE+clspv+Vulkan first-run 지연 줄이기 실전 체크리스트"
date: 2026-03-30
slug: "opencl-note-8-first-run-latency"
draft: false
type: "note"
series: "opencl-deep-dive"
tags: ["opencl", "vulkan", "angle", "performance"]
difficulty: "intermediate"
layer: "KMD"
---

이번 노트 목표:
- "SPIR-V가 있어도 왜 첫 실행이 느릴 수 있는지"를 분해하고,
- ANGLE + clspv + Vulkan 프레임에서 실제로 쓸 수 있는 완화 전략을 정리한다.

(고정 목표: ANGLE OpenCL entry → clspv/SPIR-V → Vulkan dispatch → AMD PM4 mental model)

---

## 1) first-run 지연이 생기는 위치

첫 실행 지연은 보통 아래가 합쳐진 결과다.

1. Source → SPIR-V 준비(clspv 관여)
2. SPIR-V → Vulkan shader module/pipeline 준비
3. 드라이버 backend compile/JIT(ISA 준비)
4. descriptor/pipeline layout 검증 및 초기 상태 준비
5. 첫 dispatch 시 런타임 초기화 비용

즉, "컴파일 1개" 문제가 아니라 **여러 단계 누적 비용**이다.

---

## 2) 실전 최적화 전략 (우선순위)

### A. Program binary/IL 캐시 (효과 큼)
- 가능한 경우 `clCreateProgramWithBinary` 또는 `clCreateProgramWithIL` 경로 활용
- 앱 재시작 시 source 재컴파일 부담 감소

### B. Vulkan pipeline cache 영속화
- 파이프라인 캐시를 파일로 저장/복원
- 동일 드라이버/환경에서 첫 실행 파이프라인 비용 완화

### C. Warm-up dispatch
- 앱 초기화 시 작은 workload로 필요한 커널을 미리 한 번 실행
- 실제 사용 시 체감 지연 감소

### D. Variant(조합) 폭 줄이기
- specialization/매크로/옵션 조합 폭을 최소화
- 생성해야 할 파이프라인 수를 줄임

### E. 작업 분리(백그라운드 준비)
- UI/초기 응답과 무거운 빌드 준비를 분리
- 사용자 체감 성능 개선

---

## 3) "ISA를 직접 주면 더 빠르지 않나?"에 대한 정리

아이디어 자체는 타당하지만, 범용 프레임에서는 제약이 크다.

- ISA는 보통 GPU 아키텍처/드라이버 버전에 강하게 종속
- 호환성/검증/유지보수 비용이 큼
- 구현체 전용 binary 포맷은 이식성이 낮음

그래서 현실적으로는:
- 앱/미들웨어는 SPIR-V/캐시까지 최대한 준비
- 최종 ISA/JIT은 드라이버가 담당

이 분업이 현재 범용 생태계의 기본 모델이다.

---

## 4) 네 프로젝트용 권장 운영안 (초안)

1. 개발 단계
- source + clspv 경로 유지 (디버깅/가시성)

2. 배포 단계
- SPIR-V/Program 캐시 + Pipeline cache 저장
- 앱 시작 시 핵심 커널 warm-up

3. 측정
- 첫 실행/두 번째 실행 시간을 분리 측정
- build 구간 vs dispatch 구간 타임스탬프 로깅

---

## 5) 측정 템플릿 (복붙)

- T0: 앱 시작
- T1: program create 완료
- T2: build 완료
- T3: pipeline 준비 완료
- T4: 첫 enqueue 호출
- T5: 첫 dispatch/finish 완료

관찰값:
- Build 비용 = T2 - T1
- Pipeline 준비 비용 = T3 - T2
- 첫 실행 비용 = T5 - T4
- 총 cold-start = T5 - T0

---

## 이해 확인 질문 (토글형)

### Q1. first-run 지연을 "컴파일 비용" 하나로 보면 왜 위험한가?
<details>
  <summary>정답 보기</summary>
  실제로는 build, pipeline 생성, backend JIT, 초기 submit 비용이 누적되기 때문에 원인 분리가 안 되면 잘못된 최적화를 하게 된다.
</details>

### Q2. 왜 pipeline cache와 warm-up을 같이 쓰는 게 유리한가?
<details>
  <summary>정답 보기</summary>
  cache는 재사용 기반 비용을 줄이고, warm-up은 초기 한 번의 지연을 사용자 체감 이전으로 당겨 숨기는 효과가 있다.
</details>

### Q3. ISA를 앱이 직접 들고 다니는 전략의 큰 단점 2개는?
<details>
  <summary>정답 보기</summary>
  하드웨어/드라이버 종속성 증가, 호환성/검증/유지보수 부담 증가.
</details>

### Q4. 너의 현재 프레임에서 가장 먼저 도입할 2가지는?
<details>
  <summary>정답 보기</summary>
  (권장) 캐시 전략(program/pipeline) + 측정 로그(T0~T5) 분리.
</details>

### Q5. 최적화 전에 반드시 해야 할 선행 작업은?
<details>
  <summary>정답 보기</summary>
  compile 체인 vs submit 체인 타임라인 분리 계측.
</details>

## 복습 카드 (Anki 스타일)

- Q: first-run 지연의 대표 구성요소 3가지는?  
  A: build/변환, pipeline 준비, backend JIT/첫 submit.

- Q: pipeline cache의 역할은?  
  A: 동일 조건 재실행 시 파이프라인 준비 비용 완화.

- Q: warm-up dispatch의 목적은?  
  A: 초기 지연을 사용자 체감 경로 밖으로 이동.

- Q: 최적화의 첫걸음은?  
  A: 비용 구간 분리 계측(compile vs submit).
