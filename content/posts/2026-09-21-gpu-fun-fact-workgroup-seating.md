---
title: "GPU work-group은 왜 매번 같은 자리에 앉지 않을까"
date: 2026-09-21
slug: "gpu-fun-fact-workgroup-seating"
draft: false
type: "note"
series: "gpu-fun-fact"
tags: ["gpu", "work-group", "compute-unit", "scheduling", "amd"]
difficulty: "beginner"
---

식당 예약표에 7번 손님이라고 적혀 있어도 늘 7번 테이블에 앉는 것은 아니다. 직원은 그 순간 비어 있고 인원도 맞는 테이블을 고른다. GPU에서도 work-group 번호는 계산 영역의 좌표이지, 특정 Compute Unit(CU)의 좌석 번호가 아니다. 같은 kernel을 다시 실행해도 work-group이 다른 CU에 배치될 수 있다.

AMD GPU를 예로 들면 command processor가 kernel dispatch를 처리한 뒤, SPI(Shader Processor Input)가 ACE에서 work-group을 받아 사용 가능한 CU에 배치한다. 이때 빈 CU 하나만 찾는 것이 아니다. work-group이 들어가려면 실행 context인 wave slot과 함께 VGPR, SGPR, LDS라는 여러 자원이 충분해야 한다. 어느 하나라도 모자라면 다른 자리가 비어 보여도 기다릴 수 있다.

그래서 work-group-to-CU mapping은 고정된 round-robin 표가 아니라 그때의 자원 상태에 따른다. AMD 공식 문서도 mapping이 non-deterministic하며, 같은 kernel의 여러 launch에서 분포가 달라질 수 있다고 명시한다. 이 유연성 덕분에 GPU는 크기가 다른 chip에서도 가능한 자리를 채우며 많은 work-group을 처리할 수 있다. 반대로 kernel code가 “0번 work-group은 반드시 첫 CU에 간다”는 식으로 장치 내부 배치를 추측하면 깨진다.

식당 비유의 한계는 CU가 단순한 빈 의자가 아니라는 점이다. 한 CU에는 여러 work-group이 동시에 resident할 수 있고, 수용 여부는 사람 수 하나가 아니라 register와 LDS 사용량 등 여러 예산의 조합으로 결정된다. API가 보장하는 것은 work-group의 논리적 ID와 work-group 내부 동기화이지, 어느 CU에 언제 앉는지는 아니다.

출처: [AMD ROCm HIP documentation — Hardware implementation](https://rocm.docs.amd.com/projects/HIP/en/latest/understand/hardware_implementation.html)
