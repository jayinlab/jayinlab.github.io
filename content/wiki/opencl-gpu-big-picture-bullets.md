---
title: "OpenCL/GPU 큰 그림 정리 (Bullet Wiki)"
date: 2026-04-09
slug: "opencl-gpu-big-picture-bullets"
draft: false
---

이 문서는 대화에서 다룬 개념을 한 번에 연결해 보는 개인 위키 요약본이다.
설명은 "큰 그림 -> 실행 흐름 -> 병렬 모델 -> 성능/디버깅 포인트" 순서로 구성한다.

---

## 0) 한 줄 큰 그림
- GPU 실행은 대체로 다음 순서로 이해하면 된다:
  - **미리 규칙(인터페이스 계약)을 정한다**
  - **실행 직전 실제 리소스를 그 규칙 슬롯에 꽂는다**
  - **dispatch로 대량 work-item을 시작한다**

---

## 1) 물류 비유로 핵심 개념 대응
- **박스 하나** = 리소스 하나 (`VkBuffer`, `VkImageView` 등)
- **트럭** = Descriptor Set
- **트럭 번호** = set index
- **트럭 칸 번호** = binding index
- **칸 규격(무슨 박스 타입/몇 개 가능)** = descriptor type/count
- **규격서(오래 쓰는 문서)** = Descriptor Set Layout (DSL)
- **센터 전체 계약서** = Pipeline Layout (set layouts + push constants)
- **오늘 작업표(실행마다 바뀜)** = descriptor write/update 결과
- **작업 라인 선택** = pipeline bind
- **대량 처리 시작 버튼** = dispatch
- **맨 아래층 기계 제어 지시 흐름** = driver backend command stream / PM4 인접 레벨

---

## 2) 정적 계약 vs 동적 값
- **정적(보통 미리 고정)**
  - set index
  - binding index
  - descriptor type
  - descriptor count
  - stage visibility
  - push constant ranges
- **동적(실행마다 바뀔 수 있음)**
  - 실제 리소스 핸들(오늘 넣는 buffer/image)
  - offset/range(버퍼 일부 사용 범위)
  - 일부 push constant 값
- 기억 문장:
  - **슬롯 규칙은 정적, 슬롯 내용물은 동적**

---

## 3) 왜 pipeline 생성 성공 후 runtime 실패가 가능한가
- create 단계 성공:
  - 셰이더 + pipeline layout 자체가 논리적으로 일관됨
- runtime 실패:
  - 실제 bind한 descriptor set/리소스가 계약과 불일치
- 비유:
  - 설계도 승인 완료
  - 현장 조립 때 규격 다른 부품을 꽂아 실패

---

## 4) clSetKernelArg 위치 감각
- 실전 감각상 `clSetKernelArg`는
  - **코드 생성(compile chain)**보다는
  - **실행 전 상태 준비(submit 쪽 준비)**에 가깝게 보는 것이 유용
- 이유:
  - 빌드 산출물 자체를 바꾸기보다
  - 이번 실행에서 사용할 인자/리소스 상태를 채우는 성격

---

## 5) compile chain vs submit chain
- **compile chain**
  - OpenCL C 전처리/컴파일/IR 변환/코드 생성 경로
  - 산출물: 실행 가능한 코드/모듈/내부 바이너리
- **submit chain**
  - 커맨드 기록, 바인딩, dispatch, 동기화, 제출 경로
  - 산출물: 실제 실행 작업 흐름
- 분리 이점:
  - 실패 원인 분리(빌드 vs 바인딩/런타임)
  - 성능 원인 분리(초기 컴파일/JIT vs 반복 제출 오버헤드)

---

## 6) dispatch는 "트럭 수"가 아니라 "작업자 수"
- dispatch는 물류 비유에서 "작업자 호출"에 더 가깝다
- 예: global size = 1,000,000
  - 논리적으로 work-item 100만 개가 같은 커널 코드를 실행
- 중요:
  - **코드는 같고**
  - **각 work-item의 인덱스(id)가 달라 처리 데이터가 달라짐**

---

## 7) 모든 work-item이 같은 레이아웃을 보나?
- 같은 dispatch 내에서는 개념적으로
  - 같은 pipeline
  - 같은 pipeline layout/DSL 계약
  - 같은 descriptor set 바인딩 맥락
  아래에서 실행
