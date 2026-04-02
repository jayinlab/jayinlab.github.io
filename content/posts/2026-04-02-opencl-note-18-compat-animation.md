---
title: "OpenCL Note #18 — 애니메이션 실험 #1 (JS v2): Pipeline-Descriptor 호환/비호환"
date: 2026-04-02
slug: "opencl-note-18-compat-animation"
draft: false
---

이번 버전은 JS 표준형 v2다.

- 요소 누락 버그 수정
- Step 버튼(계약확인 → bind시도 → 결과)
- 더 자세한 시각 요소(슬롯/타입/메시지)

<div id="compat-v2" style="border:1px solid #2a3142;border-radius:12px;padding:12px;background:#0f1624;">
  <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;">
    <button data-step="1">Step 1: 계약확인</button>
    <button data-step="2">Step 2: Bind 시도</button>
    <button data-step="3">Step 3: 결과확인</button>
    <button data-case="good">Case: Set X (호환)</button>
    <button data-case="bad">Case: Set Y (비호환)</button>
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
    <div style="border:1px solid #31415f;border-radius:10px;padding:10px;">
      <div style="color:#cfe0ff;font-weight:600;margin-bottom:6px;">Pipeline Layout Contract</div>
      <div style="font-size:13px;color:#a9b7d3;line-height:1.5;">
        set0:<br>
        - b0: storage buffer<br>
        - b1: storage buffer<br>
        - b2: storage buffer<br>
        push constant: int(4 bytes)
      </div>
    </div>

    <div style="border:1px solid #31415f;border-radius:10px;padding:10px;">
      <div style="color:#cfe0ff;font-weight:600;margin-bottom:6px;">Descriptor Set (Current)</div>
      <div id="set-desc" style="font-size:13px;color:#a9b7d3;line-height:1.5;"></div>
    </div>
  </div>

  <div style="margin-top:12px;border:1px solid #31415f;border-radius:10px;padding:10px;">
    <div style="color:#cfe0ff;font-weight:600;margin-bottom:6px;">Binding Slots</div>
    <div style="display:flex;gap:10px;flex-wrap:wrap;">
      <div id="slot-b0" style="padding:8px 10px;border-radius:8px;background:#1b2438;color:#d5e0ff;">b0</div>
      <div id="slot-b1" style="padding:8px 10px;border-radius:8px;background:#1b2438;color:#d5e0ff;">b1</div>
      <div id="slot-b2" style="padding:8px 10px;border-radius:8px;background:#1b2438;color:#d5e0ff;">b2</div>
    </div>
  </div>

  <div id="compat-status-v2" style="margin-top:12px;font-size:14px;color:#cfe0ff;">대기 중</div>
</div>

<script>
(() => {
  const root = document.getElementById('compat-v2');
  if (!root) return;

  const desc = root.querySelector('#set-desc');
  const status = root.querySelector('#compat-status-v2');
  const slots = {
    b0: root.querySelector('#slot-b0'),
    b1: root.querySelector('#slot-b1'),
    b2: root.querySelector('#slot-b2')
  };

  const cases = {
    good: { name: 'Set X', b0: 'storage', b1: 'storage', b2: 'storage' },
    bad:  { name: 'Set Y', b0: 'uniform', b1: 'storage', b2: 'storage' }
  };

  let current = 'good';

  function renderSet() {
    const c = cases[current];
    desc.innerHTML = `${c.name}<br>- b0: ${c.b0}<br>- b1: ${c.b1}<br>- b2: ${c.b2}`;
  }

  function resetSlots() {
    Object.values(slots).forEach(el => {
      el.style.background = '#1b2438';
      el.style.outline = 'none';
    });
  }

  function step1() {
    resetSlots();
    status.textContent = 'Step1: 계약 확인 중... (set0는 b0/b1/b2 모두 storage 필요)';
    status.style.color = '#9fc2ff';
  }

  function step2() {
    resetSlots();
    const c = cases[current];
    ['b0','b1','b2'].forEach(k => {
      if (c[k] === 'storage') {
        slots[k].style.background = '#1f7a5a';
      } else {
        slots[k].style.background = '#7a2a2a';
      }
    });
    status.textContent = 'Step2: Bind 시도 중...';
    status.style.color = '#9fc2ff';
  }

  function step3() {
    const c = cases[current];
    const ok = c.b0 === 'storage' && c.b1 === 'storage' && c.b2 === 'storage';
    status.textContent = ok
      ? 'Step3 결과: compatible (bind 가능)'
      : 'Step3 결과: incompatible (b0 타입 불일치)';
    status.style.color = ok ? '#7ee0c6' : '#ff9f9f';
  }

  root.querySelectorAll('button[data-step]').forEach(btn => {
    btn.addEventListener('click', () => {
      const s = btn.getAttribute('data-step');
      if (s === '1') step1();
      else if (s === '2') step2();
      else step3();
    });
  });

  root.querySelectorAll('button[data-case]').forEach(btn => {
    btn.addEventListener('click', () => {
      current = btn.getAttribute('data-case');
      renderSet();
      step1();
    });
  });

  renderSet();
  step1();
})();
</script>
