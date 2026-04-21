# jayinlab.github.io — 프로젝트 규약

## 1. 블로그 목적 & 독자

- **1차 목적**: OpenCL, Vulkan, PM4, GPU 내부 구조에 대한 개인 학습 기록
- **독자 기준**: 본인 복습 우선이지만, 같은 주제를 어려워하는 외부 독자도 이해할 수 있도록 친절하게 작성
- **기준 질문**: "GPU를 처음 공부하는 사람이 읽어도 흐름이 잡히는가?"

---

## 2. 언어 정책

- **메인 언어**: 한국어
- **용어**: GPU/그래픽스 관련 기술 용어는 영어 원문 유지 (예: work-item, descriptor set, command buffer)
  - 한국어 번역어를 쓰지 않는다 — 혼동을 방지하기 위해
- **코드**: 영어 전용 (주석은 한국어 허용)

---

## 3. 콘텐츠 타입

| 타입 | 위치 | 설명 |
|------|------|------|
| `note` | `content/posts/` | 학습 노트. 개념 설명, 예제, 다이어그램 포함 |
| `wrong-note` | `content/posts/` | 잘못 이해했던 것을 정정하는 노트. 반드시 유지 |
| `bullet-note` | `content/posts/` | 핵심 요점만 bullet로 정리. 복습용 |
| `wiki` | `content/wiki/` | 주제별 누적 정리 문서. 단일 페이지로 계속 갱신 |
| `glossary` | `content/glossary/` | 용어 사전. 용어 하나당 파일 하나 |
| `quiz` | `content/quiz/` | 주제별 퀴즈. localStorage 가중치 기반 랜덤 출제 |

---

## 4. 디렉터리 구조

```
content/
  posts/          ← 개별 학습 노트 (note, wrong-note, bullet-note)
  wiki/           ← 주제별 누적 위키 (angle, compiler, opencl, pm4, vulkan + taxonomy)
  glossary/       ← 용어 사전 (16개 용어 파일 + _index.md)
  quiz/           ← 주제별 퀴즈 (angle, compiler, opencl, pm4, vulkan)
  opencl/         ← OpenCL 개요 및 study plan (고정 페이지)
layouts/
  _default/
    baseof.html   ← 전체 레이아웃 (CSS, Mermaid, wikilink JS 포함)
    single.html
    list.html
    _markup/      ← Hugo render hooks
  glossary/       ← glossary 전용 list.html / single.html
  quiz/           ← quiz 전용 list.html / single.html
  partials/       ← 재사용 partial 컴포넌트
  shortcodes/     ← 커스텀 animation shortcode (8종)
static/
  assets/         ← 정적 파일 (default-icon.png 등)
```

---

## 5. Front Matter 스키마

모든 포스트는 아래 front matter를 사용한다.

```yaml
---
title: ""
date: YYYY-MM-DD
slug: ""          # URL에 쓰이는 식별자. kebab-case
draft: false
type: "note"      # note | wrong-note | bullet-note
series: ""        # 연관 시리즈 이름 (예: "opencl-deep-dive", "pm4-internals")
tags: []          # 주제 태그 (예: ["opencl", "memory", "barrier"])
difficulty: ""    # beginner | intermediate | advanced
animation: true   # animation shortcode가 하나라도 있으면 반드시 추가
---
```

- `type`은 콘텐츠 타입을 나타내며, 목록 페이지 필터링에 사용
- `series`는 연관 글을 묶는 단위
- `difficulty`는 독자 수준 안내용
- `animation: true`는 포스트에 `{{< *_anim >}}` shortcode가 하나라도 있으면 반드시 추가 — 목록 페이지에서 `▶` 배지로 표시됨
- Glossary 파일은 `type: "glossary"`, `term: "정확한 용어명"` 추가

---

## 6. 파일 네이밍 규칙

```
YYYY-MM-DD-{topic}-{subtopic}.md
```

예시:
- `2026-04-13-opencl-memory-model.md`
- `2026-04-13-wrong-note-barrier-scope.md`
- `2026-04-13-bullet-pm4-packet-types.md`

- 넘버링(`note-XX`) 사용 안 함 — series + tags로 추적
- `wrong-note` 파일은 파일명에도 `wrong-note-` prefix 유지
- `bullet-note` 파일은 파일명에도 `bullet-` prefix 유지

---

## 7. Obsidian 통합

### Vault 설정

- **Obsidian vault root**: 이 repo의 루트 (`/`)
- Obsidian이 전체 repo의 `.md` 파일을 인덱싱하도록 설정
- `.obsidian/` 폴더는 `.gitignore`에 추가하지 않음 (팀 공유 불필요하면 추가해도 됨)

