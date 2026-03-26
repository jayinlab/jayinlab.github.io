---
title: "bat 입문 가이드 - cat보다 읽기 좋은 파일 출력"
date: 2026-03-04
slug: "bat-beginner-guide"
draft: false
---
`bat`은 `cat`을 더 보기 좋게 만든 도구다. 코드 하이라이팅과 줄 번호가 기본 제공된다.

## 언제 쓰면 좋은가
- 설정 파일/코드를 빠르게 읽을 때
- 로그나 긴 텍스트를 눈으로 확인할 때

## 자주 쓰는 예시
```bash
# 파일 보기 (Ubuntu에선 batcat일 수 있음)
batcat ~/.bashrc

# 줄 번호와 함께 출력
batcat -n README.md
```

## 초심자 팁
- Ubuntu에서는 `bat` 대신 `batcat` 명령어를 먼저 확인하라.
- 출력이 길면 `less`보다 bat의 하이라이팅이 이해에 도움이 된다.
- 편집 전, 파일을 bat으로 먼저 훑어보는 습관을 들이면 실수가 줄어든다.
