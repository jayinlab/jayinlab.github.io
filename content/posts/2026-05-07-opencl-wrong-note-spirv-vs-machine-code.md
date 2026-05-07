---
title: "OpenCL Wrong Note: SPIR-V를 GPU 기계코드로 오해했던 문제"
date: 2026-05-07
slug: "opencl-wrong-note-spirv-vs-machine-code"
draft: false
type: "wrong-note"
series: "opencl-deep-dive"
tags: ["opencl", "spir-v", "compiler", "driver", "wrong-note"]
difficulty: "beginner"
---

OpenCL을 처음 정리할 때, `clspv`가 만든 SPIR-V가 곧바로 GPU에서 실행되는 "최종 기계코드"라고 생각했다.
이 이해는 정확하지 않다.

핵심은 **SPIR-V는 IR(Intermediate Representation)** 이고,
실제 하드웨어 ISA로 내리는 최종 결정은 **벤더 드라이버 백엔드**가 한다는 점이다.

## 뭐가 잘못된 이해였나

- 오해: "SPIR-V 하나면 어느 GPU에서나 같은 기계코드가 실행된다"
- 실제: 같은 SPIR-V라도 AMD, NVIDIA, Intel 드라이버가 각자 다른 최적화/코드생성 경로를 거친다

즉 SPIR-V는 "실행 파일"이라기보다,
드라이버가 읽고 하드웨어 맞춤 코드를 생성하기 위한 **공통 입력 형식**에 가깝다.

## 왜 중요한가

이걸 헷갈리면 성능 분석에서 자주 삐끗한다.

- 커널 소스/IR가 같아도 디바이스별 성능이 달라지는 이유를 놓치기 쉽다
- "IR이 같으니 결과도 같다"고 단정하면 병목 원인을 잘못 찾게 된다
- 벤더별 프로파일링이 필요한 이유를 과소평가하게 된다

## 실무에서의 체크포인트

1. 기능 호환성과 성능 이식성은 별개로 본다
2. SPIR-V 수준 검증 후에도 벤더별 프로파일링을 반드시 한다
3. 최적화 판단은 "커널 소스"보다 "드라이버가 만든 최종 실행 결과" 기준으로 한다

---

## 관련 글

- [OpenCL Wrong Note: in-order queue면 커널 overlap이 자동으로 된다고 오해한 문제]({{< relref "2026-05-05-opencl-wrong-note-in-order-queue-overlap" >}})
- [OpenCL Wrong Note: clFinish는 디바이스 전체 idle이라고 오해한 문제]({{< relref "2026-04-28-opencl-wrong-note-clfinish-device-idle" >}})

## 관련 용어

- [[SPIR-V]], [[clspv]], [[command-queue]]
