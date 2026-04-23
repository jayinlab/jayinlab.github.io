---
title: "오답노트 — Pipeline Layout(정적 계약)과 Descriptor Set(동적 값) 혼동 정리"
date: 2026-04-23
slug: "opencl-wrong-note-layout-vs-binding-update"
draft: false
type: "wrong-note"
series: "opencl-deep-dive"
tags: ["opencl", "vulkan", "descriptor-set", "pipeline-layout", "wrong-note"]
difficulty: "intermediate"
---

헷갈린 지점은 하나였다.
`vkCreatePipelineLayout` 단계에서 리소스 "값"까지 정해진다고 착각한 것.

실제로는 반대다.
**Pipeline Layout은 슬롯 규격(정적 계약)만 고정**하고,
**실제 버퍼/이미지 핸들은 dispatch 직전 Descriptor Set 바인딩에서 채운다.**

---

## 내가 틀렸던 문장

> "Pipeline Layout 만들 때 이미 이번 프레임에 쓸 버퍼가 결정된다."

이 문장은 틀렸다.
Layout은 "형식", Descriptor Set은 "현재 값"이다.

---

## 정확한 구분

### 1) Pipeline Layout (정적 계약)

- 셰이더가 기대하는 set/binding 구조를 정의
- set 0의 binding 0은 storage buffer, binding 1은 uniform buffer 같은 **타입/슬롯 규격** 고정
- 프레임마다 잘 바뀌지 않음

### 2) Descriptor Set (동적 값)

- 위 계약에 맞춰 실제 리소스 핸들을 채운 객체
- `vkUpdateDescriptorSets`로 "이번 실행에 쓸" 버퍼/이미지 연결
- 데이터가 바뀌면 set을 다시 업데이트하거나 다른 set으로 교체 가능

### 3) Bind 시점

- `vkCmdBindDescriptorSets`에서 command buffer에 "이 dispatch는 이 set을 사용"이라고 기록
- 즉, 실행 순간의 리소스 선택은 bind/update 흐름에서 결정됨

---

## 기억용 한 줄

**Layout = schema, Descriptor Set = row data.**

DB 비유로 보면,
테이블 스키마를 만드는 단계와 오늘 조회에 쓸 실제 레코드는 다른 문제다.

---

## 미니 체크

- Q: Pipeline Layout만 있으면 커널이 읽을 실제 버퍼 주소가 정해지나?
  - A: 아니오. Descriptor Set 업데이트/바인딩이 필요하다.
- Q: 셰이더 코드 변경 없이 입력 버퍼만 바꾸고 싶다. 무엇을 바꿔야 하나?
  - A: Descriptor Set(또는 동등한 바인딩 대상)만 교체하면 된다.

---

## 관련 글

- [OpenCL C → Vulkan bridge: 커널 인자에서 descriptor로](/opencl-note-opencl-to-vulkan-bridge/)
- [같은 SPIR-V인데 결과가 다른 이유 — Driver Lowering 관점](/opencl-note-same-spirv-different-driver/)

## 관련 용어

[[descriptor-set]], [[pipeline-layout]], [[SPIR-V]]
