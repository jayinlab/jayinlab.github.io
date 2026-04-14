---
title: "실습 키트 운용법 — ~/opencl_study 폴더와 읽기-실행-비교 루프"
date: 2026-04-13
slug: "opencl-note-study-kit"
draft: false
type: "note"
series: "opencl-deep-dive"
tags: ["opencl", "tools", "setup"]
difficulty: "beginner"
layer: "CL"
---

이 노트는 시리즈 전체를 따라가는 동안 **옆에 두고 쓰는 실습 기준서**다.  
글을 읽는 것만으로는 이해가 오래 가지 않는다. 번호 연동 스크립트로 직접 실행하고 결과를 비교하는 루프가 핵심이다.

---

## 폴더 구조

```
~/opencl_study/
├── src/          OpenCL C 소스 파일
├── build/        컴파일 산출물 (*.spv, *.spvasm)
├── logs/         실행 로그 및 diff 결과
└── scripts/      번호형 실습 스크립트
```

---

## 핵심 스크립트 3개

| 스크립트 | 역할 |
|---------|------|
| `scripts/01_run_vector_add.sh` | 소스 → SPIR-V 변환 + 핵심 마커 출력 |
| `scripts/02_compare_with_last.sh` | 이전 결과와 diff 비교 |
| `scripts/03_set_example_variant.sh` | 예제 커널 변형 전환 (base/fma/muladd) |

```bash
cd ~/opencl_study
bash scripts/00_help.sh          # 사용법 확인
bash scripts/01_run_vector_add.sh
bash scripts/02_compare_with_last.sh
```

---

## 읽기-실행-비교 루프

```
노트 읽기 → 스크립트 실행 → 결과 관찰 → 이전 결과와 비교
     ↑___________________________________|
```

이 루프를 고정해야 이해가 **재현 가능**해진다.  
한 번 이해한 것처럼 느껴져도, 직접 실행하지 않으면 다음 날 흐릿해진다.

---

## 이해 확인 질문

### Q1. 왜 번호 연동 스크립트 방식을 쓰나?

<details>
<summary>정답 보기</summary>

노트 번호와 스크립트 번호가 일치하면, 특정 개념을 의심할 때 **즉시 그 스크립트를 실행**해볼 수 있다.  
읽기-실행-비교 루프를 고정해서 이해를 재현 가능하게 만들기 위함이다.

</details>

### Q2. `build/` 폴더에 들어가는 파일 형식은?

<details>
<summary>정답 보기</summary>

`*.spv` (SPIR-V binary)와 `*.spvasm` (disassembly 텍스트)가 들어간다.  
spirv-dis로 binary를 텍스트로 변환한 결과를 저장해두면 다음 노트에서 비교하기 편하다.

</details>

---

## 관련 글

- [객체 라이프사이클](/opencl-note-lifecycle/) — 첫 실행 전 개념 흐름
- [clspv 실전](/opencl-note-clspv-practice/) — 실제 SPIR-V 생성 실습

## 관련 용어

[[command-queue]], [[SPIR-V]], [[clspv]]
