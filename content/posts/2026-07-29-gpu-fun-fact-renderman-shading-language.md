---
title: "Shader는 GPU보다 먼저 영화 쪽에서 자랐다"
date: 2026-07-29
slug: "gpu-fun-fact-renderman-shading-language"
draft: false
type: "note"
series: "gpu-fun-facts"
tags: ["gpu", "shader", "renderman", "graphics-history", "pixar"]
difficulty: "beginner"
---

요즘 shader라고 하면 자연스럽게 GPU에서 도는 작은 프로그램을 떠올린다. 그런데 "표면이 빛을 어떻게 받아야 하는지 프로그램으로 쓴다"는 감각은 대중적인 programmable GPU보다 훨씬 오래된 영화 렌더링 문화에서도 자라고 있었다.

대표적인 이름이 Pixar의 RenderMan이다. Pixar는 RenderMan이 1988년에 공개되었고, 당시 hardware 제약 때문에 feature film에서 모든 빛 반사를 물리적으로 ray tracing하기는 어려웠다고 설명한다. 그래서 RenderMan은 Reyes라는 렌더링 시스템을 바탕으로, 비싼 물리 계산을 전부 직접 하지 않고도 그럴듯한 photorealistic image를 만들 수 있는 길을 열었다.

여기서 재미있는 부분은 shading language다. IEEE Milestone 기록은 Lucasfilm과 Pixar에서 1981-1988년에 RenderMan을 발전시키는 동안 shading languages, stochastic antialiasing, motion blur, depth of field 같은 발명이 포함되었다고 정리한다. 또 RenderMan Shading Language는 shader를 software로 쉽게 정의하기 위한 발명이라고 설명한다. 즉 artist와 technical director가 "이 물체의 표면은 이런 식으로 보여야 한다"를 renderer에게 작은 프로그램처럼 말할 수 있게 된 셈이다.

물론 이것이 곧바로 오늘날 GPU shader의 직접 조상이라고 단순화하면 곤란하다. 영화 renderer와 realtime GPU pipeline은 속도 목표도, hardware 조건도, API 문화도 달랐다. 그래도 둘은 같은 질문을 공유했다. "고정된 조명 공식만으로는 부족한데, 표면의 생김새를 어디까지 사용자가 말하게 할 것인가?"

왜 중요할까? shader를 보면 GPU 문법부터 외우기 쉽지만, 더 넓게 보면 shader는 "그림의 규칙을 data가 아니라 code로 넘긴다"는 오래된 아이디어다. 그래서 modern graphics API에서 shader module, pipeline, material system이 계속 중심에 남아 있는 것도 조금 덜 낯설어진다.

Source note: Pixar의 RenderMan evolution 페이지는 RenderMan이 1988년에 공개되었고 Reyes 기반으로 hardware 한계 속에서 photorealistic image를 만들었다고 설명한다. IEEE Engineering and Technology History Wiki의 RenderMan Milestone은 1981-1988년 개발 과정의 핵심 발명으로 shading languages 등을 들고, RenderMan Shading Language가 shader를 software로 쉽게 정의하게 했다고 정리한다.
