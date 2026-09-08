---
title: "GPU 주소 0x1000은 누구에게나 같은 곳일까"
date: 2026-09-08
slug: "gpu-fun-fact-per-process-gpuvm"
draft: false
type: "note"
series: "gpu-fun-facts"
tags: ["gpu", "amdgpu", "gpuvm", "virtual-memory", "driver"]
difficulty: "beginner"
---

아파트 두 동에 모두 ‘101호’가 있어도 같은 집은 아니다. 동 이름을 함께 알아야 현관문을 찾을 수 있다. GPU가 보는 주소도 비슷하다. 서로 다른 프로그램이 똑같은 숫자의 GPU 가상 주소를 사용하더라도, 각 프로그램의 **주소 공간**이 다르면 실제로 가리키는 메모리는 다를 수 있다.

여기서 프로그램은 아파트 동, GPU 가상 주소는 호수, 실제 VRAM이나 시스템 메모리의 page는 진짜 방이다. Linux AMDGPU 드라이버의 GPUVM은 프로세스별 GPU 가상 주소 공간을 지원한다. 드라이버는 buffer object를 해당 공간의 주소 범위에 map하고, GPU의 메모리 관리 장치는 page table을 따라 실제 page를 찾는다. 그래서 커널에 전달되는 pointer는 단순한 VRAM의 물리적 번지가 아니라, **그 작업이 속한 주소 공간 안에서 해석할 표지판**에 가깝다.

재미있는 결과도 있다. 메모리 객체가 물리적으로 이동하거나 흩어진 page에 놓여도, 적절한 mapping을 유지하면 GPU 프로그램에는 연속된 가상 주소처럼 보일 수 있다. 반대로 주소 숫자만 로그에서 떼어 보면 어느 프로세스의 어느 allocation인지 확정할 수 없다. 주소 공간과 mapping 정보가 함께 필요하다.

다만 아파트 비유가 보안 전체를 설명하지는 않는다. 실제 접근 가능성은 page-table mapping, 드라이버 검증, 권한과 하드웨어 지원에 달려 있다. 가상 주소가 있다는 사실만으로 모든 GPU나 모든 메모리가 같은 방식으로 격리된다고 단정할 수도 없다.

Source note: [Linux kernel AMDGPU Driver Core 문서](https://docs.kernel.org/gpu/amdgpu/driver-core.html)는 GPU의 GMC 블록이 VRAM·system memory 접근을 담당하며 프로세스별 GPU virtual address space를 지원한다고 설명한다. 같은 문서는 GART가 흩어진 system-memory page를 GPU 주소 공간에 선형으로 map할 수 있다고 명시한다.
