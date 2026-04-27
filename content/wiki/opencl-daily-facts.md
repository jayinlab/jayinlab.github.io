---
title: "OpenCL/Vulkan/PM4 Daily Facts (누적 위키)"
date: 2026-04-11
slug: "opencl-daily-facts"
draft: false
difficulty: "intermediate"
---

매일 13:00 KST 팩트 브리프를 날짜 분리 없이 누적 저장하는 위키 문서.
- 원칙: 짧고 핀포인트 문장 유지
- 중복 최소화, 같은 주제는 더 정확한 문장으로 갱신

---

## Core Facts (현재 누적)

- OpenCL의 **work-item**은 GPU에서 실행되는 가장 작은 논리 스레드다.
- OpenCL의 **work-group**은 local memory와 barrier를 공유하는 실행 묶음이다.

- OpenCL의 `barrier(CLK_LOCAL_MEM_FENCE)`는 같은 work-group 내부에서만 유효하다.
- 서로 다른 work-group 사이 순서는 커널 경계나 이벤트로만 보장된다.

- OpenCL의 `__local` 메모리는 work-group 단위 공유 SRAM 성격이다.
- `__global` 메모리는 전체 디바이스가 접근하는 큰 메모리 공간이다.

- Vulkan compute 실행의 기본 조합은 `vkCmdBindPipeline` + `vkCmdBindDescriptorSets` + `vkCmdDispatch`다.
- 이는 OpenCL의 커널 인자 설정 + enqueue 패턴과 대응된다.

- Vulkan descriptor set은 셰이더가 읽는 리소스 바인딩 테이블이다.
- OpenCL 커널 인자의 실제 버퍼 연결 지점 역할을 한다.

- clspv는 OpenCL C를 SPIR-V로 낮출 때 주소공간/포인터 규칙을 Vulkan 제약에 맞춰 정규화한다.
- 즉 OpenCL 문법을 Vulkan이 처리 가능한 IR 형태로 번역한다.

- SPIR-V는 소스코드가 아니라 IR이다.
- 같은 SPIR-V라도 벤더 드라이버에 따라 최종 기계코드는 달라질 수 있다.

- AMD의 wavefront(보통 64 lanes)는 같은 명령을 동시 실행한다.
- 분기(divergence)가 크면 일부 lane이 유휴 상태가 되어 효율이 떨어진다.

- 드라이버 백엔드는 고수준 dispatch를 커맨드 스트림으로 직렬화해 GPU 큐에 넣는다.
- 이 단계에서 동기화/상태 설정/dispatch 패킷이 하드웨어 형식으로 확정된다.

- AMD PM4에서 compute dispatch는 PACKET3 계열 명령으로 인코딩되어 큐에 기록된다.
- 핵심은 “상태 설정 패킷 + dispatch 패킷”의 순서가 실제 커널 실행을 결정한다.


- OpenCL의 NDRange는 전역 인덱스 공간이고, work-group은 이 공간을 나눈 실행 단위다.
- `global_id`는 데이터 위치, `local_id`는 work-group 내부 위치를 뜻한다.

- OpenCL의 `__private` 메모리는 각 work-item 전용이다.
- 같은 알고리즘이라도 데이터 배치에 따라 메모리 대역폭 병목이 크게 달라진다.

- Vulkan pipeline barrier는 실행 순서 + 메모리 가시성을 함께 맞춘다.
- stage/access 마스크를 과하게 넓히면 동기화 비용이 커진다.

- clspv는 OpenCL 런타임 API 전체를 대체하는 도구가 아니다.
- 핵심 역할은 OpenCL C를 Vulkan compute 경로에서 쓸 SPIR-V로 변환하는 것이다.

- command buffer는 "무엇을 실행할지"를 기록한 목록이고, queue submit은 그 목록을 실행 스케줄에 올리는 단계다.
- tiny dispatch 워크로드에서는 기록 재사용과 제출 전략이 CPU 오버헤드를 크게 좌우한다.

- `clFinish(queue)`는 "디바이스 전체 idle" 보장이 아니라, **해당 command queue에 enqueue된 작업 완료**를 기다리는 동기화다.
- 여러 queue를 쓰는 경우 완료 판단은 queue 단위로 분리해 보는 습관이 필요하다.

---

## 운영 규칙 (누적 방식)
- 날짜별 분리 대신, 주제별로 문장을 계속 정제해서 누적한다.
- 같은 의미의 문장이 들어오면 최신/더 정확한 문장으로 통합한다.
- 필요할 때만 "새로 추가된 사실" 섹션을 잠깐 만들고, 안정화되면 Core Facts에 합친다.
