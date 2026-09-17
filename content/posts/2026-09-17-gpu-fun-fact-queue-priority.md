---
title: "GPU queue의 우선순위는 왜 예약석이 아닐까"
date: 2026-09-17
slug: "gpu-fun-fact-queue-priority"
draft: false
type: "note"
series: "gpu-fun-facts"
tags: ["gpu", "vulkan", "queue", "scheduling", "priority"]
difficulty: "beginner"
---

GPU queue에 `priority`를 높게 주면 놀이공원의 VIP 줄처럼 언제나 먼저 처리될 것 같지만, Vulkan에서 이 값은 예약표가 아니라 **안내 표지**에 가깝다. 높은 숫자는 “이 queue를 더 중요하게 봐 달라”는 뜻이지, 몇 ms 안에 끝난다는 보증이 아니다.

device를 만들 때 각 queue에는 0.0부터 1.0 사이의 priority를 준다. implementation은 이 연속적인 숫자를 hardware와 driver가 지원하는 몇 개의 실제 priority level로 바꾼다. 그래서 0.70과 0.71을 서로 다른 등급으로 취급하리라는 보장도 없다. 높은 priority queue가 더 많은 처리 시간을 받을 *수는* 있지만, Vulkan specification은 더 나은 quality of service를 보장하지 않는다고 명시한다.

더 놀라운 구석도 있다. 같은 priority인 두 queue의 실행 순서는 정해져 있지 않으며, 순서가 필요하면 semaphore 같은 명시적 synchronization을 써야 한다. 반대로 implementation은 높은 priority queue가 계속 바쁘면 같은 `VkDevice`의 낮은 priority queue를 굶길 수도 있다. priority는 dependency를 표현하는 장치가 아니라 scheduler가 참고하는 힌트인 셈이다.

왜 중요할까? background compute queue의 숫자를 낮췄다고 화면 작업의 deadline이 자동으로 보호되지는 않는다. command를 잘게 나누고, 필요한 dependency를 정확히 연결하며, 실제 device에서 지연을 측정해야 한다.

VIP 줄 비유에도 한계가 있다. 현실의 줄에는 눈에 보이는 한 명의 안내원이 있지만, GPU scheduling은 hardware engine, driver, 제출된 work와 synchronization의 영향을 함께 받는다. priority는 중요한 신호지만 stopwatch도, 실행 순서표도 아니다.

Source note: [Khronos Vulkan Specification — Queue Priority](https://docs.vulkan.org/spec/latest/chapters/devsandqueues.html#devsandqueues-priority)는 queue priority가 0.0–1.0 값에서 implementation-defined discrete level로 변환되며, 더 많은 처리 시간이나 더 나은 QoS를 보장하지 않고, 같은 priority queue 간 ordering도 explicit synchronization 없이는 보장하지 않는다고 규정한다.
