---
title: "물류센터 비유 치트시트 — OpenCL→clspv→Vulkan→PM4 전체 비유 매핑표"
date: 2026-04-13
slug: "opencl-note-logistics-cheatsheet"
draft: false
type: "note"
series: "opencl-deep-dive"
tags: ["opencl", "vulkan", "pm4"]
difficulty: "intermediate"
layer: "CL"
---

"전체 스택을 한 번에 기억하고 싶다"면 이 치트시트 하나면 된다.  
OpenCL → clspv → Vulkan → 드라이버 → PM4를 **거대 물류센터** 비유로 매핑한다.

---

## 핵심 질문

> "계약서는 박스마다인가? 아니면 슬롯 규격으로 한 번에 정하는가?"

**답: 슬롯 규격으로 한 번에 정한다.**

두 레벨:
1. **창고 규격 계약(정적)**: 슬롯 체계 자체를 정함 (set/binding/type/count)
2. **당일 배송 대입(동적)**: 오늘 들어온 실제 박스(버퍼 핸들)를 슬롯에 꽂음

---

## 전체 비유 매핑표

| 물류센터 비유 | 실제 개념 |
|-------------|---------|
| **물품 명세 초안** | OpenCL kernel arg 목록 |
| **표준 입고 코드** | clspv/SPIR-V resource interface |
| **슬롯 규격서 (set N, binding M)** | DescriptorSetLayout (DSL) |
| **창고 전체 계약서** | PipelineLayout (DSL들 + push constant) |
| **작업 라인 절차서** | Pipeline (어떤 셰이더로 일할지) |
| **오늘 실물 배치표** | Descriptor Set (실제 VkBuffer 핸들 꽂기) |
| **배치표를 라인에 장착** | vkCmdBindDescriptorSets |
| **작업 시작 버튼** | vkCmdDispatch |
| **현장 제어 지시 스트림** | Driver backend command stream |
| **하드웨어 제어 패킷 묶음** | PM4 |

---

## 트럭 = Descriptor Set으로 보면

| 트럭 속성 | Vulkan 개념 |
|---------|------------|
| 트럭 번호 | `set index` |
| 칸 번호 | `binding index` |
| 칸 규격(네모/원형) | descriptor type |
| 칸 수량 | descriptor count |
| 오늘 들어온 실제 박스 | VkBuffer / VkImage 핸들 |

---

## "create 성공, runtime 실패" 설명

```
창고 설계도 승인 완료 (pipeline create 성공)
  ↓
실제 입고 작업에서 원형 박스를 네모 칸에 넣으려 시도
  ↓
칸 규격과 불일치 → 실패 (runtime mismatch)
```

왜 일어나는가:
- create 단계 = 설계도(규격서)의 논리적 일관성만 검증
- runtime 단계 = 실물 배치가 규격서와 맞는지 실제 검증

---

## 30초 암기 카드

| 번호 | 기억할 것 |
|------|---------|
| 1 | 계약은 박스마다가 아니라 **슬롯 규격(DSL/PL)**에 있다 |
| 2 | 박스 하나 = **실제 리소스 핸들 1개(VkBuffer/VkImage)** |
| 3 | 트럭=Descriptor Set, 칸=binding, 트럭 번호=set |
| 4 | create 성공 후 runtime 실패 = "설계도 OK, 현장 배치 불일치" |
| 5 | PM4 = 창고 사무실보다 **현장 제어기** 쪽 (하드웨어 근접) |

---

## 이해 확인 질문

### Q1. Descriptor Set Layout과 Descriptor Set의 비유 차이는?

<details>
<summary>정답 보기</summary>

- **DSL (설계도)**: 슬롯 규격서 — "칸 번호, 칸 크기, 받을 수 있는 박스 종류"
- **Descriptor Set (실물 배치표)**: 오늘 각 칸에 실제로 꽂은 박스(VkBuffer 핸들)

</details>

### Q2. Pipeline Layout이 "창고 전체 계약서"인 이유는?

<details>
<summary>정답 보기</summary>

여러 DSL(슬롯 규격서들)을 묶고, push constant(소량 즉시 전달 데이터)까지 포함한  
**이 파이프라인이 기대하는 모든 입력 형식**을 하나로 정의하기 때문이다.

</details>

### Q3. PM4가 "창고 사무실보다 현장 제어기"인 이유는?

<details>
<summary>정답 보기</summary>

창고 사무실(OpenCL API)은 높은 수준의 추상화 계층이다.  
PM4는 드라이버가 GPU CP(Command Processor)에 직접 전달하는 하드웨어 근접 패킷이다.  
사람(개발자)이 직접 쓰지 않고, 드라이버가 자동 생성한다.

</details>

---

## 관련 글

- [고정 슬롯이 빠른 이유](/opencl-note-fixed-slots-fast/) — 슬롯 계약의 성능 원리
- [Arg0→슬롯 미니 예제](/opencl-note-arg0-to-slot/) — 구체 커널로 매핑 확인
- [초등학생 큰 그림](/opencl-note-big-picture-kids/) — 더 쉬운 비유 버전

## 관련 용어

[[descriptor-set]], [[pipeline-layout]], [[pm4-packet]], [[ANGLE]], [[clspv]]
