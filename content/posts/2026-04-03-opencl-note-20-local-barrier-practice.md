---
title: "OpenCL Note #20 — D2 실습: local memory / barrier 커널에서 SPIR-V 읽기"
date: 2026-04-03
slug: "opencl-note-20-local-barrier-practice"
draft: false
---

이번 노트는 심화 D2의 실습 노트다.

목표:
1) `__local` 메모리가 SPIR-V에서 어떻게 보이는지
2) `barrier(...)`가 어떤 명령 패턴으로 보이는지

## 실습 스크립트

```bash
bash ~/opencl_study/scripts/04_run_local_barrier.sh
```

## 실습 파일

- `~/opencl_study/src/local_sum.cl`
- `~/opencl_study/src/barrier_copy.cl`

출력:
- `~/opencl_study/build/local_sum.spvasm`
- `~/opencl_study/build/barrier_copy.spvasm`
- 로그: `~/opencl_study/logs/*-local-barrier.log`

## 무엇을 보면 좋은가

1. `Workgroup` / `Local` 관련 변수 선언
2. `OpControlBarrier` 또는 유사 barrier 관련 opcode
3. local 메모리 접근 전후의 load/store 패턴

## 읽기 체크리스트

- `__local` 인자가 어떤 storage class/변수로 내려갔는지 찾았는가?
- `barrier` 호출 지점을 SPIR-V에서 식별했는가?
- barrier 앞/뒤로 데이터 접근 순서가 바뀌는지 확인했는가?

## 이해 확인 질문

### Q1. `__local`은 왜 일반 global buffer와 다르게 다뤄질까?
<details>
  <summary>정답 보기</summary>
  workgroup 내 공유 메모리 성격이라 scope/동기화 규칙이 다르기 때문이다.
</details>

### Q2. barrier를 SPIR-V에서 찾는 이유는?
<details>
  <summary>정답 보기</summary>
  동기화 지점이 실제로 어디에 생성되는지 확인해야 데이터 경합/순서 문제를 이해할 수 있다.
</details>
