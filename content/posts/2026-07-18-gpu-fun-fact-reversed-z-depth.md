---
title: "깊이 버퍼를 왜 거꾸로 쓰기도 할까"
date: 2026-07-18
slug: "gpu-fun-fact-reversed-z-depth"
draft: false
type: "note"
series: "gpu-fun-facts"
tags: ["gpu", "rendering", "depth-buffer", "graphics-history"]
difficulty: "beginner"
---

3D 장면에서 가까운 물체와 먼 물체가 거의 같은 위치에 겹쳐 보이면, 화면이 깜빡거리거나 표면이 싸우듯 튀는 일이 있다. 보통 Z-fighting이라고 부르는 현상이다. 이름은 거창하지만, 결국 depth buffer가 “둘 중 누가 앞인가”를 충분히 촘촘하게 구분하지 못할 때 생기는 문제다.

재미있는 점은 많은 GPU의 depth 값이 눈앞에서부터 먼 곳까지 균일한 줄자처럼 저장되지 않는다는 것이다. Perspective projection과 rasterization에 잘 맞추기 위해 보통 `1/z`에 가까운 형태로 저장된다. 덕분에 삼각형 안에서 depth를 보간하고 early-Z 같은 최적화를 하기 좋지만, 값의 분포가 한쪽으로 많이 몰린다. 특히 아주 가까운 near plane을 쓰면 precision이 더 심하게 앞쪽에 몰린다.

그래서 나온 실용적인 꼼수가 reversed-Z다. 이름 그대로 가까운 면을 depth `1`, 먼 면을 depth `0`으로 뒤집어 쓴다. 여기에 floating-point depth buffer를 같이 쓰면 floating-point 숫자가 0 근처에서 더 촘촘해지는 성질과 `1/z` 곡선의 치우침이 어느 정도 서로 상쇄된다. 결과적으로 near plane 근처만 과하게 정밀한 대신, 먼 거리까지 더 고르게 쓸 만한 precision을 얻는다.

이 발상은 “더 큰 depth buffer를 달자”가 아니라 “같은 숫자 표현을 더 영리하게 배치하자”에 가깝다. 멀리 보이는 산, 큰 오픈월드 지형, 우주 배경처럼 far range가 넓은 장면에서 작은 설정 차이가 화면의 안정감으로 이어질 수 있다.

왜 중요할까? GPU 성능 이야기는 보통 shader나 bandwidth로 흘러가지만, 실제 renderer의 품질은 이런 좌표계와 숫자 배치 선택에도 크게 좌우된다. reversed-Z는 hardware를 바꾸지 않고도 수학적 약속을 살짝 뒤집어 더 나은 결과를 얻는, 그래픽스다운 작은 해킹이다.

Source note: Nathan Reed의 "Depth Precision Visualized" 및 NVIDIA Technical Blog 재게시본은 GPU depth buffer가 보통 world-space depth의 reciprocal에 비례하는 값을 저장하며, floating-point depth buffer에서 near plane을 `d=1`, far plane을 `d=0`으로 두는 reversed-Z가 depth precision을 크게 개선할 수 있다고 설명한다. Reed는 이 아이디어가 적어도 Lapidous/Jiao의 SIGGRAPH 1999 논문까지 거슬러 올라가며, 이후 여러 글과 발표를 통해 널리 알려졌다고 정리한다.
