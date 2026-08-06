---
title: "CUDA 이전의 GPU 계산은 왜 삼각형으로 변장해야 했을까"
date: 2026-08-06
slug: "gpu-fun-fact-brook-before-cuda"
draft: false
type: "note"
series: "gpu-fun-facts"
tags: ["gpu", "gpgpu", "brook", "cuda", "history"]
difficulty: "beginner"
---

지금은 GPU에 `kernel`을 보내 숫자를 계산하는 일이 자연스럽다. 하지만 2000년대 초의 programmable GPU는 어디까지나 그림을 그리는 장치였다. 행렬 계산이나 FFT를 시키려면 입력 배열을 texture처럼 포장하고, 계산을 fragment program으로 쓰고, 결과를 화면 대신 texture에 그려 넣는 식으로 문제를 그래픽 작업처럼 변장시켜야 했다.

Stanford 연구팀이 만든 **Brook for GPUs**는 이 불편을 정면으로 건드렸다. 2004년 SIGGRAPH 논문에서 Ian Buck과 동료들은 C에 `stream`, `kernel`, reduction 같은 data-parallel 개념을 더했다. 개발자는 삼각형과 texture unit을 직접 조종하는 대신 “이 data stream의 모든 원소에 같은 계산을 적용한다”고 쓸 수 있었다. compiler와 runtime이 그 표현을 당시의 DirectX·OpenGL 기반 GPU 실행으로 번역했다.

Brook이라는 이름도 재미있다. 큰 강보다 작은 시냇물을 뜻하는 단어처럼, data가 stream으로 흐르고 kernel이 그 흐름을 처리한다는 모델이었다. 논문은 SAXPY, 행렬-벡터 곱, FFT, ray tracing 같은 서로 다른 작업을 한 언어로 시험했다. 즉 GPU가 빠르다는 사실만 보인 것이 아니라, GPU를 **그래픽 장치가 아닌 계산 장치로 바라보는 말투**를 만들려 한 셈이다.

그 뒤 Ian Buck은 NVIDIA에 합류했고, NVIDIA는 Brook을 CUDA 이전의 중요한 선구자로 소개한다. CUDA가 Brook의 단순한 이름 변경은 아니지만, “C 개발자가 graphics API로 위장하지 않고 parallel kernel을 쓴다”는 방향은 분명 이어졌다.

왜 중요할까? 오늘날 `kernel`, `stream`, data-parallel programming이 당연해 보이는 건 hardware만 빨라져서가 아니다. 계산을 삼각형으로 번역하던 부담을 compiler와 runtime 뒤로 옮긴 programming model의 변화가, GPU를 훨씬 많은 사람의 계산 도구로 만들었다.

Source note: Stanford의 SIGGRAPH 2004 「Brook for GPUs」 논문과 프로젝트 자료는 Brook이 C에 stream·kernel·reduction을 더하고 graphics hardware를 streaming coprocessor로 추상화했다고 설명한다. NVIDIA의 Ian Buck 소개는 그가 Stanford에서 Brook 개발을 이끌었고 Brook이 general-purpose GPU computing의 선구자였다고 기록한다.
