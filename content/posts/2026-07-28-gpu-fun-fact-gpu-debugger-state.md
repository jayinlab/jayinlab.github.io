---
title: "GPU debugger는 왜 상태를 통째로 보여줄까"
date: 2026-07-28
slug: "gpu-fun-fact-gpu-debugger-state"
draft: false
type: "note"
series: "gpu-fun-facts"
tags: ["gpu", "debugging", "renderdoc", "pipeline", "resources"]
difficulty: "beginner"
---

CPU 프로그램을 debug할 때는 보통 "지금 이 줄에서 변수 값이 뭐지?"를 본다. 그런데 GPU frame debugger를 열면 분위기가 조금 다르다. Shader 코드만 보여 주는 것이 아니라 draw call 목록, pipeline state, texture, buffer, sampler, render target, rasterizer 설정까지 한 화면에 빽빽하게 펼쳐진다. 처음 보면 과하게 친절한 것이 아니라, 사실 그 정도를 봐야 bug가 잡히기 때문이다.

GPU에서 한 draw나 dispatch는 혼자 움직이지 않는다. Shader가 맞아도 엉뚱한 texture가 bound되어 있으면 결과가 틀리고, vertex buffer stride가 다르면 mesh가 찢어지고, depth state나 blend state가 예상과 다르면 pixel이 사라지거나 이상하게 섞인다. 즉 "코드"와 "그 코드를 실행할 때 꽂혀 있던 상태"가 한 세트다.

RenderDoc 문서는 Pipeline Viewer가 graphics pipeline의 stateful settings를 보여 주며, bound resources와 rasterizer settings 같은 항목을 포함한다고 설명한다. 또 resource inspector는 frame capture 안의 API object 목록, object 사이 관계, creation details, texture/buffer가 frame 안에서 어디에 쓰였는지를 보여 준다. Event Browser도 draw, dispatch, copy, clear, resolve처럼 GPU가 일을 하거나 memory/resource에 영향을 주는 action을 골라 보게 해 준다.

재미있는 점은 이런 도구가 GPU를 "실행 중인 프로그램"보다 "녹화된 장면의 증거물"처럼 다룬다는 것이다. 한 frame을 멈춰 놓고, 특정 draw를 고른 뒤, 그 순간 pipeline에 무엇이 연결되어 있었는지 재구성한다. 그래서 missing texture bug를 볼 때도 shader부터 의심하기보다 "이 draw에서 실제로 어떤 view와 sampler가 들어갔나?"를 먼저 확인하는 일이 많다.

왜 중요할까? GPU debug 화면이 복잡한 이유를 알면 API가 왜 resource binding, pipeline, render pass, command 같은 단위로 쪼개져 보이는지 감이 잡힌다. 화면의 한 pixel은 shader 수식 하나만의 결과가 아니라, 그 순간 GPU에 건네진 상태 묶음 전체의 결과다.

Source note: RenderDoc Pipeline State 문서는 Pipeline Viewer가 graphics pipeline의 stateful settings, bound resources, rasterizer settings 등을 보여 준다고 설명한다. Resource Inspector 문서는 frame capture의 API object 목록, 관계, creation details, texture/buffer 사용 위치를 볼 수 있다고 설명한다. Event Browser 문서는 draw, dispatch, copy, clear, resolve 같은 GPU work 또는 memory/resource에 영향을 주는 action을 browsing한다고 설명한다.
