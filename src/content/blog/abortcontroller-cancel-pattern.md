---
title: 'AbortController 취소 패턴'
description: 'signal 은 내가 정의하는 함수가 아니라 AbortController 인스턴스가 들고 있는 프로퍼티다. 리모컨 하나로 리스너·요청·타이머를 한꺼번에 끄는 구조.'
pubDate: 'Sep 04 2026'
---

`signal` 은 내가 정의하는 함수가 아니라, `AbortController` 인스턴스가 들고 있는 객체 프로퍼티다. 리모컨 하나로 리스너·요청·타이머를 한꺼번에 끄는 구조다.

## 구조

`new AbortController()` 하나에 발동하는 쪽(`abort()`)과 전달받는 쪽(`signal`)이 같이 들어 있다. 브라우저 내장 API라 설치도 import도 없다.

```js
const ac = new AbortController();

ac.signal   // AbortSignal 객체. 읽기 전용 프로퍼티
ac.abort()  // 취소 발동 (메서드)
ac.abort(new Error("사용자 이탈")); // 사유를 실어 보낼 수도 있다
```

예제에서 자주 보이는 `const { signal } = ac;` 는 새 함수를 만드는 게 아니라 구조 분해 할당이다. `const signal = ac.signal;` 과 완전히 같다.

| 이름 | 역할 | 누가 들고 있나 |
| --- | --- | --- |
| `controller` | 취소를 발동한다 | 정리 책임이 있는 쪽: 컴포넌트, 훅, 서비스 |
| `signal` | 취소를 전달받는다 | 등록하는 API 쪽: `addEventListener`, `fetch`, 내가 만든 함수 |

리모컨 하나에 수신기를 여러 개 물려두고, 버튼 한 번에 전부 끈다.

## signal 을 받아주는 API와 아닌 API

| API | 넘기는 자리 | 취소되면 |
| --- | --- | --- |
| `addEventListener` | 세 번째 인자 옵션 객체 | 리스너가 자동으로 해제된다 |
| `fetch` / `new Request` | init 객체 | Promise 가 `AbortError` 로 reject |
| `stream.pipeTo` | 옵션 객체 | 파이프가 중단된다 |
| `navigator.locks.request` | 옵션 객체 | 락 대기를 포기한다 |
| `setTimeout` / `setInterval` | ❌ 없음 | 직접 `clearTimeout` 을 연결해야 한다 |
| 서드파티 SDK 대부분 | ❌ 없음 | 각자의 `off()` / `destroy()` 를 불러야 한다 |

즉 취소가 저절로 전파되는 범위는 `signal` 을 받아주는 API까지다. 나머지는 `abort` 이벤트에 직접 연결해야 한다.

## 리스너 여러 개를 한 줄로 정리한다

세 번째 인자는 원래 `{ capture, passive, once }` 를 받던 자리이고, 거기에 `signal` 이 하나 더 있는 것뿐이다. abort 시점에 브라우저가 스스로 리스너를 떼어내므로 함수 참조를 보관할 필요가 없다.

```js
class Panel {
  #ac = new AbortController();

  mount() {
    const { signal } = this.#ac;

    window.addEventListener("resize", () => this.layout(), { signal });
    window.addEventListener("scroll", () => this.sync(), { signal, passive: true });
    document.addEventListener("keydown", this.onKey, { signal, capture: true });
  }

  destroy() {
    this.#ac.abort(); // 셋 다 해제
  }
}
```

참조를 안 지켜도 되니 여기서는 인라인 화살표를 넘겨도 안전하다. [참조 동일성 때문에 해제가 실패하는 문제](/blog/event-listener-cleanup/) 자체가 사라진다.

## 진행 중인 요청도 같은 신호로 끊는다

```js
async function load(signal) {
  try {
    const res = await fetch("/api/items", { signal });
    return await res.json();
  } catch (e) {
    if (e.name === "AbortError") return; // 취소는 실패가 아니다
    throw e;
  }
}
```

화면을 떠날 때 `ac.abort()` 한 번이면 리스너 해제와 요청 취소가 동시에 일어난다. 다만 취소된 fetch 는 reject 로 끝나므로, 걸러내지 않으면 "이미 떠난 화면"의 에러가 로그에 계속 쌓인다.

> **주의.** `AbortSignal.timeout()` 으로 끊긴 요청의 에러 이름은 `AbortError` 가 아니라 `TimeoutError` 다. 시간 초과를 사용자 취소와 구분해야 한다면 이름으로 갈라야 한다.

## 내가 만든 함수도 signal 을 받을 수 있다

확인 방법은 두 가지다. 지금 이미 취소됐는지 보는 플래그와, 앞으로 취소될 때 알림을 받는 이벤트다.

