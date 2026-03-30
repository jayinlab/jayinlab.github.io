---
title: "OpenCL Note #00 — 실습 키트 운용법 (노트 번호 연동)"
date: 2026-03-30
slug: "opencl-note-00-study-kit-guide"
draft: false
---

이 노트는 `~/opencl_study` 실습 키트를 어떻게 쓰는지 정리한다.

## 목적
- 노트를 읽고 끝내지 않고,
- 번호가 맞는 스크립트를 실행하면서 개념을 확인하기 위함.

## 폴더
- `~/opencl_study/src` : OpenCL C 소스
- `~/opencl_study/build` : spv/spvasm 결과
- `~/opencl_study/logs` : 실행 로그
- `~/opencl_study/scripts` : 번호형 스크립트

## 기본 실행
```bash
cd ~/opencl_study
bash scripts/00_help.sh
bash scripts/01_run_vector_add.sh
bash scripts/02_compare_with_last.sh
```

## 노트-스크립트 번호 매핑
- Note #01 ~ #14 ↔ `scripts/01_*.sh` ~ `scripts/14_*.sh`
- 실습이 없는 노트는 해당 스크립트가 핵심 요약을 출력한다.

## 이해 확인 질문
### Q1. 왜 번호 연동이 중요한가?
<details>
  <summary>정답 보기</summary>
  읽기-실행-비교 루프를 고정해서 이해를 재현 가능하게 만들기 위해.
</details>
