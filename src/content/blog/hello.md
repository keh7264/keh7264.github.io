---
title: '첫 글'
description: '블로그를 만들었다. 여기에 개발하면서 알게 된 것들을 적는다.'
pubDate: 'Sep 03 2026'
---

블로그를 만들었다. 개발하면서 알게 된 것들을 여기 적어두려고 한다.

## 글 쓰는 법

`src/content/blog/` 에 `.md` 파일을 하나 만들고 맨 위에 이렇게 적는다.

```markdown
---
title: '제목'
description: '목록에 보이는 한 줄 설명'
pubDate: 'Sep 04 2026'
---

본문은 여기서부터.
```

그리고 push 하면 끝이다. GitHub Actions 가 알아서 빌드해서 올린다.

## 코드는 이렇게 나온다

````markdown
```python
def hello():
    print("코드 블록은 언어 이름만 붙이면 색이 입혀진다")
```
````

```python
def hello():
    print("코드 블록은 언어 이름만 붙이면 색이 입혀진다")
```

```ts
// 타입스크립트도 된다
const nums: number[] = [1, 2, 3];
const doubled = nums.map((n) => n * 2);
```

## 이미지

`src/assets/` 에 넣고 마크다운에서 상대경로로 부르면 Astro 가 알아서 최적화한다.

## 링크와 인용

> 인용은 이렇게 보인다.

[링크](https://astro.build)도 평범하게 쓰면 된다.
