---
title: "Descriptor/Pipeline Layout 호환 계약: 왜 드라이버는 '같아 보이는 바인딩'도 거절할까"
date: 2026-05-11
slug: "opencl-note-descriptor-pipeline-layout-compat-contract"
draft: false
type: "note"
series: "opencl-deep-dive"
tags: ["opencl", "vulkan", "descriptor-set", "pipeline-layout", "driver"]
difficulty: "intermediate"
---

OpenCL 경로를 Vulkan compute로 내릴 때, host 쪽에서는 "버퍼만 바꿔 끼웠는데 왜 재바인드/재검증 비용이 크지?"라는 의문이 자주 나온다.  
핵심은 단순히 버퍼 핸들이 아니라, **descriptor set layout + pipeline layout의 호환 계약**을 드라이버가 매우 보수적으로 확인한다는 점이다.

이번 노트는 "값(value) 변경"과 "계약(contract) 변경"을 분리해서 본다.

## 1) 드라이버 관점의 최소 단위: 값이 아니라 인터페이스 계약

드라이버가 빠르게 처리하고 싶은 경로는 다음 조건을 만족할 때다.

- pipeline layout이 기존과 호환됨
- descriptor set layout이 슬롯별로 동일 규칙을 유지함
- stage visibility/descriptor type/array count/immutable sampler 조건이 깨지지 않음

즉, `VkDescriptorBufferInfo`의 offset/size 같은 **동적 값 변경**은 상대적으로 싸게 처리 가능하지만, layout 정의 자체가 바뀌면 검증·캐시·patch 경로가 다시 탄다.

## 2) "같아 보이는데" 깨지는 대표 케이스

실무에서 자주 혼동되는 경우를 좁혀보면:

1. binding index는 같은데 descriptor type이 달라짐  
   - 예: `STORAGE_BUFFER` ↔ `UNIFORM_BUFFER`
2. set 번호는 같은데 stageFlags가 바뀜  
   - compute 전용으로 보던 슬롯이 다른 stage 가시성 규칙을 요구
3. array count 변경  
   - `binding=3`이 1개에서 4개로 늘어남
4. push constant range가 pipeline layout에서 달라짐

이 경우 host 코드는 "이 정도는 유사"하다고 느끼지만, 드라이버는 **다른 ABI**로 취급한다.

## 3) OpenCL 브리지에서 왜 더 민감해지나

OpenCL 커널 시그니처가 바뀌면(clSetKernelArg 대상/개수/타입 변화), clspv/SPIR-V 리소스 인터페이스가 같이 흔들린다.  
그 결과 Vulkan 쪽 descriptor set layout/pipeline layout도 연쇄적으로 변하고, 재사용하려던 pipeline 캐시 hit가 깨진다.

정리하면:

- OpenCL arg 시그니처 drift
- SPIR-V resource decoration 변화
- Vulkan layout 계약 변화
- 드라이버 fast path 이탈

이 체인은 "컴파일 문제"와 "제출 경로 비용"을 동시에 건드린다.

## what this means for driver dev

드라이버/런타임 개발에서는 다음을 우선순위로 본다.

- **layout 호환성 판단을 값 변경 경로와 분리**: validation/patch 비용 계측 포인트를 따로 둔다.
- **pipeline layout key 설계 명확화**: set layout fingerprint + push constant 범위를 key에 명시해 캐시 miss 원인을 추적한다.
- **"유사하지만 비호환" 케이스 로그화**: binding/type/stageFlags/arrayCount 중 무엇이 계약을 깼는지 원인 코드를 남긴다.
- **OpenCL 시그니처 변동 감시**: kernel arg 변경이 backend layout churn으로 번지는 구간을 통계로 수집한다.

결국 성능 최적화는 "버퍼 값 교체를 싸게"보다 먼저, **계약 자체를 덜 흔들리게 유지**하는 설계에서 시작된다.

## app-facing takeaway (짧게)

앱 개발자 입장에서는 "리소스 값 갱신"과 "레이아웃 정의 변경"을 같은 수준의 변경으로 다루면 손해다.

- 자주 바뀌는 건 descriptor 내용(버퍼/offset)으로 제한
- set/binding/type/stage 규칙은 가능한 고정
- 커널/셰이더 인터페이스 변경은 배치해서 반영

이렇게 하면 드라이버가 캐시/재검증 fast path를 유지할 확률이 올라간다.

---

## 관련 글

- [same SPIR-V, different driver]({{< relref "2026-04-23-opencl-note-same-spirv-different-driver.md" >}})
- [wrong-note: layout vs binding update]({{< relref "2026-04-23-opencl-wrong-note-layout-vs-binding-update.md" >}})
- [specialization vs push constant vs UBO]({{< relref "2026-05-06-opencl-note-specialization-vs-push-constant-vs-ubo.md" >}})

## 관련 용어

- [[descriptor-set]], [[descriptor-set-layout]], [[pipeline-layout]], [[SPIR-V]]
