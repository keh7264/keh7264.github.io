---
title: '리스너가 해제되지 않는 이유'
description: '화면을 나갔는데 같은 밀리초에 null 참조 에러가 여러 건 찍힌다면, removeEventListener 가 다른 함수 객체를 지우려 하고 있다는 뜻이다.'
pubDate: 'Sep 04 2026'
---

화면을 나갔는데 `Cannot read properties of null` 이 뜬다. 그것도 같은 밀리초에 여러 건씩.

진입과 이탈을 반복할 때마다 죽은 리스너가 쌓였고, resize 한 번에 그것들이 전부 발화했다는 뜻이다. `removeEventListener` 는 정리 코드에 분명히 있었는데도.

그런데도 안 지워진다면 원인은 거의 항상 하나다. 등록할 때와 **다른 함수 객체**를 넘긴 것이다.

## 지우려면 세 가지가 맞아야 한다

`removeEventListener` 는 **이벤트 타입 + 리스너 객체(참조 동일성 `===`) + capture 플래그** 세 가지가 모두 일치하는 항목을 찾아 지운다. 함수의 이름이나 내용이 같은 것은 아무 의미가 없다.

등록할 때 넘긴 것은 "코드"가 아니라 그 순간 만들어진 함수 객체다. 지울 때는 그 객체를 다시 가져와야 한다.

`() => this.handleResize()` 는 평가될 때마다 새 함수 객체를 만든다. 등록에서 한 번, 해제에서 또 한 번. 서로 다른 두 객체다. 그래서 아래 코드는 에러 없이 조용히 아무것도 지우지 않는다.

```ts
// ❌ 해제되지 않음
window.addEventListener("resize", () => this.handleResize());    // 객체 A 등록
window.removeEventListener("resize", () => this.handleResize()); // 객체 B 로 찾음 → 없음
```

```ts
// ✅ 해제됨
private handleResize = () => { /* ... */ }; // 인스턴스당 한 번 만들어진 객체 A

window.addEventListener("resize", this.handleResize);
window.removeEventListener("resize", this.handleResize);
```

아래가 되는 건 화살표 함수라서가 아니다. 한 번 만들어 어딘가에 저장해뒀기 때문이다. 클래스 필드 화살표는 그 저장을 언어가 대신 해주고, 덤으로 `this` 바인딩까지 해결해준다.

## 참조를 고정하는 네 가지 방법

### 1. 클래스 필드 화살표 — 기본값으로 쓰면 된다

인스턴스 생성 시 한 번 만들어져 필드에 담긴다. 등록·해제 순서나 호출 횟수를 따질 필요가 없다. 대가는 인스턴스마다 함수 객체 하나(프로토타입 공유가 아니다)인데, 리스너 몇 개 수준에서는 신경 쓸 비용이 아니다.

```ts
class ChartHost {
  private onResize = () => { /* this 가 인스턴스로 고정됨 */ };

  mount() { window.addEventListener("resize", this.onResize); }
  destroy() { window.removeEventListener("resize", this.onResize); }
}
```

### 2. bind 결과를 필드에 저장

동작은 같다. 단 `bind` 는 부를 때마다 새 함수 객체를 반환한다. 바인딩 줄이 두 번 실행되면 필드가 새 객체로 덮이고, 먼저 등록된 객체는 영영 지울 수 없게 된다.

```ts
this.bound = this.onResize.bind(this); // 딱 한 번만
window.addEventListener("resize", this.bound);
window.removeEventListener("resize", this.bound);

// ⚠ 흔한 실수: 고정해두고 정작 안 씀
this.onResize = this.onResize.bind(this);
window.addEventListener("resize", () => this.onResize()); // 다시 새 객체
```

### 3. AbortController — 여러 개를 한 번에

리스너 참조를 하나도 보관하지 않아도 된다. `abort()` 한 번이면 그 `signal` 로 등록한 리스너가 전부 떨어진다. 정리 대상이 셋 이상이면 이 쪽이 훨씬 덜 샌다.

```ts
const ac = new AbortController();
const { signal } = ac;

window.addEventListener("resize", onResize, { signal });
window.addEventListener("scroll", onScroll, { signal });
el.addEventListener("click", onClick, { signal });

ac.abort(); // 셋 다 해제. 인라인 화살표여도 상관없다
```

### 4. once 옵션 — 한 번 쓰고 버릴 리스너

`{ once: true }` 로 등록하면 첫 실행 직후 브라우저가 알아서 떼어낸다. "로드되면 한 번" 같은 리스너는 해제 코드를 아예 쓰지 않는 게 안전하다.

```ts
img.addEventListener("load", draw, { once: true });
```

## 매칭에 영향을 주는 것과 아닌 것

| 항목 | 매칭에 영향 | 메모 |
| --- | :---: | --- |
| 이벤트 타입 | ✅ | 당연히 같아야 한다 |
| 리스너 객체 | ✅ | `===` 동일성. 여기서 대부분 틀린다 |
| capture | ✅ | 등록을 `{capture:true}` 로 했으면 해제도 같아야 한다. `true` 와 `{capture:true}` 는 동일 |
| passive, once, signal | ❌ | 해제 시 일치 여부를 따지지 않는다 |
| 같은 조합 중복 등록 | — | 무시된다. 두 번 등록해도 한 번만 실행 |

`addEventListener(t, fn, {passive:true})` 로 등록했어도 `removeEventListener(t, fn)` 으로 지워진다. 반대로 capture 만 어긋나면 안 지워진다.

## 같은 함정이 반복되는 API들