### Wikilink 전략

- **작성 시**: `[[term]]` 또는 `[[term|표시 텍스트]]` 형식으로 작성
  - 예: `[[work-item]]`, `[[descriptor-set|Descriptor Set]]`
- **링크 대상**: 주로 `content/glossary/` 의 용어 파일
- **Hugo 렌더링**: JavaScript로 처리 (빌드 후 클라이언트 사이드)
  - `[[term]]` 패턴을 찾아 `/glossary/{slug}/` 링크로 변환
  - 슬러그 변환 규칙: 소문자, 공백→하이픈, 특수문자 제거

### Obsidian 플러그인 권장

- **Dataview**: tags, series, difficulty로 동적 목록 생성
- **Templater**: front matter 자동 삽입 템플릿
- **Graph View**: 용어 간 연결 시각화

---

## 8. Wikilink Hugo 렌더링 구현

`baseof.html` 하단 `<script>` 블록에 아래 로직이 포함되어 있어야 한다.

```javascript
// [[wikilink]] 또는 [[wikilink|display]] → <a href="/glossary/slug/">display</a>
function renderWikilinks() {
  const wikiRE = /\[\[([^\]|]+?)(?:\|([^\]]+?))?\]\]/g;
  // 텍스트 노드만 순회하여 변환
}
```

- 빌드 프로세스 변경 불필요
- Obsidian과 Hugo 양쪽에서 동작

---

## 9. Animation 사용 기준

다음 조건 중 하나라도 해당하면 animation shortcode를 만든다.

| 조건 | 예시 |
|------|------|
| 시간 순서가 있는 흐름 | PM4 packet이 GPU에 제출되는 과정 |
| 계층 구조의 포함 관계 | command buffer 안에 몇 개의 packet |
| 상태 전환이 핵심인 개념 | pipeline state 호환/비호환 |
| 상위/하위 개념의 관계 | command queue → command buffer → PM4 |
| "직접 눈으로 봐야 이해되는" 것 | barrier가 어느 scope까지 유효한지 |

- shortcode 파일명: `layouts/shortcodes/{topic}_{version}.html`
- 버전이 바뀌면 새 파일 생성, 구 파일 유지 (하위 호환)

### 현재 구현된 shortcode 목록 (2026-04-15 기준)

| 파일 | 내용 |
|------|------|
| `compat_anim_v2.html` | Vulkan layout compatibility 상태 전환 |
| `chain_anim_v2.html` | command buffer chain 계층 흐름 |
| `gpu_memory_anim.html` | OpenCL GPU memory 계층 시각화 |
| `occupancy_anim.html` | wavefront occupancy / 레지스터 사용량 |
| `pipeline_barrier_anim.html` | Vulkan pipeline barrier scope |
| `pm4_submit_anim.html` | PM4 command 제출 전체 흐름 |
| `pm4_ib_anim.html` | PM4 indirect buffer 체인 |
| `wavefront_sched_anim.html` | wavefront 스케줄링 / latency hiding |
| `clfinish_anim.html` | clFinish 내부 연쇄 (Fence→IT_EVENT_WRITE→OS→wake) |
| `lifecycle_anim.html` | API 호출 시점 vs GPU 실제 실행 시점 타임라인 |
| `coalescing_anim.html` | coalesced vs non-coalesced vs __local 패턴 |
| `roofline_anim.html` | Roofline 차트 interactive (슬라이더로 커널 위치 확인) |
| `arg_slot_anim.html` | saxpy arg→SPIR-V decoration→Vulkan 슬롯 매핑 |
| `bigpicture_anim.html` | GPU 배송센터 비유 9단계 전개 |
| `pipeline_stages_anim.html` | pipeline stage mask 시각화 (barrier 3 시나리오) |

---

## 10. Mermaid 사용 기준

정적이지만 관계/구조가 복잡할 때 사용한다.

| 다이어그램 타입 | 용도 |
|----------------|------|
| `flowchart` | 함수 호출 흐름, 조건 분기 |
| `sequenceDiagram` | API 호출 순서 (host ↔ driver ↔ GPU) |
| `classDiagram` | 자료구조 관계 (cl_mem, VkBuffer 등) |
| `graph` | 개념 간 의존 관계 |

- Mermaid CDN 버전: mermaid@10, `theme: 'dark'`
- 다이어그램이 복잡해서 animation이 필요하면 animation shortcode로 업그레이드

---

## 11. 코드 표시 규칙

- **짧은 코드 (10줄 이하)**: 포스트 본문에 인라인으로 표시
- **긴 코드 (11줄 이상)**: `<details>` 태그로 접어서 표시

