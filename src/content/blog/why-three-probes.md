---
title: '프로브가 세 개인 이유'
description: 'startup·readiness·liveness 는 같은 경로를 볼 수도 있지만, 실패했을 때 하는 일이 전혀 다르다. 워밍업 게이트가 CrashLoop 으로 바뀌는 지점.'
pubDate: 'Sep 04 2026'
---

startup · readiness · liveness 는 같은 경로를 볼 수도 있지만, 실패했을 때 하는 일이 전혀 다르다. "워밍업이 끝날 때까지 트래픽을 막자"는 한 줄짜리 요구가 CrashLoop 으로 바뀌는 지점도 거기다.

배포 워밍업과 readiness 게이트를 붙이면서 얻은 것. 수치는 EKS 에 올라가는 Next.js 앱 하나의 dev · qa · prd 실측(2026-08-26 ~ 09-03).

## 세 프로브는 서로 다른 질문을 한다

세 프로브를 가르는 것은 무엇을 묻는가가 아니라 실패가 무엇을 일으키는가다.

| probe | 질문 | 언제 도나 | 실패하면 |
| --- | --- | --- | --- |
| `startupProbe` | 다 켜졌나 | 기동이 끝날 때까지. 성공하면 은퇴 | 컨테이너 재시작 |
| `readinessProbe` | 지금 트래픽을 받을 수 있나 | 컨테이너 생애 내내 | 엔드포인트에서 제외 (프로세스는 산다) |
| `livenessProbe` | 살아 있나 | 생애 내내 | 컨테이너 재시작 |

`startupProbe` 가 존재하는 이유는 느린 기동을 liveness 가 죽이지 못하게 하려고다. startup 이 성공하기 전까지 readiness · liveness 는 실행되지 않는다. 꺼진 게 아니라 결과가 반영되지 않는 비활성 상태다.

> ⚠️ 세 프로브가 전부 같은 무조건 200 라우트를 보고 있으면, 프로브는 셋인데 신호는 하나다. "프로세스가 떠 있다" 말고는 아무것도 못 묻는다.

## failureThreshold 는 시도 상한이 아니다

`failureThreshold: 3` 은 연속 실패 횟수다. 3번 물어보고 그만두는 게 아니다.

| probe | 3회 연속 실패 전 | 3회 채우면 | 그 뒤 |
| --- | --- | --- | --- |
| startup · liveness | 아무 일도 없음 | 컨테이너 재시작 | 컨테이너가 사라지니 결과적으로 시도 종료 |
| readiness | 계속 트래픽을 받는다 | Unready → EndpointSlice 에서 IP 제거 · LB 타깃 해제 | 계속 폴링한다. `successThreshold: 1` 이라 1회 성공에 즉시 복귀 |

즉 readiness 는 빼는 조건과 넣는 조건이 비대칭이다. 뺄 땐 3회 연속(순간 흔들림 흡수), 넣을 땐 1회. 카운터는 성공하면 리셋되므로 실패–성공–실패가 반복되면 threshold 에 영영 닿지 않는다.

문서 원문: "Readiness probes run on the container during its whole lifecycle."

## 게이트를 45초 붙잡아 두고 확인한 것

readiness 라우트가 워밍업 전에는 503 을 내도록 하고, dev 에서 그 상태를 인위적으로 45초 유지했다.

- 라우트 카운터가 13까지 올라갔다. 4·5·8번째가 503 이었는데도 kubelet 은 계속 물었다
- 워밍업 완료 2초 뒤 200 을 받아 즉시 복귀
- 호출 간격은 정확히 5초 = 그 환경의 `periodSeconds: 5`
- ContainersReady 가 20초 → 65초로 밀렸을 뿐, 재시작은 없었다

기동 중인 파드에는 `failureThreshold` 가 사실상 무의미하다. 애초에 엔드포인트에 들어간 적이 없으니 "제외"할 것이 없다. 관용이 실제로 작동하는 대상은 이미 서빙 중이던 파드뿐이다. 운영 39시간 동안 readiness 실패 15건이 전부 단발이라 한 번도 트래픽에서 빠지지 않았다.

이 사실이 설계를 바꿨다. "준비 게이트에 시간 상한이 없으면 파드가 영영 안 깨어난다"고 걱정했는데, readiness 가 계속 물어보니 깨울 주체가 이미 있었다. 게다가 상한은 곧 "포기하고 차갑게 서빙한다"는 뜻이라 게이트 목적과 어긋난다. 여는 기준은 시간이 아니라 완료 여부여야 하고, 끝내 매달리면 `progressDeadlineSeconds`(기본 600초)가 롤아웃을 실패로 잡는다.

