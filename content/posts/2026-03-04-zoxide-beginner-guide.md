---
title: "zoxide 입문 가이드 - cd를 더 똑똑하게"
date: 2026-03-04
slug: "zoxide-beginner-guide"
draft: false
type: "note"
series: "cli-tools"
tags: ["cli", "tools", "ubuntu"]
difficulty: "beginner"
---

`zoxide`는 자주 가는 폴더를 기억해서, 짧은 키워드만으로 이동하게 해준다.

## 언제 쓰면 좋은가
- 같은 프로젝트 폴더를 하루에 여러 번 오갈 때
- 긴 경로를 매번 `cd`로 치기 귀찮을 때

## 자주 쓰는 예시
```bash
# 보통처럼 디렉터리 이동
z /root/.openclaw/workspace/jayinlab.github.io

# 이후에는 키워드로 점프
z jayinlab
```

## 초심자 팁
- `zoxide`는 사용할수록 학습돼서 점점 더 정확해진다.
- 처음 며칠은 일반 `cd`와 같이 써도 괜찮다.
- 셸 초기화 설정(zsh/bash)에 hook을 넣어야 제대로 동작한다.