```markdown
<details>
<summary>전체 코드 보기 — vector_add.cl</summary>

```c
// 코드 내용
```

</details>
```

- `summary` 텍스트 형식: `전체 코드 보기 — {파일명 또는 설명}`
- `details`/`summary` 스타일은 `baseof.html`에 이미 정의됨

---

## 12. Glossary 구조

```
content/glossary/
  _index.md           ← 용어 목록 페이지
  work-item.md
  work-group.md
  descriptor-set.md
  command-buffer.md
  ...
```

각 glossary 파일 front matter:
```yaml
---
title: "work-item"
date: YYYY-MM-DD
slug: "work-item"
type: "glossary"
term: "work-item"
tags: ["opencl", "execution"]
related: ["work-group", "NDRange"]
---
```

- 본문 구성: 한 줄 정의 → 상세 설명 → 관련 용어(`related`) → 관련 포스트

---

## 13. 포스트 말미 구조

각 note 포스트 맨 아래에 아래 섹션을 붙인다.

```markdown
---

## 관련 글

- [글 제목]({{< relref "slug" >}})

## 관련 용어

- [[work-item]], [[descriptor-set]]
```

- "관련 용어"는 `[[wikilink]]` 형식으로 나열 → JS가 glossary 링크로 변환

---

## 14. 스킬 & 도구 요약

| 도구/스킬 | 용도 |
|-----------|------|
| Hugo | 정적 사이트 빌드 |
| Mermaid | 정적 구조 다이어그램 |
| JS animation shortcode | 동적 흐름 시각화 (8종 구현 완료) |
| Obsidian + Dataview | 로컬 노트 탐색, 태그 기반 뷰 |
| `[[wikilink]]` + JS | 용어 연결 (Obsidian ↔ Hugo 공용, baseof.html 구현 완료) |
| `<details>` 코드 블록 | 긴 코드 접기 |
| front matter tags/series | 포스트 분류 및 추적 |
| quiz + localStorage | 가중치 기반 랜덤 퀴즈, 틀린 문제 우선 출제 |
| `safeJS` Hugo pipe | JS 코드를 Hugo 이스케이프 없이 템플릿에 삽입 |

---

## 15. 콘텐츠 로드맵

### Phase 1 — 뼈대 ✅ 완료
- [x] Hugo 다크 테마 기본 레이아웃
- [x] Mermaid 지원
- [x] Animation shortcode (compat, chain, 총 8종)
- [x] Wiki 누적 문서 (angle, compiler, opencl, pm4, vulkan + taxonomy)
- [x] Glossary 섹션 생성 (16개 용어: work-item, work-group, NDRange, command-buffer, command-queue, descriptor-set, pipeline-layout, SPIR-V, ANGLE, barrier, clspv, local-memory, pm4-packet, ring-buffer, wavefront 등)
- [x] `[[wikilink]]` JS 렌더링 (baseof.html 구현)
- [ ] Front matter 표준화 (기존 포스트) — 구형 slug 포함 포스트 일부 미완

### Phase 2 — 내용 심화 ✅ 대부분 완료
- [x] OpenCL memory model 시각화 (`gpu_memory_anim.html`, memory-coalescing 노트)
- [x] Vulkan pipeline 전체 흐름 animation (`pipeline_barrier_anim.html`)
- [x] PM4 packet 구조 animation (`pm4_submit_anim.html`, `pm4_ib_anim.html`)
- [x] command queue / command buffer 계층 animation (`chain_anim_v2.html`)
- [x] Barrier scope 시각화 (`pipeline_barrier_anim.html`)
- [x] Wavefront scheduling / latency hiding animation (`wavefront_sched_anim.html`, `occupancy_anim.html`)
- [x] Roofline 모델 노트 (2026-04-15)

### Phase 2b — Quiz 시스템 (신규 추가)
- [x] 주제별 문제 은행 (opencl, vulkan, angle, pm4, compiler — 각 12~13문제)
- [x] localStorage 가중치 기반 랜덤 출제 (틀린 문제 우선)
- [x] 문제 데이터 JSON 분리 (`data/` 디렉토리)
- [x] quiz 전용 레이아웃 (`layouts/quiz/`)

### Phase 3 — 탐색성 강화
- [x] 태그별 포스트 목록 페이지 — Hugo taxonomy 활성화 (`/tags/{tag}/`)
- [x] Series 페이지 — taxonomy로 자동 생성 (`/series/{series-name}/`)
- [ ] Difficulty 기준 필터링 — list.html JS 클라이언트 필터 (미구현)
- [ ] Glossary 전체 목록 페이지 완성도 향상 (_index.md 있음, 레이아웃 존재)
