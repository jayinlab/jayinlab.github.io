---
title: "WebGPU는 왜 WebGL 3가 아니었을까"
date: 2026-07-23
slug: "gpu-fun-fact-webgpu-modern-api"
draft: false
type: "note"
series: "gpu-fun-facts"
tags: ["gpu", "webgpu", "webgl", "browser", "graphics-history"]
difficulty: "beginner"
---

WebGL을 써 본 사람에게 WebGPU라는 이름은 조금 낯설다. 그냥 WebGL 3라고 부르면 더 익숙했을 텐데, 왜 새 이름과 새 모양의 API가 필요했을까?

핵심은 browser가 상대해야 하는 GPU 세계가 바뀌었다는 데 있다. WebGL은 OpenGL ES 계열의 감각을 web으로 가져온 API에 가깝다. 덕분에 web page 안에서도 3D graphics를 그릴 수 있었다. 하지만 native 쪽 GPU API는 시간이 지나며 Direct3D 12, Metal, Vulkan처럼 더 explicit한 방향으로 움직였다. Pipeline을 미리 만들고, command를 기록하고, resource 사용을 더 분명하게 드러내는 식이다.

WebGPU는 이 흐름을 browser에 맞게 다시 접은 API다. W3C GPU for the Web explainer는 WebGPU가 D3D12, Metal, Vulkan 같은 여러 native GPU API 위에 구현될 수 있어야 한다고 설명한다. Chrome의 WebGPU release 글도 WebGPU가 modern hardware capability를 노출하고, WebGL보다 advanced GPU feature와 general computation을 더 직접 지원한다고 소개한다.

그렇다고 native API를 그대로 browser에 뚫어 놓은 것은 아니다. Browser에는 tab 격리, 보안, portability, JavaScript와의 약속이 있다. 그래서 WebGPU는 command encoder, pipeline, bind group처럼 최신 GPU API의 구조를 닮았지만, validation과 sandbox, WGSL 같은 web용 shader language도 함께 둔다. “GPU를 더 직접 쓰고 싶다”와 “web은 안전하게 돌아야 한다” 사이의 타협인 셈이다.

왜 중요할까? WebGPU를 보면 오늘날 GPU API의 공통 문화가 보인다. 빠른 GPU 사용은 driver가 모든 것을 추측하게 맡기는 쪽보다, app이 의도를 더 일찍 말해 주는 쪽으로 이동했다. WebGPU는 그 변화를 web답게 번역한 결과에 가깝다.

Source note: W3C GPU for the Web explainer는 WebGPU가 WebGL보다 advanced GPU feature와 first-class general computation을 지원하며, D3D12/Metal/Vulkan 같은 native GPU API를 target으로 구현 가능해야 한다고 설명한다. Chrome WebGPU release 글은 WebGPU가 Chrome 113부터 기본 제공되기 시작했고, modern hardware capability와 WebGL이 제공하지 않는 advanced capability를 web에 노출한다고 소개한다.
