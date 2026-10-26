---
paths:
  - "sites/**"
  - ".github/workflows/pages.yml"
---

# Site rules

Marketing site for the extension. Changing structure, build, deploy or the design system here → update this file in the same change.

## Build and deploy

- Astro static site, own `package.json`/lockfile. Root `check`/CI never touch it. Commands: root `CLAUDE.md` table.
- `base` comes from `SITE_BASE`: Pages workflow sets `/Pickwright`, Vercel (Root Directory `sites`) leaves it unset → `/`. Every asset URL goes through `import.meta.env.BASE_URL`, trailing slash stripped first. Hard-coded `/assets/...` breaks the Pages build only.
- Canonical/OG URLs are the constant `https://mithunwijayasiri.github.io/Pickwright/` on both hosts.
- Version shown on the page is imported from the root `package.json` (synced by `scripts/set-version.js`), never typed in.
- Public assets in `sites/public/assets/`. README banner lives there too; `og.png` URL must stay `/assets/og.png` (store listings link it).

## Design

- Tokens, type scale and shared classes live in `src/styles/global.css`. Components use the tokens, never raw colors.
- Content width = `.wrap` (`--wrap`). Nothing full-bleed except section borders/backgrounds.
- No uppercase labels, no `·` meta strings, no `→` on links, no scroll-reveal or counters. Numbers only for true sequences (install steps, strategy rank).
- Global (`is:global`) component styles leak by class name → prefix them per component (`demo-*`, `pp-*`).

## Demo

- Hero demo = fake page + one result bar (picked locator, Copy). Picking only, no popup/history/multi-pick; keep it that small.
- `src/data/demo.ts` mirrors the engine's strategy order (`SCORE` in `src/locator-engine/playwright-port.ts`). Changing it in the extension → update the demo.
- Ranking section shows `TIERS` folded into `GROUPS` (consecutive rank ranges), never all 13. New tier → add its rank to a group.
- Spec panel (`src/scripts/spec.ts` `TESTS`): every demo element belongs to one short, realistic test (goto, fill, click, assert URL); the picked step shows as a `+` diff. New demo element → add it to a test.
- Winner = lowest rank with a unique value. Demo locators have no `page.` prefix, same as the extension.
