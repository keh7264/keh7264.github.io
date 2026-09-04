---
title: '프로브가 세 개인 이유'
description: '워밍업이 끝날 때까지 트래픽을 막으려고 readiness 에 503 을 넣었더니 파드가 50초마다 재시작했다. startupProbe 가 같은 경로를 보고 있었다.'
pubDate: 'Sep 04 2026'
---

워밍업이 끝날 때까지 트래픽을 막고 싶었다. readiness 라우트가 준비 전에는 503 을 내면 될 거라고 생각했다.

넣었더니 파드가 50초마다 재시작했다.

`startupProbe` 와 `readinessProbe` 가 둘 다 `/api/health/readiness` 를 보고 있었다. 내가 심은 503 을 readiness 가 읽기 전에 startup 이 먼저 읽는다.

```
// 의도
readiness 503 → 파드 Unready → 트래픽이 안 온다 → 워밍업 완료 후 합류

// 실제
readiness 503 → startupProbe 가 그 503 을 실패로 받는다
             → startup 성공 전이라 readiness 는 실행조차 안 된다
             → 트래픽은 못 늦추고 startup 예산(30·40·50초)만 깎인다
             → 50초에 재시작. 워밍업이 계속 느리면 CrashLoop
```

같은 경로에서 게이트는 위험한 게 아니라 아예 기능하지 않는다. "실패 시 재시작"인 프로브가 "실패 시 트래픽 제외"인 프로브와 같은 신호를 읽으면, 약한 신호가 강한 결과로 승격된다.

고치는 데 필요했던 건 helm 한 줄이었다. `startupProbe.httpGet.path` 를 `/api/health/liveness` 로.

## 실패했을 때 벌어지는 일이 다르다

이름만 보면 셋 다 "괜찮은지 묻는" 프로브다. 갈리는 건 대답이 아니라 그다음이다.

| probe | 질문 | 언제 도나 | 실패하면 |
| --- | --- | --- | --- |
| `startupProbe` | 다 켜졌나 | 기동이 끝날 때까지. 성공하면 은퇴 | 컨테이너 재시작 |
| `readinessProbe` | 지금 트래픽을 받을 수 있나 | 컨테이너 생애 내내 | 엔드포인트에서 제외 (프로세스는 산다) |
| `livenessProbe` | 살아 있나 | 생애 내내 | 컨테이너 재시작 |

`startupProbe` 가 따로 있는 이유는 느린 기동을 liveness 가 죽이지 못하게 하려고다. startup 이 성공하기 전까지 readiness 와 liveness 는 실행되지 않는다. 꺼진 게 아니라, 돌긴 도는데 결과가 반영되지 않는 상태다.

세 프로브가 전부 무조건 200 을 내는 같은 라우트를 보고 있으면 프로브는 셋인데 신호는 하나다. 그 구성으로는 "프로세스가 떠 있다" 말고 아무것도 못 묻는다.

## failureThreshold 는 시도 상한이 아니다

`failureThreshold: 3` 을 처음엔 "세 번 물어보고 그만둔다"로 읽었다. 연속 실패 횟수라는 뜻이다.

| probe | 3회 연속 실패 전 | 3회 채우면 | 그 뒤 |
| --- | --- | --- | --- |
| startup · liveness | 아무 일도 없음 | 컨테이너 재시작 | 컨테이너가 사라지니 결과적으로 시도 종료 |
| readiness | 계속 트래픽을 받는다 | Unready → EndpointSlice 에서 IP 제거 · LB 타깃 해제 | 계속 폴링한다. `successThreshold: 1` 이라 1회 성공에 즉시 복귀 |

readiness 는 빼는 조건과 넣는 조건이 비대칭이다. 뺄 땐 3회 연속, 넣을 땐 1회. 카운터는 성공하면 리셋되므로 실패–성공–실패가 반복되면 threshold 에 영영 닿지 않는다.

문서에도 그대로 적혀 있다. "Readiness probes run on the container during its whole lifecycle."

## 45초 동안 게이트를 붙잡아 봤다

문서를 믿는 것과 확인하는 건 다르니까, dev 에서 readiness 를 인위적으로 45초 동안 503 으로 잡아뒀다. 알고 싶었던 건 하나였다. 3회 실패하면 kubelet 이 포기하는가.

포기하지 않았다.

