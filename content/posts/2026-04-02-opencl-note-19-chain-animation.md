---
title: "OpenCL Note #19 — 애니메이션 실험 #2 (JS v2): Compile Chain vs Submit Chain"
date: 2026-04-02
slug: "opencl-note-19-chain-animation"
draft: false
---

이번 버전은 JS 표준형 v2다.

- 체인 2개 모두 안정적으로 표시
- 속도 슬라이더 제공
- 단계별 설명(compile 쪽은 느리고, submit 쪽은 빠름)

<div id="chain-v2" style="border:1px solid #2a3142;border-radius:12px;padding:12px;background:#0f1624;position:relative;min-height:220px;">
  <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:10px;">
    <label style="color:#cfe0ff;font-size:13px;">속도 배율</label>
    <input id="speed" type="range" min="0.5" max="2.5" value="1" step="0.1">
    <span id="speed-val" style="color:#9fb4da;font-size:13px;">1.0x</span>
  </div>

  <div style="position:relative;height:160px;border:1px solid #31415f;border-radius:10px;padding:10px;">
    <div style="position:absolute;left:20px;top:35px;color:#cfe0ff;font-size:13px;">Compile chain (slow path)</div>
    <div style="position:absolute;left:20px;top:95px;color:#cfe0ff;font-size:13px;">Submit chain (fast path)</div>

    <div style="position:absolute;left:20px;top:58px;width:700px;height:2px;background:#4f648f"></div>
    <div style="position:absolute;left:20px;top:118px;width:700px;height:2px;background:#4f648f"></div>

    <div id="dotC" style="position:absolute;left:20px;top:52px;width:12px;height:12px;border-radius:50%;background:#7ee0c6"></div>
    <div id="dotS" style="position:absolute;left:20px;top:112px;width:12px;height:12px;border-radius:50%;background:#8ab4ff"></div>

    <div id="msgC" style="position:absolute;left:740px;top:48px;color:#7ee0c6;font-size:12px;">build/prepare</div>
    <div id="msgS" style="position:absolute;left:740px;top:108px;color:#8ab4ff;font-size:12px;">bind/dispatch</div>
  </div>
</div>

<script>
(() => {
  const root = document.getElementById('chain-v2');
  if (!root) return;
  const dotC = root.querySelector('#dotC');
  const dotS = root.querySelector('#dotS');
  const speed = root.querySelector('#speed');
  const speedVal = root.querySelector('#speed-val');

  let t = 0;
  function loop(){
    t += 1;
    const k = parseFloat(speed.value || '1');
    speedVal.textContent = k.toFixed(1) + 'x';

    // compile path: slower cycle
    const pc = ((t * k) % 520) / 520;
    // submit path: faster cycle
    const ps = ((t * k) % 260) / 260;

    dotC.style.left = (20 + pc * 700) + 'px';
    dotS.style.left = (20 + ps * 700) + 'px';

    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
</script>
