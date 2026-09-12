---
title: "GPU의 스톱워치는 왜 0으로 돌아갈까"
date: 2026-09-12
slug: "gpu-fun-fact-timestamp-wrap"
draft: false
type: "note"
series: "gpu-fun-facts"
tags: ["gpu", "vulkan", "profiling", "timestamp", "runtime"]
difficulty: "beginner"
---

GPU 성능을 잴 때 timestamp 두 개를 찍으면 거대한 디지털 스톱워치를 얻은 듯하다. 시작 숫자와 끝 숫자를 빼기만 하면 될 것 같지만, 이 시계에는 뜻밖에도 ‘자정’이 있다. 카운터가 표현할 수 있는 마지막 수를 지나면 다음 값은 다시 0이다.

Vulkan에서는 command 실행의 특정 지점에 `vkCmdWriteTimestamp2` 같은 명령으로 timestamp를 query pool에 기록한다. 이 값이 1 증가하는 데 걸리는 nanosecond는 device의 `timestampPeriod`로 알 수 있다. 예를 들어 두 기록의 차이가 500이고 period가 2 ns라면 측정 간격은 1,000 ns다. CPU의 벽시계를 읽는 대신 GPU가 자기 실행 흐름에 표식을 남기는 셈이다.

재미있는 함정은 모든 64 bit가 반드시 시계 바늘은 아니라는 점이다. queue family마다 `timestampValidBits`가 의미 있는 bit 수를 알려 주며, 지원할 경우 그 값은 36~64다. 명세는 overflow가 나면 timestamp가 0으로 wrap해야 한다고 정한다. 따라서 끝 값이 시작 값보다 작다고 곧바로 “GPU 시간이 거꾸로 갔다”고 결론 내리면 안 된다. 유효 bit 폭을 기준으로 modular difference를 계산해야 한 바퀴를 넘은 짧은 구간도 올바르게 잴 수 있다.

다만 이 비유는 timestamp를 정밀한 CPU 손목시계로 오해하게 만들 수 있다. GPU timestamp는 device time domain의 값이고, 기록 지점도 지정한 pipeline stage의 실행 의미를 따른다. CPU 시각과 직접 맞추거나 서로 다른 장치의 시계를 비교하려면 calibrated timestamps 같은 별도 기능과 보정이 필요하다. 또한 측정 구간이 카운터를 두 번 이상 돌 만큼 길면 두 값만으로 몇 바퀴였는지 복원할 수 없다.

Source note: [Khronos Vulkan Specification — Timestamp Queries](https://docs.vulkan.org/spec/latest/chapters/queries.html#queries-timestamps)는 timestamp의 유효 bit 수, `timestampPeriod`, device time domain, overflow 시 zero wrap을 정의한다. [Khronos Vulkan Reference — `VkQueueFamilyProperties`](https://docs.vulkan.org/refpages/latest/refpages/source/VkQueueFamilyProperties.html)는 `timestampValidBits`가 timestamp의 meaningful bits 수이며, 지원 시 36~64이고 0이면 미지원이라고 명시한다.
