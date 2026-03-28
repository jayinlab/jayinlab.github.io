---
title: "OpenCL Note #4 — clspv 실전: OpenCL C 하나를 SPIR-V로 읽어보기"
date: 2026-03-28
slug: "opencl-note-4-clspv-practice"
draft: false
---

이번 노트는 네가 요청한 방식 그대로:

> "이 OpenCL C 코드가 clspv를 거치면 어떤 SPIR-V 관찰 포인트가 나오는지"

를 직접 따라할 수 있게 정리한다.

---

## 1) 예제 OpenCL C

아래 커널을 사용한다 (`content/opencl/examples/vector_add.cl`).

```c
__kernel void vector_add(__global const float* a,
                         __global const float* b,
                         __global float* out,
                         const int n)
{
    int gid = get_global_id(0);
    if (gid < n)
    {
        out[gid] = a[gid] + b[gid];
    }
}
```

핵심 포인트는 단순하다.
- 버퍼 3개(`a`, `b`, `out`)
- 스칼라 인자 1개(`n`)
- `get_global_id(0)` 기반 분기

---

## 2) clspv로 SPIR-V 생성

환경에 따라 명령은 다를 수 있지만, 기본 흐름은 아래와 같다.

```bash
# 1) OpenCL C -> SPIR-V
clspv content/opencl/examples/vector_add.cl -o vector_add.spv

# 2) SPIR-V disassemble (텍스트로 보기)
spirv-dis vector_add.spv -o vector_add.spvasm
```

> `clspv`, `spirv-dis`가 없다면 설치 후 동일하게 진행하면 된다.

---

## 3) disassembly에서 어디를 볼까 (실전 체크리스트)

`vector_add.spvasm`에서 아래를 우선 찾는다.

1. `OpEntryPoint`  
   - 커널 엔트리 이름 확인

2. `OpExecutionMode`  
   - 실행 모드(로컬 사이즈 관련 단서) 확인

3. `OpDecorate`  
   - descriptor/binding/set 정보 확인

4. `OpVariable` (Storage Class 포함)  
   - 인자들이 어떤 리소스 클래스로 내려갔는지 확인

5. `OpLoad` / `OpFAdd` / `OpStore`  
   - 실제 `out[gid] = a[gid] + b[gid]` 대응 구간 확인

---

## 4) 대응표를 이렇게 만든다 (중요)

아래 형태로 네 노트에 직접 표를 채워라.

- OpenCL `a` (`__global const float*`) → SPIR-V: [네가 찾은 변수/데코레이트]
- OpenCL `b` (`__global const float*`) → SPIR-V: [ ]
- OpenCL `out` (`__global float*`) → SPIR-V: [ ]
- OpenCL `n` (`int`) → SPIR-V: [ ]
- OpenCL `get_global_id(0)` → SPIR-V: [builtin 관련 선언/사용]

이 대응표를 2~3개 커널로 반복하면,
다음 단계(Vulkan descriptor set / pipeline layout)가 급격히 쉬워진다.

---

## 5) 왜 이게 ANGLE 학습에 직접 도움이 되나

우리가 목표로 하는 건
**ANGLE(OpenCL entry) → clspv(SPIR-V) → Vulkan dispatch → AMD PM4 mental model**이다.

여기서 clspv 산출물을 읽을 수 있으면,
- "ANGLE가 어떤 커널 리소스 모델을 Vulkan으로 바인딩했는지"
- "descriptor set/layout이 왜 그렇게 생겼는지"
를 코드와 연결해 이해할 수 있다.

즉, 이 노트는 단순 툴 사용법이 아니라
**ANGLE 내부 경로 이해를 위한 필수 디딤돌**이다.

---

## 이해 확인 질문 (Self-check)

1. `vector_add` 예제에서 SPIR-V에서 가장 먼저 찾을 3개 키워드는?
2. `OpDecorate`를 보는 이유는?
3. 대응표를 만드는 목적은?
4. 이 실습이 ANGLE 코드 추적에서 어떤 구간을 쉽게 만드나?
5. 다음 실습 커널을 고른다면 어떤 특징(예: local memory, barrier)을 넣고 싶나?

## 복습 카드 (Anki 스타일)

- Q: clspv 실습에서 첫 출력 파일 2개는?  
  A: `*.spv`(binary), `*.spvasm`(disassembly text).

- Q: `OpEntryPoint`는 왜 중요한가?  
  A: 어떤 함수가 커널 시작점인지 알려준다.

- Q: `OpDecorate`는 무엇의 단서인가?  
  A: binding/set/layout 등 리소스 바인딩 정보.

- Q: 대응표를 왜 만들까?  
  A: OpenCL 인자와 SPIR-V 리소스 표현의 매핑을 명확히 하기 위해.
