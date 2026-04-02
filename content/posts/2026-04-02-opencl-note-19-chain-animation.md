---
title: "OpenCL Note #19 — 애니메이션 실험 #2: Compile Chain vs Submit Chain"
date: 2026-04-02
slug: "opencl-note-19-chain-animation"
draft: false
---

이번 노트는 **compile chain과 submit chain 분리**를 애니메이션으로 보여준다.

- 방식 A: CSS + SVG
- 방식 B: JS (DOM 애니메이션)

---

## A) CSS + SVG

<div style="border:1px solid #2a3142;border-radius:10px;padding:12px;margin:10px 0;">
<svg viewBox="0 0 760 200" width="100%" style="background:#0f1624;border-radius:8px;">
  <text x="20" y="28" fill="#cfe0ff" font-size="14">Compile Chain</text>
  <line x1="20" y1="46" x2="720" y2="46" stroke="#4f648f" stroke-width="2"/>
  <circle cx="20" cy="46" r="7" fill="#7ee0c6" class="dot-c"/>

  <text x="20" y="108" fill="#cfe0ff" font-size="14">Submit Chain</text>
  <line x1="20" y1="126" x2="720" y2="126" stroke="#4f648f" stroke-width="2"/>
  <circle cx="20" cy="126" r="7" fill="#8ab4ff" class="dot-s"/>

  <text x="190" y="40" fill="#9fb4da" font-size="12">Build/Transform</text>
  <text x="500" y="40" fill="#9fb4da" font-size="12">Pipeline Prep</text>
  <text x="190" y="120" fill="#9fb4da" font-size="12">Arg Bind</text>
  <text x="500" y="120" fill="#9fb4da" font-size="12">Dispatch</text>
</svg>
</div>

<style>
@keyframes moveC { from { transform: translateX(0px);} to { transform: translateX(700px);} }
@keyframes moveS { from { transform: translateX(0px);} to { transform: translateX(700px);} }
.dot-c { animation: moveC 5s linear infinite; }
.dot-s { animation: moveS 2.5s linear infinite; }
</style>

---

## B) JS (DOM 애니메이션)

<div id="chain-js" style="border:1px solid #2a3142;border-radius:10px;padding:12px;position:relative;height:170px;background:#0f1624;overflow:hidden;">
  <div style="position:absolute;left:20px;top:46px;width:700px;height:2px;background:#4f648f"></div>
  <div style="position:absolute;left:20px;top:106px;width:700px;height:2px;background:#4f648f"></div>
  <div style="position:absolute;left:20px;top:28px;color:#cfe0ff;font-size:13px;">Compile chain (slow)</div>
  <div style="position:absolute;left:20px;top:88px;color:#cfe0ff;font-size:13px;">Submit chain (fast)</div>
  <div id="dotC" style="position:absolute;left:20px;top:40px;width:12px;height:12px;border-radius:50%;background:#7ee0c6"></div>
  <div id="dotS" style="position:absolute;left:20px;top:100px;width:12px;height:12px;border-radius:50%;background:#8ab4ff"></div>
</div>

<script>
(() => {
  const root = document.getElementById('chain-js');
  if (!root) return;
  const c = root.querySelector('#dotC');
  const s = root.querySelector('#dotS');
  let t = 0;
  function tick(){
    t += 1;
    const xc = 20 + (t % 500) / 500 * 700;
    const xs = 20 + (t % 250) / 250 * 700;
    c.style.left = `${xc}px`;
    s.style.left = `${xs}px`;
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();
</script>

---

## 확인 포인트

- 두 점의 속도 차이로 compile vs submit의 특성을 직관적으로 느끼는지
- 이 분리가 디버깅 관점에서 더 잘 떠오르는지
