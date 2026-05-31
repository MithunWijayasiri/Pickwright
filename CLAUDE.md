# CLAUDE.md

Guidance for Claude Code working in this repo.

## Commands

| Command | Description |
|---------|-------------|
| `npm run build` | Production build → `dist/` (Chrome manifest; load this folder as an unpacked extension) |
| `npm run build:chrome` | Chrome build → `dist/` (`TARGET=chrome`) |
| `npm run build:firefox` | Firefox build → `dist-firefox/` (`TARGET=firefox`, gecko manifest) |
| `npm run dev` | Development build with watch mode |
| `npm run lint` | ESLint over `src/**/*.{ts,tsx}` |
| `npm run format` | Prettier write over `src` + `tests` (`.{ts,tsx,css,html}`) and `playwright.config.ts` |
| `npm run test` | Playwright E2E suite (runs `npm run build` first) |

E2E: `tests/`, Playwright (`@playwright/test`). Launches persistent Chromium w/ unpacked `dist/` loaded, serves `tests/test-page.html` over local HTTP, drives picker via messages relayed through background worker. Run `npx playwright install chromium` once before first run. Locator engine has NO unit tests — coverage = E2E suite + manual (build, reload at `chrome://extensions`, pick on real page). Reload extension after content/background changes; popup changes show on reopen.

## Code review / `gh` CLI

`gh` is **NOT installed** here — `/review` skill cannot fetch PR metadata/diffs. Do **NOT** run `gh pr list` / `gh pr view` / `gh pr diff` (fail "command not found"). Review locally:

- Feature branch vs default: `git diff master...<branch>`.
- No branch given → review current branch vs `master`.
- Remote `https://github.com/MithunWijayasiri/Pickwright.git`; `master` = default + PR base.

## Architecture

Pickwright = Manifest V3 extension for **Chrome + Firefox**, one codebase. Locator logic = plain DOM, no Playwright dep — only emits Playwright-syntax strings.

### Cross-browser build

One `src/manifest.json` → two browser builds. `webpack.config.js` reads `TARGET` (`chrome` default / `firefox`) + `OUT_DIR` env (set by `build:chrome`/`build:firefox` via `cross-env`), **transforms manifest at copy time**: Chrome → `background.service_worker` (strips `browser_specific_settings`); Firefox → `background.scripts` + keeps gecko `browser_specific_settings`. `scripts/set-version.js` syncs version into `package.json` + `src/manifest.json`. Releases built/published by `.github/workflows/release.yml` (manual dispatch → E2E → Chrome zip + signed Firefox `.xpi` → tag → GitHub Release).

### Three runtime contexts (webpack entries → bundles)

- `src/background/index.ts` → `background.js` — service worker
- `src/content/picker.ts` → `content.js` — content script, injected into `<all_urls>` at `document_idle`
- `src/popup/index.tsx` → `popup.js` — React popup UI

`webpack.config.js` defines these three entries; `src/manifest.json` + `popup.html` copied/templated into `dist/`. New context = add entry there.

### Message flow (non-obvious)

Popup cannot message content script directly → two paths:

1. **Popup → content (commands):** popup sends `TOGGLE_PICKER` / `GET_PICKER_STATE` via `chrome.runtime.sendMessage`. **Background relays:** ignores messages w/ `sender.tab` (from content), forwards popup messages to active tab's content script, returns response async (`return true`).
2. **Content → popup (results/state):** on selection, content broadcasts `ELEMENT_SELECTED` directly via `chrome.runtime.sendMessage` — **NOT** relayed; popup listens. On Escape, broadcasts `PICKER_STATE_CHANGED` (`{ active: false }`) so popup resets toggle.

History written **in popup** (`App.tsx`), NOT content script: popup gets `ELEMENT_SELECTED`, enriches w/ active tab URL, calls `addToHistory`. Content never touches `chrome.storage`. All message type constants + payload interfaces live in `src/shared/messaging.ts` — keep in sync across all three contexts.

### Picking mechanism (`src/content/`)

- `picker.ts` orchestrates: on activate sets crosshair cursor + binds **document-level capture-phase listeners** — **NO blocking overlay div**. Overlay (`overlay.ts`) = purely visual: highlight box + tooltip, `pointer-events: none`. Page interaction suppressed by binding `SUPPRESSED_EVENTS` (`mousedown`/`mouseup`/`pointerdown`/`pointerup`/`touchstart`/`touchend`/`dblclick`/`contextmenu`) on `document` at capture phase, each `stopImmediatePropagation` (blocks Angular dropdowns etc). `click` **excluded** → dedicated `onClick`: `stopImmediatePropagation` + `preventDefault` so page never sees selecting click.
- Find element under cursor: `resolveAt` calls `document.elementFromPoint` directly (no overlay toggling — overlay can't be hit), skips picker-owned elements via `isPickerElement`, drills through **open** shadow roots via `drillIntoShadow` (`inspect.ts`, `shadowRoot.elementFromPoint`).
- `getFrameSelector` (`inspect.ts`) detects element in **same-origin** iframe → returns frame identifier; cross-origin frames silently skipped (try/catch). Carried on `meta.frameSelector` → `frameLocator(...)` prefix in locator. No event blockers injected into iframes.

### Locator pipeline (`src/locator-engine/`)

`inspect.collectMetadata` → `getLocator` (orchestrates `generateCandidates` → `scoreAndSelect`), called from `picker.onMouseMove` + `picker.onClick`.

- `generate.ts` emits ≤6 candidate strategies, priority order: `getByTestId` → `getByRole` (w/ + w/o accessible name) → `getByLabel` → `getByPlaceholder` → `getByText` (text ≤50 chars only) → `locator(css)` fallback. CSS builder cascades ID → testid → Angular `formcontrolname` → `name` → placeholder → role → stable classes → `nth-of-type`.
- `score.ts` ranks via `STRATEGY_SCORES` base table + adjustments (bonus role+name; penalties role-only / text / nth-of-type / class / long strings), validates **uniqueness** by running extracted CSS through `querySelectorAll` on element's root node, prefers unique, returns `{ best, alternatives }`.
- **Framework-noise filtering is central:** `isStableId` + `isStableClass` reject auto-generated identifiers (`mat-`, `cdk-`, `ng-`, `_ngcontent`, hash-suffixed classes, IDs w/ `:`). Changing locator quality → adjust these heuristics + score table together.

Test-ID attrs recognized (highest priority): `data-testid`, `data-test-id`, `data-cy`.

## TypeScript / tooling notes

- `tsconfig.json` strict w/ `noUnusedLocals` / `noUnusedParameters` — unused identifiers fail build, so prefix intentionally-unused params w/ `_`.
- `@types/chrome` provides `chrome.*` APIs; no bundler polyfills configured.
