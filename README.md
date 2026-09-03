# 기록

개발하면서 알게 된 것들을 적는 블로그. https://keh7264.github.io

## 글 쓰기

`src/content/blog/` 에 `.md` 파일을 만들고 맨 위에 이렇게 적는다.

```markdown
---
title: '제목'
description: '목록에 보이는 한 줄 설명'
pubDate: 'Sep 04 2026'
---
```

그리고 `git push` 하면 GitHub Actions 가 빌드해서 올린다. 로컬 확인은 `npm run dev`.

## 스택

- **Astro** — 글 중심 정적 사이트. 기본적으로 JS 를 0으로 내보낸다
- **Shiki** — 코드 하이라이팅(VS Code 와 같은 엔진). 언어 이름만 붙이면 된다
- **Pretendard** — 한글 폰트. 구글폰트에 없어서 jsdelivr CDN 으로 받는다

## ⚠️ 주의

- **`astro` 버전을 `7.2.10` 으로 고정해 뒀다.** 7.3.0 은 내부 import(`_internal/logger`) 가
  깨져 있어 빌드가 실패한다. 캐럿(`^`)을 붙이면 CI 가 7.3.0 을 끌어와 터진다.
- 매매 전략·수익률·봇 관련 내용은 여기에 쓰지 않는다.
