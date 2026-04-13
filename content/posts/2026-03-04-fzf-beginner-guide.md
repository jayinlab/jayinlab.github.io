---
title: "fzf 입문 가이드 - 터미널에서 빠르게 선택하기"
date: 2026-03-04
slug: "fzf-beginner-guide"
draft: false
type: "note"
series: "cli-tools"
tags: ["cli", "tools", "ubuntu"]
difficulty: "beginner"
---
`fzf`는 "목록에서 원하는 항목을 빠르게 고르는" 퍼지 파인더다.

## 언제 쓰면 좋은가
- 파일/폴더 목록이 길어서 손으로 찾기 귀찮을 때
- 명령 히스토리에서 예전 명령을 다시 꺼낼 때

## 자주 쓰는 예시
```bash
# 파일 목록을 fzf로 선택
fdfind . | fzf

# 검색어를 포함한 파일 중 하나 선택
fdfind . | fzf -q config
```

## 초심자 팁
- `fd | fzf` 조합부터 익히면 체감이 바로 온다.
- 방향키보다 검색어 몇 글자 입력하는 습관이 훨씬 빠르다.
- 너무 많은 결과가 나오면 폴더를 먼저 이동한 뒤 실행하라.
