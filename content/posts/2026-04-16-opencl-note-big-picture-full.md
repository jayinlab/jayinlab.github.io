---
title: "GPU 배송센터 심화편 — 박스가 트럭에 실리고 출발하는 전 과정"
date: 2026-04-15
slug: "opencl-note-big-picture-full"
draft: false
type: "note"
series: "opencl-deep-dive"
tags: ["vulkan", "opencl", "descriptor", "pipeline-layout", "gpu", "beginner"]
difficulty: "beginner"
animation: true
layer: "VK"
---

[큰 그림 비유 1편](/opencl-note-big-picture-kids/)에서는 배송센터 이야기를 글로 정리했다.  
이번에는 그 이야기를 **처음부터 끝까지 움직이는 애니메이션**으로 다시 본다.

박스가 어디서 오고, 트럭에 어떻게 실리고, 설계 종이는 무슨 역할을 하는지,  
작업반장이 세 마디를 외치면 무슨 일이 벌어지는지 — 11개 장면으로 순서대로 확인한다.

---

{{< bigpicture_full_anim >}}

---

## 11개 장면 요약

| 장면 | 내용 | 실제 개념 |
|------|------|-----------|
| ① | 배송센터 등장 | GPU — 고속 병렬 처리 공장 |
| ② | 박스들 도착 | VkBuffer / VkImage — GPU 리소스 |
| ③ | 트럭과 칸 | Descriptor Set / binding index |
| ④ | 설계 종이 펼치기 | Descriptor Set Layout + Pipeline Layout |
| ⑤ | 오늘 작업 종이 | vkUpdateDescriptorSets |
| ⑥ | 박스가 슬롯으로 날아들기 | vkCmdBindDescriptorSets |
| ⑦ | 작업반장의 세 마디 | CPU host — vkCmd* 호출 순서 |
| ⑧ | 트럭 출발 | vkCmdDispatch → GPU 실행 |
| ⑨ | 규격 불일치 오류 | descriptor type mismatch |
| ⑩ | 신호실 PM4 | 드라이버 → PM4 패킷 → GPU CP |
| ⑪ | 전체 매핑 테이블 | 비유 ↔ 실제 개념 한눈에 |

---

## 장면 ④가 중요한 이유

설계 종이(Descriptor Set Layout)는 **한 번 만들면 바뀌지 않는다.**

```c
// 설계 종이 = DSL 생성 (재사용 가능)
VkDescriptorSetLayoutBinding bindings[] = {
    { .binding=0, .descriptorType=VK_DESCRIPTOR_TYPE_STORAGE_BUFFER, ... },
    { .binding=1, .descriptorType=VK_DESCRIPTOR_TYPE_STORAGE_BUFFER, ... },
    { .binding=2, .descriptorType=VK_DESCRIPTOR_TYPE_STORAGE_BUFFER, ... },
};
vkCreateDescriptorSetLayout(device, &layoutInfo, NULL, &dsl);
```

오늘 작업 종이(vkUpdateDescriptorSets)는 **매번 바뀔 수 있다.**  
설계 규격은 같은 채로, 어떤 실제 버퍼가 들어가는지만 갈아끼운다.

---

## 장면 ⑦의 세 마디 순서가 중요한 이유

```c
// ① 작업 라인 선택
vkCmdBindPipeline(cmd, VK_PIPELINE_BIND_POINT_COMPUTE, pipeline);

// ② 트럭 배정 (어떤 descriptor set이 어떤 set slot에)
vkCmdBindDescriptorSets(cmd, ..., 0, 1, &descSet, 0, NULL);

// ③ 시작
vkCmdDispatch(cmd, n/64, 1, 1);
```

이 순서는 command buffer에 **기록**되는 순서다.  
실제 GPU 실행은 command buffer가 submit된 이후 — 더 나중에 일어난다.

---

## 장면 ⑨를 꼭 기억해야 하는 이유

설계도 승인(`vkCreatePipeline` 성공)이 곧 dispatch 안전을 뜻하지 않는다.

```
pipeline create 성공  →  규격서(DSL)가 올바른지만 확인됨
descriptor bind/dispatch  →  실물이 규격서와 맞는지 그때 가서 확인됨
```

실물(actual descriptor)이 규격(DSL type)과 다르면 **validation error** 또는 **GPU hang**.

---

## 핵심 3줄

```
1. 설계 종이(DSL) = 트럭 칸 규격, 한 번 정하면 고정
2. 오늘 작업 종이(vkUpdate) = 실제 박스 배정, 매번 바뀔 수 있음
3. 작업반장 세 마디 순서(pipeline → bind → dispatch)는 반드시 지킨다
```

---

## 관련 글

- [큰 그림 1편 — 배송센터 9단계 비유 (텍스트)](/opencl-note-big-picture-kids/)
- [Arg0→슬롯 미니 예제 — saxpy 커널](/opencl-note-arg0-to-slot/)
- [Vulkan Pipeline Stage 정리](/opencl-note-pipeline-stages/)

## 관련 용어

[[descriptor-set]], [[pipeline-layout]], [[SPIR-V]], [[barrier]], [[work-item]]
