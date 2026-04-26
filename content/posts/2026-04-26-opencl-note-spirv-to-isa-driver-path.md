---
title: "SPIR-V에서 ISA까지: 드라이버 백엔드가 실제로 하는 일"
date: 2026-04-26
slug: "spirv-to-isa-driver-path"
draft: false
type: "note"
series: "opencl-deep-dive"
tags: ["opencl", "vulkan", "spirv", "driver", "isa", "compiler"]
difficulty: "intermediate"
---

OpenCL C를 clspv로 SPIR-V까지 내리면 "컴파일이 끝났다"고 느끼기 쉽다.
하지만 실제 GPU에서 실행 가능한 코드는 그 다음 단계, 즉 **드라이버 백엔드의 하강(lowering)**에서 만들어진다.

이번 노트는 `SPIR-V → (드라이버 IR) → ISA` 경로를 한 번에 정리한다.

---

## 1) SPIR-V는 실행 파일이 아니라 계약된 중간 표현(IR)

SPIR-V는 Vulkan이 받아들일 수 있는 표준 IR이지만, GPU가 바로 fetch/decode할 기계어는 아니다.

핵심 포인트:

- SPIR-V는 벤더 중립 표현이다.
- 실제 실행 코드는 벤더 드라이버가 타깃 아키텍처에 맞게 다시 만든다.
- 그래서 **같은 SPIR-V라도 드라이버/세대가 달라지면 성능과 코드 형태가 달라질 수 있다.**

---

## 2) 드라이버 백엔드의 큰 파이프라인

개념적으로는 아래 4단계를 거친다.

1. **SPIR-V 로드 & 검증**
   - capability, type, decoration, memory model을 점검
2. **드라이버 내부 IR로 변환**
   - SSA 기반 내부 표현으로 옮긴 뒤 최적화 준비
3. **중간 최적화 + 타깃 특화 최적화**
   - dead code 제거, 상수 전파, 스케줄링, 레지스터 압박 완화
4. **ISA 생성 + 메타데이터 패키징**
   - 커널 바이너리, 리소스 사용량(VGPR/SGPR, LDS), 진입 정보 정리

이 결과물이 파이프라인/셰이더 객체에 들어가고, submit 시점에 PM4 스트림으로 호출된다.

---

## 3) 왜 이 단계가 성능을 크게 좌우하나

같은 알고리즘이라도 백엔드 결정이 달라지면 다음이 바뀐다.

- **레지스터 사용량(VGPR/SGPR)** → occupancy 변화
- **메모리 명령 배치** → coalescing 체감 차이
- **분기/루프 처리 방식** → wavefront 유휴 lane 비율 변화
- **LDS 사용 패턴** → bank conflict 가능성 변화

즉, 고수준 코드가 같아도 "어떤 ISA가 나왔는지"가 실제 프레임타임/커널시간을 결정한다.

---

## 4) OpenCL 관점에서의 연결

OpenCL 앱에서 보면 보통 다음처럼 이어진다.

- host: 커널 준비/인자 바인딩/enqueue
- frontend: OpenCL C → SPIR-V(clspv 등)
- backend(driver): SPIR-V → ISA
- runtime submit: command buffer/queue submit
- GPU: PM4로 인코딩된 dispatch 실행

따라서 성능 문제를 볼 때는 "OpenCL 소스"만 보지 말고,
**SPIR-V 품질 + 백엔드 생성 결과 + submit 패턴**을 함께 봐야 원인을 좁힐 수 있다.

---

## 한 줄 정리

SPIR-V는 종착점이 아니라 중간 계약이고, 성능의 마지막 승부는 드라이버 백엔드가 만든 ISA에서 난다.

---

## 관련 글

- [OpenCL C → SPIR-V → Vulkan: arg 바인딩 구조 이해](/opencl-spirv-vulkan-mapping/)
- [같은 SPIR-V인데 왜 드라이버마다 성능이 다를까?](/same-spirv-different-driver/)
- [OpenCL dispatch가 PM4 스케일까지 내려가는 흐름](/tiny-dispatch-pm4-scale/)

## 관련 용어

- [[SPIR-V]], [[wavefront]], [[pm4-packet]], [[command-buffer]]
