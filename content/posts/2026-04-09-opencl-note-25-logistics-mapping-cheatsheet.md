---
title: "OpenCL Note #25 — 물류센터 비유로 외우는 전체 매핑 치트시트"
date: 2026-04-09
slug: "opencl-note-25-logistics-mapping-cheatsheet"
draft: false
---

이 문서는 OpenCL → clspv/SPIR-V → Vulkan → driver backend → PM4 흐름을
"거대 물류센터" 비유로 한 번에 외우기 위한 매핑표다.

핵심 질문: "트럭마다 계약서인가? 박스마다 계약서인가?"

## 먼저 결론
- **계약서는 박스마다가 아니다.**
- 계약은 크게 두 레벨:
  1. **창고 규격 계약(정적)**: 슬롯 체계 자체를 정함 (set/binding/type/count/visibility)
  2. **당일 배송 대입(동적)**: 오늘 들어온 실제 박스(버퍼 핸들)를 각 슬롯에 꽂음

즉, "매 박스 계약서"보다
**"창고 슬롯 설계도 + 오늘 입고표"**로 이해하는 게 정확하다.

---

## 레벨을 어떻게 잡아야 하나?

### 박스 하나 = 무엇?
보통 "박스 하나"는 **실제 리소스 객체 1개**로 보면 된다.
- 예: 특정 `VkBuffer` 하나, 특정 `VkImageView` 하나

### 그 박스에 붙은 정보는?
박스 자체에는 "정체(핸들, 크기, 포맷 등)"가 있고,
어느 칸(set/binding)에 꽂힐지는 "오늘 입고표(descriptor write)"가 정한다.

---

## 전체 비유 매핑 (암기용)

- **OpenCL kernel arg 목록** = 배송할 물품 명세 초안
- **clspv/SPIR-V resource interface** = 창고가 이해하는 표준 입고 코드
- **DescriptorSetLayout(DSL)** = "set N, binding M 슬롯 규격서"
- **PipelineLayout(PL)** = 여러 DSL + push constant 포함한 "창고 전체 계약서"
- **Pipeline** = 오늘 어떤 작업 라인을 돌릴지(작업 절차서)
- **Descriptor Set** = 실제 물품 배치표(슬롯에 어떤 실물 박스를 꽂았는지)
- **vkCmdBindDescriptorSets** = 배치표를 실제 라인에 장착
- **vkCmdDispatch** = 작업 시작 버튼
- **Driver backend command stream** = 현장 제어용 작업 지시 스트림
- **PM4** = 하드웨어에 가까운 포맷의 실제 제어 패킷 묶음

---

## "트럭"은 무엇으로 보면 좋은가?
트럭 하나를 **Descriptor Set 1개**로 보면 가장 덜 헷갈린다.

- 트럭 번호 = `set index`
- 트럭 내부 칸 번호 = `binding index`
- 칸 규격(네모/원형 등) = descriptor type
- 칸 수량 = descriptor count

그리고 "오늘 온 실제 박스"(VkBuffer/VkImage 등)를 그 칸에 꽂는다.

### 중요한 포인트
- 트럭(Descriptor Set)은 "컨테이너"
- 박스(리소스 핸들)는 "내용물"
- 규격서(DSL/PL)는 "컨테이너와 칸의 규칙"

---

## 왜 pipeline 생성은 성공했는데 runtime에서 터지나?

- create 단계 성공 = 규격서 자체는 논리적으로 일관됨
- runtime 실패 = 오늘 꽂은 실물 배치가 규격서와 안 맞음

비유로:
- 창고 설계도 승인 완료(생성 성공)
- 실제 입고 작업에서 원형 박스를 네모 칸에 넣으려다 실패(runtime mismatch)

---

## 왜 이런 제약이 빠른가?

규격이 고정되면,
- "어느 칸을 볼지" 인덱스로 즉시 결정 가능
- 런타임 추론/질의/분기 비용 감소
- 드라이버/하드웨어가 더 예측 가능한 경로로 처리 가능

즉, 유연성을 일부 줄여서 처리량과 예측 가능성을 얻는 설계다.

---

## 30초 암기 카드
1. 계약은 박스마다가 아니라 **슬롯 규격(DSL/PL)**에 있다.
2. 박스 하나는 보통 **실제 리소스 핸들 1개(VkBuffer/VkImage)**다.
3. 트럭은 **Descriptor Set**, 칸은 **binding**, 트럭 번호는 **set**.
4. create 성공 후 runtime 실패는 "설계도 OK, 현장 배치 불일치"다.
5. PM4는 창고 사무실(OpenCL API)보다 현장 제어기(backend/HW) 쪽이다.
