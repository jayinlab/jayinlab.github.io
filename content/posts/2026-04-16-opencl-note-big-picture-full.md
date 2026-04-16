---
title: "GPU 배송센터 심화편 — 박스가 트럭에 실리고 출발하는 전 과정"
date: 2026-04-16
slug: "opencl-note-big-picture-full"
draft: false
type: "note"
series: "opencl-deep-dive"
tags: ["vulkan", "opencl", "descriptor", "pipeline-layout", "gpu", "beginner"]
difficulty: "beginner"
animation: true
layer: "VK"
---

[큰 그림 비유 1편](/opencl-note-big-picture-kids/)에서는 배송센터 이야기를 글로 읽었다.  
이번에는 **1막(배송 이야기) → 2막(GPU 언어로 복습)**의 흐름으로 움직이는 애니메이션을 본다.

박스 안에 실제로 뭐가 들었는지, 설계 종이와 오늘 배송표의 차이, 작업반장이 세 마디를 외치면  
무슨 일이 벌어지는지를 먼저 순수한 이야기로 따라간 다음 — 2막에서 GPU 용어로 복습한다.

---

{{< bigpicture_full_anim >}}

---

## 12장면 구성

### 1막 — 배송 이야기 (장면 1–9)

| 장면 | 내용 | 핵심 포인트 |
|------|------|------------|
| ① | 오늘 할 일 | saxpy 계산: y = a × x + y, 숫자 1백만 개 |
| ② | 박스 안에 뭐가? | 박스를 열면 float 배열 — 숫자 데이터 그 자체 |
| ③ | 트럭과 칸 구조 | 칸마다 받을 수 있는 박스 종류가 정해져 있음 |
| ④ | 설계 종이 | DSL = "칸 규격서" (트럭이 아님!) — vkAllocateDescriptorSets가 실제 트럭 생성 |
| ⑤ | 오늘 배송표 | 실제 박스 배정, 내일은 다른 박스도 가능 |
| ⑥ | 박스 탑승! | 박스들이 포물선을 그리며 슬롯으로 날아듦 |
| ⑦ | 트럭 B — 다른 구성 | 칸이 4개인 트럭 B (CombinedImageSampler 포함) |
| ⑧ | 작업반장 세 마디 | 순서: ①bind pipeline → ②bind set → ③dispatch |
| ⑨ | GPU 처리 + 결과 | 트럭 A → 처리 → 트럭 B → 처리, 두 번의 dispatch |

### 2막 — GPU 언어로 (장면 10–12)

| 장면 | 내용 | 핵심 포인트 |
|------|------|------------|
| ⑩ | GPU 언어로 복습 | 이야기 속 각 요소에 API 이름 레이블 부착 |
| ⑪ | 규격 불일치 오류 | pipeline create 성공 ≠ dispatch 성공 |
| ⑫ | 전체 매핑 테이블 | 비유 ↔ API 이름 ↔ 설명 3열 정리 (vkAllocateDescriptorSets 포함) |

---

## 장면 ②: 박스 안에 뭐가 있나

박스는 단순한 "데이터 덩어리"다. saxpy 예제에서는:

| 박스 이름 | 안의 내용 | 설명 |
|-----------|-----------|------|
| `x_buffer` | `[0.5f, 1.2f, 3.7f, ...]` | 곱할 입력 배열 |
| `y_buffer` | `[2.1f, 0.8f, 4.1f, ...]` | 더할 입력 + 결과 덮어씀 |
| `output`   | (비어 있음) | 결과 저장소 |
| `a`        | `2.0f` | 스칼라 상수 — 박스가 아닌 push constant |

GPU는 이 숫자 배열들을 한 번에 64개씩 병렬로 처리한다.

---

## 장면 ④ vs ⑤: 설계 종이와 배송표의 차이

```c
// 설계 종이 (한 번 생성, 재사용)
VkDescriptorSetLayoutBinding bindings[] = {
    { .binding=0, .descriptorType=VK_DESCRIPTOR_TYPE_STORAGE_BUFFER, ... },
    { .binding=1, .descriptorType=VK_DESCRIPTOR_TYPE_STORAGE_BUFFER, ... },
    { .binding=2, .descriptorType=VK_DESCRIPTOR_TYPE_STORAGE_BUFFER, ... },
};
vkCreateDescriptorSetLayout(device, &layoutInfo, NULL, &dsl);

// 오늘 배송표 (매 프레임/커널마다 바꿀 수 있음)
VkWriteDescriptorSet writes[] = {
    { .dstBinding=0, .pBufferInfo=&x_bufInfo, ... },  // 칸0 ← x_buffer
    { .dstBinding=1, .pBufferInfo=&y_bufInfo, ... },  // 칸1 ← y_buffer
    { .dstBinding=2, .pBufferInfo=&outBufInfo, ... }, // 칸2 ← output
};
vkUpdateDescriptorSets(device, 3, writes, 0, NULL);
```

---

## 장면 ⑦: 작업반장 세 마디 순서

```c
// ① 작업 라인 선택
vkCmdBindPipeline(cmd, VK_PIPELINE_BIND_POINT_COMPUTE, pipeline);

// ② 트럭 배정
vkCmdBindDescriptorSets(cmd, ..., 0, 1, &descSet, 0, NULL);
vkCmdPushConstants(cmd, layout, VK_SHADER_STAGE_COMPUTE_BIT, 0, 4, &a);

// ③ 출발!
vkCmdDispatch(cmd, n/64, 1, 1);
```

이 순서는 command buffer에 **기록**되는 순서다.  
실제 GPU 실행은 command buffer submit 이후 — 더 나중에 일어난다.

---

## 핵심 3줄

```
1. 박스 안 = float 배열 — GPU 메모리에 올라간 숫자 덩어리
2. 설계 종이(DSL) ≠ 오늘 배송표 — 규격은 고정, 실물은 교체 가능
3. 작업반장 세 마디 순서(pipeline → bind → dispatch)는 반드시 지킨다
```

---

## 관련 글

- [큰 그림 1편 — 배송센터 9단계 비유 (텍스트)](/opencl-note-big-picture-kids/)
- [Arg0→슬롯 미니 예제 — saxpy 커널](/opencl-note-arg0-to-slot/)
- [Vulkan Pipeline Stage 정리](/opencl-note-pipeline-stages/)

## 관련 용어

[[descriptor-set]], [[pipeline-layout]], [[SPIR-V]], [[barrier]], [[work-item]]
