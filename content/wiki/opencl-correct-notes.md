---
title: "OpenCL 정답노트 (누적 위키)"
date: 2026-04-09
slug: "opencl-correct-notes"
draft: false
difficulty: "intermediate"
---

> 목적: 지금까지 퀴즈에서 맞춘 개념을 **위키처럼 누적/갱신**하는 기준 문서

## A. Pipeline vs Descriptor Set (C003)
- **Pipeline**: what runs (어떤 셰이더/실행 상태로 실행할지)
- **Descriptor Set**: with what resources (어떤 버퍼/이미지/샘플러로 실행할지)
- 분리 이유: 실행 정의와 리소스 바인딩을 독립적으로 재사용/교체하기 위해.

## B. PM4 계층 감각 (C002)
- PM4는 OpenCL API 레벨이 아니라 드라이버 백엔드 커맨드 스트림/하드웨어 근처 계층.
- 개념 순서(직관):
  `OpenCL API -> Vulkan recording -> backend command stream -> PM4 -> GPU`

## C. compile chain vs submit chain 분리 (C005)
- compile chain: 소스/IR/코드생성 경로
- submit chain: 기록/바인딩/제출/동기화 경로
- 분리 효용:
  - 실패 원인 분리(빌드 문제 vs 런타임 바인딩 문제)
  - 성능 원인 분리(초기 컴파일/JIT vs 반복 제출 오버헤드)

## D. tiny dispatch 최적화 방향 (C010, 부분정답 기반 정리)
- command buffer recording 재사용
- submit 배치화로 제출 횟수/동기화 감소
- descriptor/pipeline churn 감소

## E. kernel-signature drift failure chain 감각 (C009, 부분정답 기반 정리)
1. kernel 인터페이스 변경
2. SPIR-V 리소스 인터페이스 변화
3. host layout/write 가정 불일치
4. bind/dispatch 단계 incompatibility 실패

---

## Wiki 사용 규칙
- 이 문서는 "맞춘 개념" 중심의 **정답 기준서**다.
- 새 퀴즈에서 정답으로 고정된 개념만 추가/보정한다.
- 틀린 내용은 포스트형 오답노트로 분리하고, 여기엔 교정된 최종본만 남긴다.
