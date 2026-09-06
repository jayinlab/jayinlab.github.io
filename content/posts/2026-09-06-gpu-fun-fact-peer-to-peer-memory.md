---
title: "GPU끼리는 왜 CPU를 거치지 않고 이야기할까"
date: 2026-09-06
slug: "gpu-fun-fact-peer-to-peer-memory"
draft: false
type: "note"
series: "gpu-fun-facts"
tags: ["gpu", "amd", "rocm", "hip", "peer-to-peer", "multi-gpu"]
difficulty: "beginner"
---

옆집에 책을 빌려주는데 매번 멀리 있는 중앙 우체국에 맡겼다가 다시 배달받는다면 꽤 답답할 것이다. 여러 GPU가 한 컴퓨터에 있을 때도 비슷하다. GPU A의 결과를 GPU B로 옮기려고 먼저 host memory에 복사하고, 거기서 다시 B로 복사하는 길은 CPU 쪽을 중간 창고처럼 쓴다.

**peer-to-peer(P2P) memory access**는 조건이 맞는 GPU끼리 이 우회로를 줄이는 기능이다. 여기서 두 집은 GPU, 책장은 각 GPU의 device memory, 길은 PCIe 같은 interconnect다. AMD HIP에서는 먼저 `hipDeviceCanAccessPeer()`로 접근 가능 여부를 묻고, `hipDeviceEnablePeerAccess()`로 허용한다. 성공하면 peer GPU의 현재와 이후 memory allocation이 현재 GPU의 address space에 mapping되어, 한 GPU가 다른 GPU memory를 직접 읽거나 쓸 수 있다.

왜 흥미로울까? 여러 GPU가 simulation 영역이나 AI tensor를 자주 주고받을 때 host staging을 피하면 복사 단계와 이동 시간을 줄일 여지가 생긴다. 실제로 HIP 문서는 P2P를 켜지 않은 `hipMemcpy()`도 동작하지만 내부적으로 host memory의 staging buffer를 사용해 성능 비용이 생길 수 있다고 설명한다.

다만 이것은 GPU 두 장만 꽂으면 생기는 비밀 통로가 아니다. `CanAccessPeer`라는 확인 절차가 따로 있듯 device 조합과 system topology가 지원해야 한다. 또한 “직접”은 CPU가 데이터 운반 창고가 되지 않는다는 뜻이지, 거리가 사라지거나 상대 GPU memory가 자기 local memory만큼 빨라진다는 뜻은 아니다. 실제 bandwidth와 latency는 연결 구조와 경쟁 traffic에 달려 있다.

Source note: [AMD ROCm HIP multi-device 문서의 Peer-to-peer memory access 절](https://rocm.docs.amd.com/projects/HIP/en/latest/how-to/hip_runtime_api/multi_device.html#peer-to-peer-memory-access)은 GPU가 host를 거치지 않고 다른 GPU memory를 직접 읽고 쓸 수 있으며, P2P가 비활성화된 복사는 host staging buffer를 사용할 수 있다고 설명한다. [HIP P2P API reference](https://rocm.docs.amd.com/projects/HIP/en/latest/reference/hip_runtime_api/modules/peer_to_peer_device_memory_access.html)는 `hipDeviceCanAccessPeer()`의 capability 확인과, 성공한 `hipDeviceEnablePeerAccess()`가 peer의 현재·향후 allocation을 현재 device address space에 mapping한다는 계약을 명시한다.