- 라우트 카운터가 13까지 올라갔다. 4·5·8번째가 503 이었는데도 계속 물었다
- 호출 간격은 정확히 5초. 그 환경의 `periodSeconds` 그대로다
- 워밍업이 끝나고 2초 뒤 200 을 받자 즉시 복귀했다
- ContainersReady 가 20초에서 65초로 밀렸을 뿐, 재시작은 없었다

기동 중인 파드에는 `failureThreshold` 가 사실상 무의미하다. 애초에 엔드포인트에 들어간 적이 없으니 "제외"할 것이 없다. 관용이 실제로 작동하는 대상은 이미 서빙 중이던 파드뿐이다. 운영 39시간 동안 readiness 실패 15건이 전부 단발이라 한 번도 트래픽에서 빠지지 않았다.

이 결과가 설계를 바꿨다. 원래는 게이트에 시간 상한을 둘 생각이었다. 상한이 없으면 파드가 영영 안 깨어날까 봐. 그런데 readiness 가 5초마다 계속 물어보니 깨울 주체는 이미 있었다. 게다가 상한은 곧 "포기하고 차갑게 서빙한다"는 뜻이라 게이트를 두는 이유와 정면으로 어긋난다. 여는 기준은 시간이 아니라 완료 여부여야 한다. 끝내 안 열리면 `progressDeadlineSeconds`(기본 600초)가 롤아웃을 실패로 잡아준다.

## 두 initialDelay 는 더해지지 않는다

운영 설정이 startup `initialDelay 30s`, readiness `initialDelay 15s` 였다. 트래픽은 45초 뒤겠거니 계산했다. 실측은 39초였다.

모든 `initialDelay` 는 **컨테이너 시작 시각** 기준으로 동시에 흐른다. startup 이 도는 동안 readiness 가 줄 서서 기다리는 게 아니라, 재고 있던 결과가 반영되지 않을 뿐이다.

```
첫 readiness 판정 시점 = max(readiness.initialDelaySeconds, startupProbe 성공 시점)

// 운영: startup 30초가 readiness 15초를 삼킨다
→ readiness 의 initialDelay 는 사실상 무의미
```

더하기로 나온 45초를 근거로 쓸 뻔했다. 프로브 타이밍은 계산이 아니라 `ContainersReady` · `Ready` 전환 시각 실측으로 확인하는 게 맞다.

## 트래픽이 오기 시작하는 건 readiness 통과 시점이 아니다

- `ContainersReady` = readinessProbe 통과
- `Ready` = `ContainersReady` AND readinessGates. 여기서는 ALB 타깃 그룹 등록 완료

| 환경 | startup delay | readiness delay/period | ContainersReady | Ready | replicas |
| --- | --- | --- | --- | --- | --- |
| dev · qa | 15s | 15s / 5s | 20초 | 43초 | 2 |
| prd | 30s | 15s / 10s | 39초 | 66초 | 20 |

둘 사이의 27초(dev 23초)가 전부 LB 등록 대기다. 롤아웃이 파드당 1분씩 걸리던 이유가 여기서 설명됐다.

readinessGates 를 찾을 땐 배포 매니페스트가 아니라 파드를 봐야 한다. Rollout 스펙의 `spec.template.spec.readinessGates` 는 비어 있었는데, 실제 파드에는 AWS LB Controller 가 admission webhook 으로 주입한 `target-health.elbv2.k8s.aws/...` 게이트가 붙어 있었다. 매니페스트만 보고 "없다"고 판단했다면 27초를 영영 설명하지 못했을 것이다.

QA 에서 잘 돌았다고 운영이 안전한 것도 아니다. 첫 프로브까지의 여유(20초 vs 39초)도, 동시에 기동하는 파드 수(2개 vs 20개)도 다르다.

## 게이트를 앱 코드로 만들 때

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

열 줄짜리 라우트인데 걸릴 곳이 꽤 있었다. 공통점은 전부 조용히 깨진다는 것이다.

