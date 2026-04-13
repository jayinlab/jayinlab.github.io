---
title: "eza 입문 가이드 - ls를 더 보기 좋게"
date: 2026-03-04
slug: "eza-beginner-guide"
draft: false
type: "note"
series: "cli-tools"
tags: ["cli", "tools", "ubuntu"]
difficulty: "beginner"
---

`eza`는 `ls`를 더 읽기 쉽게 만든 도구다. 파일 타입, 권한, 시간 정보를 보기 좋게 정리해 준다.

## 언제 쓰면 좋은가
- 폴더 구조를 빠르게 파악하고 싶을 때
- 숨김 파일 포함 목록을 깔끔하게 보고 싶을 때

## 자주 쓰는 예시
```bash
# 기본 목록
 eza

# 자세한 정보
 eza -l

# 숨김 파일 포함
 eza -la

# 트리 형태로 보기
 eza --tree
```

## 초심자 팁
- 처음엔 `eza -la` 하나만 익혀도 체감이 크다.
- 트리 출력(`--tree`)은 깊은 프로젝트 구조 확인할 때 특히 유용하다.
- alias를 쓰면 편하다: `alias ls='eza'` (원할 때만 적용).
