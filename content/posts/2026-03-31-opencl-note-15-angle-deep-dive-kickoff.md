---
title: "OpenCL Note #15 — 심화 시작: ANGLE 함수 체인 추적 킥오프"
date: 2026-03-31
slug: "opencl-note-15-angle-deep-dive-kickoff"
draft: false
---

좋아, 여기서부터는 심화 라운드다.
이번 노트는 실제 코드 추적을 시작하기 위한 **첫 킥오프 노트**다.

(고정 목표: ANGLE OpenCL entry → clspv/SPIR-V → Vulkan dispatch → AMD PM4 mental model)

## 이번 단계의 핵심 산출물

- ANGLE OpenCL 경로에서
  - compile chain 후보
  - submit chain 후보
를 파일/함수 단위로 1차 수집한 로그.

## 서버에서 바로 실행하는 스크립트

아래 스크립트를 추가해두었다.

```bash
bash ~/opencl_study/scripts/15_trace_angle_candidates.sh /path/to/angle
```

ANGLE를 아직 안 받았다면:

```bash
git clone https://github.com/google/angle.git ~/opencl_study/angle
bash ~/opencl_study/scripts/15_trace_angle_candidates.sh
```

실행 결과 로그는 `~/opencl_study/logs/*-angle-trace-candidates.log`에 저장된다.

## 이 스크립트가 해주는 일

1. OpenCL entry API 후보 검색
2. SPIR-V/shader module 후보 검색
3. descriptor/pipeline layout 후보 검색
4. dispatch 관련 Vulkan 호출 후보 검색

즉, "어디부터 수동 추적할지" 시작 지점을 자동으로 모아준다.

## 다음 노트 예고

Note #16에서는 이 로그를 바탕으로
- 실제 함수 체인을 compile vs submit으로 분리한 표를 만들고,
- 근거 라인까지 붙인다.

## 이해 확인 질문

### Q1. 이번 노트의 목표는 완전 해석인가, 시작 지점 수집인가?
<details>
  <summary>정답 보기</summary>
  시작 지점 수집이다. 정확한 수동 추적을 위한 입력 데이터 확보가 목표.
</details>

### Q2. 왜 자동 grep/rg 로그가 심화 초반에 유용한가?
<details>
  <summary>정답 보기</summary>
  함수 탐색 비용을 줄이고, compile 체인/submit 체인 분리 작업을 빠르게 시작할 수 있기 때문.
</details>