```js
// ① 플래그 — 반복문·루프 안에서
async function poll(signal) {
  while (!signal.aborted) {
    await tick();
  }
}

// ② 이벤트 — signal 을 지원하지 않는 API에 연결할 때
function watch(signal) {
  const timer = setInterval(ping, 1000);
  signal.addEventListener("abort", () => clearInterval(timer), { once: true });
}

// ③ 즉시 중단 — 취소됐으면 signal.reason 을 그대로 throw
function step(signal) {
  signal.throwIfAborted();
  // ...
}
```

**순서 함정.** 이미 abort 된 signal 에 `"abort"` 리스너를 붙이면 영원히 호출되지 않는다. 이벤트가 이미 지나갔기 때문이다. 늦게 합류하는 코드는 플래그를 먼저 봐야 한다.

```js
if (signal.aborted) cleanup();
else signal.addEventListener("abort", cleanup, { once: true });
```

## 컨트롤러 없이 만드는 signal

| 헬퍼 | 무엇을 주나 | 쓰는 자리 |
| --- | --- | --- |
| `AbortSignal.timeout(ms)` | ms 후 스스로 취소되는 signal | 응답이 안 오는 요청에 상한을 둘 때 |
| `AbortSignal.any([a, b])` | 하나라도 취소되면 취소되는 signal | 사용자 취소 + 시간 초과를 합칠 때 |
| `AbortSignal.abort()` | 이미 취소된 상태의 signal | 테스트, 조기 반환 경로 |

```js
// 사용자가 화면을 떠나거나, 5초가 넘거나. 둘 중 먼저 오는 쪽
const ac = new AbortController();
const signal = AbortSignal.any([ac.signal, AbortSignal.timeout(5000)]);

await fetch(url, { signal });
```

## 걸리기 쉬운 것들

- **일회용이다.** abort 한 컨트롤러는 되살릴 수 없다. 마운트할 때마다 새로 만든다. 필드에 하나 만들어 재사용하면 두 번째 마운트가 즉시 취소된 상태로 시작한다
- **capture 는 여전히 별개 옵션이다.** `{ capture: true, signal }` 처럼 같이 쓴다
- **취소 에러를 무조건 삼키면 안 된다.** catch 에서 이름을 확인하고 `AbortError` 만 조용히 넘긴다. 전부 삼키면 진짜 네트워크 실패도 같이 묻힌다
- **React StrictMode(개발 모드)는 effect 를 두 번 실행한다.** 첫 정리에서 abort 가 걸려 "요청이 취소됐다"는 로그가 보이는데, 개발 환경 한정 동작이라 버그가 아니다
- **signal 을 안 받는 API 는 자동으로 멈추지 않는다.** 타이머·SDK 구독은 `abort` 이벤트에 직접 연결한다

지원 범위는 사실상 신경 쓰지 않아도 된다. 리스너의 `signal` 옵션은 Chrome 90+ / Safari 15+, `AbortSignal.timeout` 과 `any` 만 조금 늦다(Safari 16+ / 17.4+).

## 프레임워크에서는 정리 함수 한 줄이 된다

```jsx
// React
useEffect(() => {
  const ac = new AbortController();
  const { signal } = ac;

  window.addEventListener("resize", () => setW(innerWidth), { signal });
  fetch("/api/me", { signal })
    .then(r => r.json())
    .then(setMe)
    .catch(e => { if (e.name !== "AbortError") throw e; });

  return () => ac.abort();
}, []);
```

```ts
// Angular
private ac = new AbortController();

ngOnInit()    { window.addEventListener("resize", this.onResize, { signal: this.ac.signal }); }
ngOnDestroy() { this.ac.abort(); }
```

정리 코드에서 리스너·요청·타이머를 하나씩 되돌리는 대신 `abort()` 한 줄만 남는다. 정리 대상이 셋 이상이면 거의 항상 이 쪽이 낫다. 나중에 리스너를 하나 더 추가할 때 정리 코드를 고치는 걸 잊어도 새는 곳이 생기지 않기 때문이다.

## 도입할 때 훑는 목록

- 컨트롤러를 수명 주기마다 새로 만드는가 (재사용 금지)
- 정리 지점에서 `abort()` 를 부르는가
- 취소 에러를 이름으로 걸러내는가: `AbortError`, 시간 초과면 `TimeoutError`
- signal 을 안 받는 API(타이머·SDK)에 `abort` 이벤트를 연결했는가
- 늦게 합류하는 코드가 `signal.aborted` 를 먼저 확인하는가

관련 글: [리스너가 해제되지 않는 이유](/blog/event-listener-cleanup/) — 참조 동일성 편
