---
title: "OpenCL Note #18 — 애니메이션 실험 #1: Pipeline-Descriptor 호환/비호환"
date: 2026-04-02
slug: "opencl-note-18-compat-animation"
draft: false
---

이번 노트는 **같은 개념(호환/비호환)**을 두 가지 방식으로 시각화한다.

- 방식 A: CSS + SVG
- 방식 B: JS (DOM 애니메이션)

---

## A) CSS + SVG

<div style="border:1px solid #2a3142;border-radius:10px;padding:12px;margin:10px 0;">
<svg viewBox="0 0 700 180" width="100%" style="background:#0f1624;border-radius:8px;">
  <text x="20" y="26" fill="#cfe0ff" font-size="14">Pipeline Layout (set0: b0/b1/b2 = storage)</text>
  <rect x="20" y="40" width="280" height="110" fill="#182338" stroke="#3c4a68" rx="8"/>
  <rect x="40" y="70" width="70" height="60" fill="#22314d" stroke="#5d77a8"/>
  <rect x="125" y="70" width="70" height="60" fill="#22314d" stroke="#5d77a8"/>
  <rect x="210" y="70" width="70" height="60" fill="#22314d" stroke="#5d77a8"/>
  <text x="58" y="145" fill="#8ea8d6" font-size="12">b0</text>
  <text x="143" y="145" fill="#8ea8d6" font-size="12">b1</text>
  <text x="228" y="145" fill="#8ea8d6" font-size="12">b2</text>

  <g id="plug-good" class="plug-good">
    <rect x="380" y="78" width="48" height="44" fill="#1f7a5a" rx="6"/>
    <text x="389" y="105" fill="#d9fff2" font-size="12">Set X</text>
  </g>

  <g id="plug-bad" class="plug-bad">
    <rect x="380" y="78" width="48" height="44" fill="#7a2a2a" rx="6"/>
    <text x="389" y="105" fill="#ffdede" font-size="12">Set Y</text>
  </g>

  <text x="500" y="95" fill="#7ee0c6" font-size="13" class="txt-good">compatible</text>
  <text x="485" y="95" fill="#ff9f9f" font-size="13" class="txt-bad">incompatible</text>
</svg>
</div>

<style>
@keyframes moveGood {
  0%,45% { transform: translateX(0px); opacity:1; }
  60%,100% { transform: translateX(-260px); opacity:1; }
}
@keyframes moveBad {
  0%,45% { transform: translateX(0px); opacity:0; }
  50%,100% { transform: translateX(-180px); opacity:1; }
}
@keyframes showGood { 0%,70% {opacity:0;} 75%,100% {opacity:1;} }
@keyframes showBad { 0%,45% {opacity:0;} 50%,100% {opacity:1;} }
.plug-good { animation: moveGood 6s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
.plug-bad { animation: moveBad 6s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
.txt-good { animation: showGood 6s linear infinite; }
.txt-bad { animation: showBad 6s linear infinite; }
</style>

---

## B) JS (DOM 애니메이션)

<div id="compat-js" style="border:1px solid #2a3142;border-radius:10px;padding:12px;position:relative;height:170px;background:#0f1624;overflow:hidden;">
  <div style="color:#cfe0ff;font-size:13px;margin-bottom:10px;">JS loop: Set X(호환) / Set Y(비호환)</div>
  <div style="position:absolute;left:20px;top:56px;width:250px;height:80px;border:1px solid #5d77a8;border-radius:8px;background:#182338;"></div>
  <div id="plug" style="position:absolute;left:360px;top:76px;width:70px;height:42px;border-radius:6px;background:#1f7a5a;color:#fff;font-size:12px;display:flex;align-items:center;justify-content:center;">Set X</div>
  <div id="compat-status" style="position:absolute;left:460px;top:88px;color:#7ee0c6;font-size:13px;">compatible</div>
</div>

<script>
(() => {
  const root = document.getElementById('compat-js');
  if (!root) return;
  const plug = root.querySelector('#plug');
  const status = root.querySelector('#compat-status');
  let t = 0;
  function step(){
    t = (t + 1) % 360;
    const phase = Math.floor(t / 180); // 0 good, 1 bad
    const p = (t % 180) / 180;
    const x = 360 - (phase === 0 ? 220 * p : 160 * p);
    plug.style.left = x + 'px';
    if(phase === 0){
      plug.textContent = 'Set X';
      plug.style.background = '#1f7a5a';
      status.textContent = p > 0.8 ? 'compatible' : 'checking...';
      status.style.color = '#7ee0c6';
    } else {
      plug.textContent = 'Set Y';
      plug.style.background = '#7a2a2a';
      status.textContent = p > 0.8 ? 'incompatible' : 'checking...';
      status.style.color = '#ff9f9f';
    }
    requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
})();
</script>

---

## 확인 포인트

- CSS+SVG가 더 가볍고 안정적인지
- JS 버전이 브라우저에서 더 부드러운지
- 모바일에서 어떤 방식이 더 보기 쉬운지