- 단, 각 work-item은 자신의 id로 서로 다른 데이터 위치를 접근

---

## 8) 왜 고정 슬롯 규칙이 빠른가
- 런타임 추론(매번 타입/위치 확인) 비용을 줄인다
- 주소/인덱스 경로가 단순하고 예측 가능해진다
- 검증/호환성 체크를 create/bind 쪽으로 앞당길 수 있다
- 드라이버 하부 명령 구성(backend/PM4 인접)도 정형화되기 쉽다
- 결론:
  - 유연성 일부를 포기해 처리량/예측 가능성을 얻는 구조

---

## 9) OpenCL arg -> 슬롯 매핑 감각
- 커널 인자 시그니처는 리소스 인터페이스의 출발점
- clspv/SPIR-V 경로에서 set/binding 표현으로 나타남
- host 쪽 DSL/PL은 그 표현과 호환되어야 함
- 실행 시 descriptor write로 실제 리소스를 슬롯에 꽂음
- arg0 하나만 따라가도 전체 경로를 이해하기 좋음

---

## 10) first-dispatch가 느릴 수 있는 대표 원인
- pipeline 생성/캐시 미스
- driver backend JIT/내부 컴파일
- 첫 제출 경로의 초기화 오버헤드
- 완화 전략:
  - 파이프라인/캐시 워밍업
  - 불필요한 초기화 지연 제거
  - 제출 배치 최적화

---

## 11) tiny frequent dispatch에서 CPU 병목 완화
- command buffer recording 재사용
- submit 횟수 줄이기(배치화)
- 불필요한 동기화 축소
- descriptor/pipeline churn 감소
- 목표:
  - CPU 제출 오버헤드 감소
  - 하부 명령 스트림 구성 빈도 완화

---

## 12) 자주 헷갈리는 포인트 정리
- "set/binding이 실행 때 막 바뀌나?"
  - 보통 인터페이스 계약은 정적, 내용물만 동적
- "pipeline 성공이면 다 성공 아닌가?"
  - runtime bind 불일치로 실패 가능
- "모든 work-item이 똑같이 일하면 결과도 같지 않나?"
  - 코드만 같고, id가 달라 각자 다른 데이터 처리
- "PM4는 박스냐 트럭이냐?"
  - 둘 다 아님. 하부 실행 제어 지시 포맷에 가까움

---

## 13) 대화 외 추가 개념 (이해 확장용)
- **Command Buffer**
  - GPU에게 시킬 일을 미리 기록한 명령 리스트
  - 한 번 기록해 재사용하면 CPU 비용 절감
- **Queue**
  - 기록된 명령을 실제 제출하는 줄(작업 대기열)
- **Fence/Semaphore**
  - CPU-GPU, GPU-GPU 간 완료 순서를 맞추는 동기화 도구
- **Push Constants**
  - 작은 상수 데이터를 빠르게 전달하는 경량 경로
- **Descriptor Pool**
  - descriptor set을 할당하는 메모리 풀
- **Pipeline Cache**
  - 파이프라인 생성 비용을 줄이기 위한 캐시
- **Workgroup(Local size)**
  - work-item을 묶는 단위. 성능 튜닝에서 매우 중요
- **Occupancy (점유율)**
  - GPU 연산 자원이 얼마나 채워져 실행되는지의 감각 지표
- **Memory Coalescing**
  - 인접한 메모리 접근을 묶어 효율을 높이는 패턴
- **Barrier/Sync in kernel**
  - workgroup 내부 작업 순서를 맞춰 데이터 경쟁을 방지

---

## 14) 학습 루트 추천 (짧은 로드맵)
- 1단계: set/binding/DSL/PL 용어 고정
- 2단계: dispatch + work-item/workgroup 실행 모델 이해
- 3단계: command buffer/queue/sync로 submit path 이해
- 4단계: first-run latency와 tiny-dispatch 병목 튜닝
- 5단계: backend command stream/PM4 관점으로 아래층 감각 확장

---

## 15) 30초 복습 카드
- 규칙은 미리 고정, 실물은 실행 때 꽂기
- dispatch는 작업자 수를 호출하는 버튼
- 코드 동일 + id 다름 = 데이터 병렬
- pipeline create 성공 != runtime 성공 보장
- 성능은 "재사용, 배치화, 동기화 절제"가 기본
