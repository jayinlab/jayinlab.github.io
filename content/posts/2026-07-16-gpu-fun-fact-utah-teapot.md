---
title: "왜 그래픽스 교과서에는 찻주전자가 자주 나올까"
date: 2026-07-16
slug: "gpu-fun-fact-utah-teapot"
draft: false
type: "note"
series: "gpu-fun-facts"
tags: ["gpu", "graphics-history", "rendering", "utah-teapot"]
difficulty: "beginner"
---

컴퓨터 그래픽스 예제에서 가끔 이상할 정도로 자주 보이는 물건이 있다. 공도 아니고 자동차도 아니고, 하얀 찻주전자다. 이름은 Utah teapot. 1975년 University of Utah의 Martin Newell이 실제 찻주전자를 보고 좌표 데이터로 만든 3D 모델이다.

이 물건이 오래 살아남은 이유는 모양이 묘하게 실용적이었기 때문이다. 구처럼 너무 단순하지 않고, 사람 얼굴처럼 너무 복잡하지도 않다. 둥근 몸통, 손잡이, 주둥이, 뚜껑이 있어서 곡면, 실루엣, 하이라이트, 그림자, 숨은 면 처리 같은 렌더링 문제를 한 번에 건드릴 수 있다. 게다가 크기도 작아서 당시 컴퓨터로 실험하기에 부담이 덜했다.

그래서 Utah teapot은 어느 순간 “새 renderer가 제대로 빛을 칠하는지 보자”는 공용 장난감이 됐다. Computer History Museum은 Newell의 teapot이 약 20년 동안 프로그래머들이 light, shade, color를 실험하는 출발점으로 쓰였다고 설명한다. University of Utah Graphics Lab도 이 모델을 computer graphics의 상징 중 하나로 소개한다.

왜 중요할까? GPU 공부를 하다 보면 거대한 API 이름보다 먼저, 결국 화면에 무언가를 그려 보며 기술이 자랐다는 사실을 잊기 쉽다. Utah teapot은 “좋은 테스트 장면” 하나가 알고리즘, hardware, tool 문화까지 오래 묶어 줄 수 있다는 작은 증거다.

Source note: Computer History Museum은 Martin Newell이 1975년 University of Utah에서 teapot을 좌표 데이터와 wireframe/surface 모델로 만들었고, 이후 오랫동안 lighting/shading 실험의 출발점으로 쓰였다고 설명한다. University of Utah Graphics Lab은 Utah teapot을 computer graphics의 상징이자 초기 Bézier patch 기반 모델 중 하나로 소개한다.