등록할 때 준 것을 그대로 돌려줘야 한다는 규칙은 DOM 이벤트만의 것이 아니다.

| 등록 | 해제 | 무엇을 보관해야 하나 |
| --- | --- | --- |
| `setInterval` / `setTimeout` | `clearInterval` / `clearTimeout` | 반환된 핸들 |
| `socket.on(evt, fn)` | `socket.off(evt, fn)` | 같은 `fn` 참조. DOM 과 완전히 동일한 함정 |
| `observable.subscribe()` | `subscription.unsubscribe()` | Subscription 객체 |
| `new ResizeObserver(...)` | `.disconnect()` / `.unobserve(el)` | observer 인스턴스 |
| `requestAnimationFrame` | `cancelAnimationFrame` | 반환된 id |

프레임워크는 이 짝을 강제하는 자리를 하나씩 갖고 있다. React 는 `useEffect` 의 반환 함수, Vue 는 `onUnmounted`, Angular 는 `ngOnDestroy`(또는 `DestroyRef` / `takeUntilDestroyed`)다. 정리 코드를 그 자리에 두지 않으면 어디에도 없게 된다.

React 에서 인라인 화살표를 넘겨도 되는 이유도 같은 규칙으로 설명된다. 등록과 정리가 같은 클로저 안에서 같은 변수를 참조한다.

```ts
useEffect(() => {
  const onResize = () => setW(window.innerWidth);       // 한 번 만들어
  window.addEventListener("resize", onResize);
  return () => window.removeEventListener("resize", onResize); // 같은 걸 넘김
}, []);
```

## 라이브러리가 등록한 리스너는 내 코드로 못 지운다

차트·에디터·지도처럼 덩치 있는 위젯은 대부분 자기 resize 리스너를 직접 등록한다. 그 참조는 라이브러리 인스턴스 안에만 있으므로, 벤더가 제공하는 정리 API를 부르는 것 말고는 방법이 없다.

```ts
// 라이브러리 내부 (내가 손댈 수 없는 곳)
remove() {
  window.removeEventListener("resize", this._onWindowResize);
  this._iFrame.parentNode?.removeChild(this._iFrame);
}
```

내 컴포넌트의 정리 코드가 자기 리스너만 떼고 `widget.remove()` 를 부르지 않으면, 화면에서 사라져도 위젯의 리스너와 DOM 은 계속 살아 있다. 화면이 사라진 것과 객체가 정리된 것은 다르다.

## 정리 이후에 도착하는 콜백

리스너를 다 뗐어도, 정리 전에 이미 걸어둔 비동기 콜백(`onReady`, `then`, 응답 핸들러)은 나중에 도착한다. 그 안에서 이미 파괴된 객체를 만지면 처음에 봤던 것과 같은 null 참조 에러가 난다.

```ts
destroy() {
  this.isDestroyed = true;
  window.removeEventListener("resize", this.onResize);
  this.widget.remove();
}

// 늦게 도착하는 경로마다 초입에서 차단
widget.onChartReady(() => {
  if (this.isDestroyed) return;
  this.initDrawing();
});
```

AbortController 를 쓰고 있다면 플래그를 따로 두지 말고 `signal.aborted` 를 그대로 확인하면 된다. 정리 상태가 한 곳에 모인다.

## 살아있는 리스너를 세는 법

DevTools 콘솔에서는 `getEventListeners(window)` 로 바로 볼 수 있다(콘솔 전용 API). 스크립트로 재려면 등록·해제를 감싸서 `Set` 으로 추적한다. 해제가 실패하면 `delete` 가 아무것도 못 지우므로 크기가 그대로 남는다.

```js
const add = window.addEventListener.bind(window);
const rm = window.removeEventListener.bind(window);
window.__live = new Set();

window.addEventListener = (t, f, o) => { if (t === "resize") window.__live.add(f); return add(t, f, o); };
window.removeEventListener = (t, f, o) => { if (t === "resize") window.__live.delete(f); return rm(t, f, o); };

// 화면 진입 → 이탈을 반복하며 window.__live.size 를 본다
```

Performance monitor 의 JS event listeners 카운터가 우상향하는지, Memory 탭 힙 스냅샷에 detached 노드가 쌓이는지도 같은 신호다.

세기 전에 재현부터 잡아야 한다. 정리 실패는 이벤트가 실제로 발화해야 드러나고, 리스너 안에 조건 분기가 있으면 그 조건까지 만족시켜야 한다. "모바일 폭 경계를 넘을 때만" 동작하는 핸들러라면 창을 아무렇게나 줄이는 것으로는 재현되지 않고 경계를 가로질러야 한다. 고치기 전에 재현을 못 잡으면, 고친 뒤의 "에러 없음"은 아무것도 증명하지 못한다.

## 정리 코드를 쓸 때 훑는 목록

- 등록에 넘긴 함수를 변수/필드에 담아 해제에도 같은 것을 넘겼나
- 참조를 만드는 줄(`bind` 등)이 두 번 실행될 수 있나
- capture 로 등록한 것을 capture 로 해제하나
- 라이브러리가 스스로 등록한 것: `destroy()` / `remove()` / `dispose()` 를 부르고 있나
- 정리 이후 도착할 비동기 콜백에 가드가 있나
- 정리 순서: 내부 구독 해제 → DOM 조회가 필요한 작업 → 마지막에 라이브러리 파괴

목록이 길어졌다면 그게 신호다. 정리 대상이 셋을 넘어가면 하나씩 되돌리는 것보다 [AbortController 로 묶는 편](/blog/abortcontroller-cancel-pattern/)이 빠르고 덜 샌다.
