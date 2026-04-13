---
title: "OpenCL Note #22 — Vulkan 관점 10줄 타임라인"
date: 2026-04-09
slug: "opencl-note-22-vulkan-10-line-timeline"
draft: false
type: "note"
series: "opencl-deep-dive"
tags: ["vulkan", "execution", "timeline"]
difficulty: "intermediate"
---

OpenCL → clspv/SPIR-V → Vulkan 실행 흐름을 "생성(계약)"과 "실행(실물 바인딩)"으로 나눠 10줄로 요약한다.

## 10줄 타임라인
1. OpenCL kernel 시그니처(인자 타입/순서/개수)가 정의된다.
2. clspv/SPIR-V 단계에서 인자 인터페이스가 `set/binding` 리소스 인터페이스로 표현된다.
3. 앱/런타임이 그 인터페이스에 맞는 `DescriptorSetLayout`(DSL)을 만든다.
4. DSL 집합 + push constant ranges로 `PipelineLayout`을 만든다.
5. 셰이더 모듈 + pipeline layout으로 pipeline을 만든다.
6. 실행 직전 실제 버퍼/이미지 핸들로 descriptor set을 write/update 한다.
7. 커맨드 버퍼 기록을 시작한다.
8. `vkCmdBindPipeline`으로 실행할 파이프라인을 바인딩한다.
9. `vkCmdBindDescriptorSets`로 이번 실행의 실제 리소스를 슬롯에 꽂는다.
10. `vkCmdDispatch` 실행. 이때 계약과 바인딩 실물이 불일치하면 validation/runtime 단계에서 실패한다.

## 핵심 요약
- create 단계: "형식/계약"을 확정
- bind/dispatch 단계: "실물"을 대입
- 그래서 pipeline create 성공 후에도 runtime mismatch가 발생할 수 있다.