## 두 initialDelay 는 더해지지 않는다

운영 설정이 startup `initialDelay 30s` + readiness `initialDelay 15s` 였다. "그럼 트래픽은 45초 뒤"라고 계산했는데 틀렸다. 실측은 39초.

모든 `initialDelay` 는 **컨테이너 시작 시각** 기준으로 동시에 흐른다. startup 이 도는 동안 readiness 가 대기하는 게 아니라, 재고 있던 결과가 반영되지 않을 뿐이다.

```
첫 readiness 판정 시점 = max(readiness.initialDelaySeconds, startupProbe 성공 시점)

// 운영: startup 30초가 readiness 15초를 삼킨다
→ readiness 의 initialDelay 는 사실상 무의미
```

> ⛔ 더하기로 계산한 수치를 근거로 쓰지 말 것. 프로브 타이밍은 계산이 아니라 `ContainersReady` · `Ready` 전환 시각 실측으로 확인한다.

## ContainersReady 와 Ready 사이에 로드밸런서가 있다

파드가 트래픽을 받기 시작하는 시점은 readiness 통과 시점이 아니다.

- `ContainersReady` = readinessProbe 통과
- `Ready` = `ContainersReady` AND readinessGates. 여기서는 ALB 타깃 그룹 등록 완료

| 환경 | startup delay | readiness delay/period | ContainersReady | Ready | replicas |
| --- | --- | --- | --- | --- | --- |
| dev · qa | 15s | 15s / 5s | 20초 | 43초 | 2 |
| prd | 30s | 15s / 10s | 39초 | 66초 | 20 |

둘 사이의 27초(dev 23초)가 전부 LB 등록 대기다. 롤아웃이 파드당 1분씩 걸리는 이유가 여기서 설명된다.

readinessGates 는 배포 매니페스트가 아니라 파드에서 봐야 한다. Rollout 스펙의 `spec.template.spec.readinessGates` 는 비어 있었는데, 실제 파드에는 AWS LB Controller 가 admission webhook 으로 주입한 `target-health.elbv2.k8s.aws/...` 게이트가 붙어 있었다. 매니페스트만 보고 "없다"고 판단하면 틀린다.

> ⚠️ QA 통과가 운영 안전을 보장하지 않는다. 첫 프로브까지의 여유(20 vs 39초)도, 동시에 기동하는 파드 수(2 vs 20)도 다르다.

## 두 프로브가 같은 경로를 보면 게이트는 성립하지 않는다

운영 설정에서 `startupProbe` 와 `readinessProbe` 가 둘 다 `/api/health/readiness` 를 보고 있었다. 이 상태에서 "워밍업 전에는 readiness 가 503" 을 넣으면:

```
// 의도
readiness 503 → 파드 Unready → 트래픽이 안 온다 → 워밍업 완료 후 합류

// 실제
readiness 503 → startupProbe 가 그 503 을 실패로 받는다
             → startup 성공 전이라 readiness 는 실행조차 안 된다
             → 트래픽은 못 늦추고 startup 예산(30·40·50초)만 깎인다
             → 50초에 재시작. 워밍업이 계속 느리면 CrashLoop
```

같은 경로에서는 게이트가 **위험한 게 아니라 아예 기능하지 않는다.** "실패 시 재시작"인 프로브가 "실패 시 트래픽 제외"인 프로브와 같은 신호를 읽으면, 약한 신호가 강한 결과로 승격된다.

필요한 수정은 helm 한 줄이다. `startupProbe.httpGet.path` 를 `/api/health/liveness` 로.

- **인프라 먼저, 앱 나중.** 반대로 하면 첫 배포에서 재시작이 난다
- **프로브 설정은 앱 레포에 없다.** 코드가 인프라 전제 위에 서 있다면 그 전제를 코드 주석에 명시할 것. 코드로는 강제할 수 없다
- **프로브 변경은 롤아웃을 동반한다.** 프로브는 파드 템플릿 필드다. 경로 한 글자만 바꿔도 ReplicaSet 이 갈린다(실측: 재시작 0, 구·신 파드 8분 공존 후 전환 = 무중단)

## 게이트를 앱 코드로 만들 때 걸리는 것들

```ts
// app/api/health/readiness/route.ts
import { isWarmupPending } from "@/lib/warmup-state";

// 캐시된 응답이 나가면 게이트가 에러 없이 무력화된다
export const dynamic = "force-dynamic";

// kubelet 이 10초마다 때리는 경로라 본문은 모듈 로드 때 한 번만 만든다
const OK_BODY = JSON.stringify({ status: "ok" });
const WARMING_BODY = JSON.stringify({ status: "warming" });

export function GET() {
  return isWarmupPending()
    ? new Response(WARMING_BODY, { status: 503 })
    : new Response(OK_BODY);
}
```

