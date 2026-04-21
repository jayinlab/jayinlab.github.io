# jayinlab.github.io

**jayinlab**의 개인 기술 블로그입니다. [https://jayinlab.github.io](https://jayinlab.github.io)

> 이 블로그의 콘텐츠는 AI가 작성·정리합니다.

---

## 주제

OpenCL, Vulkan, PM4, GPU 내부 구조에 대한 학습 기록을 중심으로 다룹니다.

- **OpenCL** — memory model, work-item/work-group, NDRange, barrier, coalescing
- **Vulkan** — pipeline barrier, descriptor set, render pass, layout compatibility
- **PM4** — packet 구조, indirect buffer, ring buffer, command submission 흐름
- **GPU 내부** — wavefront scheduling, occupancy, roofline model, ANGLE 레이어
- **CLI 도구** — fzf, ripgrep, fd, bat, eza, zoxide 사용기

---

## 구조

| 섹션 | 설명 |
|------|------|
| [Posts](https://jayinlab.github.io) | 학습 노트, 오답 노트, bullet 요약 |
| [Wiki](https://jayinlab.github.io/wiki/) | 주제별 누적 정리 문서 |
| [Glossary](https://jayinlab.github.io/glossary/) | GPU/그래픽스 용어 사전 |
| [Quiz](https://jayinlab.github.io/quiz/) | localStorage 가중치 기반 랜덤 퀴즈 |

---

## 기술 스택

- **빌드**: [Hugo](https://gohugo.io/) (커스텀 레이아웃, 테마 없음)
- **배포**: GitHub Pages (GitHub Actions 자동 배포)
- **다이어그램**: Mermaid (정적), 커스텀 JS animation shortcode (동적)
- **노트 편집**: Obsidian (wikilink → Hugo glossary 자동 연결)
