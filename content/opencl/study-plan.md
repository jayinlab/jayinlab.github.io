---
title: "OpenCL 학습 계획 / TODO"
slug: "opencl-study-plan"
---

아래는 현재 학습 계획입니다. 대화가 진행될수록 TODO를 갱신합니다.

## 고정 목표
- ANGLE의 OpenCL 엔트리포인트부터 Vulkan 실행까지 코드/개념 흐름 이해
- OpenCL C → clspv → SPIR-V → Vulkan compute 경로의 책임 경계 명확화
- AMD 우선으로, 가능한 범위에서 PM4 수준 mental model까지 도달

## 학습 단계
- [x] S0. 목표/범위 확정
- [x] S1. 현재 이해 수준 진단
- [x] S2. OpenCL 객체/라이프사이클과 컴파일/디스패치 시점 구분
- [x] S3. clBuildProgram/clCreateProgramWithSource/Binary 역할 정리
- [x] S4. clspv 산출물(SPIR-V) 구조 읽기 기본
- [x] S4-1. clspv 최소 실습(OpenCL C 1개 -> SPIR-V 대응표 작성)
- [x] S5. Vulkan compute pipeline + descriptor set + dispatch 기초
- [x] S5-1. Vulkan 용어 직관 보강(Descriptor Set/Layout, Pipeline Layout)
- [x] S5-2. 용어 명명 배경(역사/설계 관점) 정리
- [ ] S6. ANGLE(OpenCL path) 호출 체인 추적 1차
- [ ] S7. ANGLE↔Vulkan 바인딩 디테일 추적 2차
- [ ] S8. AMD PM4 개요(Type3, dispatch 관련 packet family)
- [ ] S9. 종합 다이어그램/체크리스트 완성

## 운영 원칙
- 매 세션 시작 시 목표 재확인
- 새 노트 작성 후 TODO 상태 갱신
- 이해 확인 질문 + 복습 카드(Anki 스타일)를 각 노트 끝에 포함
