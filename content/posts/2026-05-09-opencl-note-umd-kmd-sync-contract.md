---
title: "OpenCL 드라이버에서 UMD/KMD 동기화 계약: fence 신호와 cache visibility를 어디서 보장하나"
date: 2026-05-09
slug: "opencl-note-umd-kmd-sync-contract"
draft: false
type: "note"
series: "opencl-driver-internals"
tags: ["opencl", "driver", "umd", "kmd", "synchronization", "pm4", "cache"]
difficulty: "advanced"
animation: false
---

OpenCL에서 `clFinish`/`clWaitForEvents` 같은 API의 의미를 제대로 구현하려면, UMD(User Mode Driver)와 KMD(Kernel Mode Driver) 사이의 **동기화 계약(sync contract)** 을 먼저 명확히 잡아야 한다.  
핵심은 단순히 “GPU 작업 끝났는가?”가 아니라, **끝났다는 사실(fence signal)** 과 **결과가 다른 엔진/CPU에서 관측 가능한 상태(cache visibility)** 가 같은 시점에 만족되는가다.

## 왜 이 주제를 지금 정리하나

최근까지 `event complete == 모든 메모리 가시성 보장`으로 뭉뚱그려 이해하는 경우가 많았고, 실제로는 다음 레이어가 분리되어 있다.

1. 큐 순서 보장(in-order / wait list)
2. fence/interrupt 기반 완료 통지
3. cache flush & invalidate 정책
4. CPU 매핑 메모리의 coherent/non-coherent 경로

즉, API semantic은 하나처럼 보이지만 드라이버 내부는 별도 정책들의 합으로 성립한다.

## UMD와 KMD의 역할 분리

### UMD가 책임지는 것

- OpenCL event DAG를 PM4 제출 단위(IB 체인)로 변환
- wait list를 queue dependency + semaphore/fence wait로 매핑
- 어떤 시점에 cache 관리 packet을 삽입할지 결정(혹은 KMD 정책 호출)
- `clFinish`에서 “해당 command queue 범위” 완료를 추적

### KMD가 책임지는 것

- ring submit 순서 보장 및 scheduler arbitration
- fence sequence 증가/신호, interrupt 전달
- VM/page table, BO residency, migration 동기화
- 엔진 간 sync primitive(export/import syncobj, dma-fence 등) 연결

실전에서 중요한 포인트는: **UMD는 semantic을 설계하고, KMD는 그것을 시간축에서 물리적으로 성립시킨다**.

## fence complete와 memory visible은 왜 분리해서 봐야 하나

fence는 보통 “해당 packet까지 실행됨”을 의미한다. 그러나 이것만으로 다른 소비자가 즉시 최신 데이터를 본다는 보장은 부족할 수 있다.

- L2 writeback 지연
- 엔진별 캐시 도메인 차이(CP/SDMA/graphics/compute)
- CPU 매핑 버퍼가 non-coherent인 경우 invalidate 필요

그래서 드라이버는 흔히 아래 순서를 의도한다.

1. producer kernel/dispatch
2. 필요한 flush/invalidate packet
3. event/fence write
4. interrupt/wakeup

이 순서가 뒤집히면, event는 complete인데 소비자 read가 stale data를 보는 케이스가 생긴다.

## PM4 ordering 관점 체크리스트

드라이버 디버깅 시 최소한 아래를 확인한다.

- event를 쓰는 packet 앞에 필요한 cache op가 들어갔는가?
- queue 간 dependency가 fence wait로 실제 연결되는가?
- SDMA copy 후 compute consume 경로에서 cache domain 전환이 빠지지 않았는가?
- host readback 전에 invalidate 또는 coherent mapping 규칙이 맞는가?

특히 “간헐적 오동작(재현율 낮음)” 버그는 대부분 ordering/visibility 계약 누락에서 나온다.

## what this means for driver dev

- `clFinish`를 단순 “queue empty wait”로 구현하면 부족하다. **visibility contract까지 포함**해야 한다.
- event 상태 전이는 scheduler 신호만 보면 안 되고, **데이터 가시성 확보 시점**을 complete 조건에 포함해야 한다.
- UMD/KMD 인터페이스 문서에 “누가 flush를 책임지는지”를 명시하지 않으면 세대 교체 때 회귀(regression)가 반복된다.
- 성능 최적화는 flush를 줄이는 방향이 맞지만, semantic이 깨지지 않는 최소 안전 경계를 먼저 고정해야 한다.

## app-facing takeaway

앱 개발자 입장에서는 `clFinish`/`clWaitForEvents`를 남발하면 병렬성이 무너진다.  
하지만 필요한 동기화 지점에서는 드라이버가 visibility까지 보장해준다는 가정 위에 코드를 짜게 되므로, 드라이버의 sync contract가 흔들리면 앱은 간헐적 데이터 오류를 만나게 된다.

즉 앱 최적화와 드라이버 안정성은 반대가 아니라, **정확한 동기화 계약 위에서만 함께 성립**한다.

---

## 관련 글

- [clWaitForEvents vs clFinish: 이벤트 체인 대 큐 드레인]({{< relref "2026-05-02-opencl-note-clwaitforevents-vs-clfinish" >}})
- [clFinish는 queue-scope barrier인가, device-idle인가]({{< relref "2026-05-06-opencl-clfinish-queue-scope" >}})
- [PM4 EVENT_WRITE와 cache flush의 분리]({{< relref "2026-04-24-opencl-note-pm4-event-write-vs-cache-flush" >}})

## 관련 용어

- [[command-queue]], [[barrier]], [[pm4-packet]], [[wavefront]]
