---
title: "OpenCL/Vulkan/PM4 Daily Facts (누적 위키)"
date: 2026-04-11
slug: "opencl-daily-facts"
draft: false
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

---

## 운영 규칙 (누적 방식)
- 날짜별 분리 대신, 주제별로 문장을 계속 정제해서 누적한다.
- 같은 의미의 문장이 들어오면 최신/더 정확한 문장으로 통합한다.
- 필요할 때만 "새로 추가된 사실" 섹션을 잠깐 만들고, 안정화되면 Core Facts에 합친다.