남는 건 전부 "조용히 깨지는" 쪽이다.

| 함정 | 왜 깨지나 | 대응 |
| --- | --- | --- |
| 상태를 모듈 스코프 변수에 둠 | 기동 훅과 라우트 핸들러는 같은 프로세스지만 번들이 갈리면 모듈 인스턴스가 다르다. 워밍업이 끝나도 라우트 쪽 플래그가 안 바뀌어 게이트만 남는다 | 상태를 `globalThis` 에 |
| 헬스 라우트가 무거운 모듈을 import | 모듈 로드가 실패하면 라우트가 500, 그건 곧 프로브 실패 | 상태 파일은 의존성 0으로 분리 |
| 프로브 응답이 캐시됨 | 캐시된 200 이 나가면 아무 에러 없이 게이트가 사라진다 | `force-dynamic` 명시 |
| 상태를 모를 때 막음 | 워밍업이 시작조차 안 한 경우(로컬 · 킬 스위치 · 로드 실패) 막을 근거가 없다 | 모르면 통과(fail-open) |
| 벽시계로 경과 판정 | NTP 보정으로 시계가 뒤로 가면 경과가 줄어 게이트가 영영 닫힌다 | 시간 기준을 없애거나 단조 시계 |

> ⚠️ `timeoutSeconds` 기본값은 1초(세 프로브 공통). 워밍업 중에는 단일 스레드가 모듈 로드·JIT 로 묶여 있어서, `initialDelay` 를 앞당기면 프로브가 그 1초를 넘길 수 있다. 프로브를 당기는 건 공짜가 아니다.

반대로 게이트를 두지 않으면 워밍업은 fire-and-forget 이라 startupProbe 통과 시점을 늦추지 않는다. 운영 배포 실측: 20개 파드 전부 워밍업 200, 소요 1.27~1.34초, 컨테이너 재시작 0건. 게이트는 "지금 안 걸린다"가 아니라 "느려졌을 때 차가운 파드가 Ready 로 답하지 않게" 하려고 둔다.

## 프로브는 관측할 수 있다 — 앱이 응답하는 라우트니까

프로브 경로에 로그 한 줄을 심으면 kubelet 의 호출 시각과 간격이 그대로 보인다. 위의 "13회 호출, 5초 간격"도 그렇게 얻었다. 다만 정상 상태에서는 워밍업이 프로브보다 훨씬 빨라 게이트가 닫힌 장면 자체가 안 잡히므로, 앱 쪽에 인위적 지연을 넣어 창을 벌려야 한다.

지표로 셀 때 두 번 틀렸다.

- **환경 필터를 빼면 다른 환경이 섞인다.** 재시작 건수를 `kube_deployment` 로만 걸러 "운영 3~5건"이라고 적었는데, `env:prd` 를 넣으니 14일간 0건이었다. 섞여 있던 건 dev · qa
- **로그 부재를 근거로 쓰지 말 것.** 같은 이미지인데 워밍업 로그가 있는 파드와 없는 파드가 섞여 있었다(수집 유실). "로그가 없으니 안 일어났다"가 뒤집혀 재시작 메트릭 시계열로 다시 세야 했다
- **dev · qa 의 파드 교체는 신호가 아니다.** 28시간 동안 dev 는 노드 16개, qa 는 9개를 거쳤다. 상시 교체라 배경 소음이 신호보다 크다. 판별은 파드 1개로 며칠씩 그대로인 stage 로

## 프로브를 건드리기 전에 훑는 목록

- 이 프로브가 실패하면 재시작인가 트래픽 제외인가, 먼저 답할 수 있나
- `startupProbe` 와 `readinessProbe` 가 다른 경로를 보나
- 세 프로브가 같은 무조건 200 을 읽고 있진 않나 (프로브 셋, 신호 하나)
- `initialDelay` 를 더해서 계산하지 않았나. ContainersReady · Ready 실측으로 확인했나
- 트래픽 시작 시점을 ContainersReady 가 아니라 LB 등록까지 끝난 Ready 로 보고 있나
- 게이트 상태가 번들 경계를 넘나(`globalThis`), 프로브 라우트가 캐시되지 않나
- 상태를 모를 때 통과시키나
- 인프라 전제(프로브 경로)를 코드에 적어 뒀고, 반영 순서를 정했나
- QA 여유(파드 2개)로 운영(파드 20개)을 판단하고 있지 않나

프로브 이름은 셋 다 "괜찮은지 묻는 것"처럼 들리지만, 실제로 다른 건 답이 아니라 틀렸을 때 벌어지는 일이다.
