// @ts-check
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://keh7264.github.io',
  integrations: [mdx(), sitemap()],
  markdown: {
    // 코드 블록 하이라이팅 — VS Code 와 같은 엔진(Shiki)
    shikiConfig: { theme: 'github-dark', wrap: true },
  },
});