| 함정 | 왜 깨지나 | 대응 |
| --- | --- | --- |
| 상태를 모듈 스코프 변수에 둠 | 기동 훅과 라우트 핸들러는 같은 프로세스지만 번들이 갈리면 모듈 인스턴스가 다르다. 워밍업이 끝나도 라우트 쪽 플래그가 안 바뀌어 게이트만 남는다 | 상태를 `globalThis` 에 |
| 헬스 라우트가 무거운 모듈을 import | 모듈 로드가 실패하면 라우트가 500, 그건 곧 프로브 실패 | 상태 파일은 의존성 0으로 분리 |
| 프로브 응답이 캐시됨 | 캐시된 200 이 나가면 아무 에러 없이 게이트가 사라진다 | `force-dynamic` 명시 |
| 상태를 모를 때 막음 | 워밍업이 시작조차 안 한 경우(로컬 · 킬 스위치 · 로드 실패) 막을 근거가 없다 | 모르면 통과(fail-open) |
| 벽시계로 경과 판정 | NTP 보정으로 시계가 뒤로 가면 경과가 줄어 게이트가 영영 닫힌다 | 시간 기준을 없애거나 단조 시계 |

`timeoutSeconds` 기본값이 1초라는 것도 뒤늦게 봤다(세 프로브 공통). 워밍업 중에는 단일 스레드가 모듈 로드와 JIT 로 묶여 있어서, `initialDelay` 를 앞당기면 프로브가 그 1초를 넘길 수 있다. 프로브를 당기는 건 공짜가 아니다.

정작 게이트를 안 걸었을 때도 문제는 없었다. 워밍업이 fire-and-forget 이라 startupProbe 통과 시점을 늦추지 않는다. 운영 배포 실측으로 20개 파드 전부 워밍업 200, 소요 1.27~1.34초, 재시작 0건. 게이트는 워밍업이 느려진 날을 위한 보험이다. 지금 뭔가를 막고 있어서 두는 게 아니다.

## 다음에 프로브를 건드릴 때 볼 것

- 이 프로브가 실패하면 재시작인가 트래픽 제외인가, 먼저 답할 수 있나
- `startupProbe` 와 `readinessProbe` 가 다른 경로를 보나
- 세 프로브가 같은 무조건 200 을 읽고 있진 않나
- `initialDelay` 를 더해서 계산하지 않았나. ContainersReady · Ready 실측으로 확인했나
- 트래픽 시작 시점을 ContainersReady 가 아니라 LB 등록까지 끝난 Ready 로 보고 있나
- 게이트 상태가 번들 경계를 넘나(`globalThis`), 프로브 라우트가 캐시되지 않나
- 상태를 모를 때 통과시키나
- 인프라 전제(프로브 경로)를 코드에 적어 뒀고, 반영 순서를 정했나

마지막 항목은 순서 문제라 따로 적어둔다. 프로브 설정은 앱 레포에 없다. 인프라 먼저, 앱 나중이다. 반대로 하면 첫 배포에서 재시작이 난다. 코드가 인프라 전제 위에 서 있다면 그 전제를 주석에 적어두는 것 말고는 강제할 방법이 없다. 그리고 프로브는 파드 템플릿 필드라서, 경로 한 글자만 바꿔도 ReplicaSet 이 갈리고 롤아웃이 돈다(실측: 재시작 0, 구·신 파드 8분 공존 후 전환, 무중단).

## 지표로 셀 때 두 번 틀렸다

프로브는 앱이 응답하는 라우트라서 관측할 수 있다. 경로에 로그 한 줄만 심으면 kubelet 의 호출 시각과 간격이 그대로 보인다. 위의 "13회 호출, 5초 간격"도 그렇게 얻었다. 다만 정상 상태에서는 워밍업이 프로브보다 훨씬 빨라서 게이트가 닫힌 장면 자체가 안 잡힌다. 앱 쪽에 인위적 지연을 넣어 창을 벌려야 보인다.

그렇게 조심했는데도 수치를 두 번 잘못 셌다.

재시작 건수를 `kube_deployment` 로만 걸러 "운영 3~5건"이라고 적었다. `env:prd` 를 넣으니 14일간 0건이었다. 섞여 있던 건 dev 와 qa 였다.

로그가 없는 걸 근거로 쓴 적도 있다. 같은 이미지인데 워밍업 로그가 있는 파드와 없는 파드가 섞여 있었다. 수집이 유실된 것이었다. "로그가 없으니 안 일어났다"가 뒤집혀서 재시작 메트릭 시계열로 처음부터 다시 셌다.

dev 와 qa 의 파드 교체를 신호로 본 것도 같은 종류의 실수였다. 28시간 동안 dev 는 노드 16개, qa 는 9개를 거쳤다. 상시 교체라 배경 소음이 신호보다 크다. 그런 판별은 파드 하나가 며칠씩 그대로인 stage 에서 해야 한다.
