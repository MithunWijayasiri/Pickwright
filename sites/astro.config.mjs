import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://mithunwijayasiri.github.io',
  base: process.env.SITE_BASE ?? '/',
});
