---
title: "Windows는 왜 GPU를 2초 만에 의심할까"
date: 2026-07-25
slug: "gpu-fun-fact-windows-tdr"
draft: false
type: "note"
series: "gpu-fun-facts"
tags: ["gpu", "windows", "tdr", "driver", "graphics-history"]
difficulty: "beginner"
---

게임이나 GPU compute 프로그램이 갑자기 멈춘 뒤 화면이 깜빡이고, "display driver stopped responding and has recovered" 같은 메시지를 본 적이 있다면 그 뒤에는 Windows의 TDR이 있다. TDR은 Timeout Detection and Recovery의 줄임말이다. 이름 그대로 GPU가 너무 오래 응답하지 않으면 멈췄다고 보고, 전체 PC를 재부팅하지 않고 graphics stack을 되살리려는 장치다.

이 기능이 필요한 이유는 GPU 일이 CPU 일과 다르게 보이기 때문이다. GPU가 아주 무거운 draw나 dispatch를 처리하는 동안 화면 갱신이 막히면, 사용자는 컴퓨터 전체가 얼어붙었다고 느낀다. 예전식으로는 사용자가 전원 버튼을 누르거나 재부팅할 수밖에 없었다. WDDM의 TDR은 이 상황에서 OS가 먼저 "이건 기다릴 일인가, 복구해야 할 일인가"를 판단하려는 타협이다.

Microsoft 문서에 따르면 Windows의 기본 TDR timeout은 2초다. GPU scheduler가 어떤 작업이 너무 오래 걸린다고 판단하면 먼저 preempt, 즉 중간에 끊어 보려고 한다. 그런데 현재 작업이 2초 안에 끝나지도 않고 preempt도 되지 않으면 OS는 GPU가 frozen 상태라고 진단한다. 이후 display miniport driver에 reset을 알리고, video memory allocation을 비우고, desktop이 다시 응답하도록 graphics stack을 복구한다.

재미있는 점은 이 2초가 "GPU 작업은 항상 2초보다 짧아야 한다"는 성능 규칙이라기보다, desktop을 사람에게 계속 살아 있는 것처럼 보이게 만드는 사용자 경험 규칙에 가깝다는 것이다. Driver 개발자는 긴 작업을 쪼개거나 preemption이 잘 되게 만들어야 하고, application은 device removed 같은 복구 경로를 처리해야 한다. 잘 만든 프로그램은 GPU reset 뒤 resource를 다시 만들 수 있지만, 오래된 app은 검은 화면만 남기기도 한다.

왜 중요할까? TDR을 알면 "GPU가 느렸다"와 "OS가 GPU를 죽였거나 되살렸다"를 구분할 수 있다. 긴 kernel, 과한 shader, driver bug가 모두 비슷한 멈춤처럼 보여도, 실제 문제는 계산량이 아니라 preemption과 recovery 계약일 수 있다.

Source note: Microsoft의 WDDM TDR 문서는 TDR이 GPU operation이 예상보다 오래 걸릴 때 graphics card를 reset해 system 전체 freeze를 막는 기능이라고 설명한다. 같은 문서는 Windows의 기본 TDR timeout이 2초이며, GPU scheduler가 작업을 preempt하려고 시도한 뒤 timeout 안에 완료 또는 preempt되지 않으면 GPU frozen으로 진단한다고 설명한다.
