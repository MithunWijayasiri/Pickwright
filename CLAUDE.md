# CLAUDE.md

## Commands

| Command | Description |
|---------|-------------|
| `npm run build` | Production build → `dist/` (Chrome manifest; load folder as unpacked extension) |
| `npm run dev` | Dev build, watch mode |
| `npm run test` | Playwright E2E, `--project=chromium` (runs `build` first) |
| `npm run test:engine` | Locator engine unit tests, `--project=engine` (builds harness first) |
| `npm run check` | `typecheck` + `lint` + `format:check` — same command CI's `Check` job runs |
| `npm run format` | Prettier write (`src/`, `tests/`, `playwright.config.ts`) |

`check` is the pre-push gate. `typecheck` runs `tsc --noEmit` twice: root `tsconfig.json` (`src/**` only) plus `tsconfig.test.json` (`tests/**` + `playwright.config.ts`). Tests are NOT in the root tsconfig on purpose — `ts-loader` builds its program from it and would pull `@playwright/test` node globals into the bundle typecheck. `.prettierrc` sets `endOfLine: auto`: working copies are CRLF (`core.autocrlf=true`, no `.gitattributes`), so prettier's default `lf` fails every file on line endings alone.

Types are gated twice — `ts-loader` has no `transpileOnly`, so `build` typechecks `src/` too. `check` exists for speed (no Chromium download), not extra coverage.

E2E (`tests/`, `@playwright/test`): persistent Chromium w/ unpacked `dist/` loaded, serves `tests/test-page.html` over local HTTP, drives picker via messages relayed through background. Run `npx playwright install chromium` once first. Engine unit tests (`tests/engine/`, `--project=engine`): table-driven, one HTML snippet per case, `about:blank` with NO extension loaded. Engine reaches the page via `dist/engine-harness.js` — a webpack entry gated on `TEST_HARNESS=1` so it never ships. That entry compiles with `tsconfig.test.json` via a second `ts-loader` rule in `webpack.config.js` (root tsconfig's `rootDir: ./src` rejects it, TS6059). A real browser is required, not jsdom: `isVisible` reads layout, and jsdom's 0×0 rects would make every uniqueness count wrong while tests still passed. Cases assert the emitted locator string only — private helpers are exercised through `getLocator`, never exported for tests. Coverage = priority ladder (one case per `SCORE` rung) + noise filters; remaining groups in `docs/locator-engine-unit-test-plan.md`. Manual check still applies for picker UX (build, reload at `chrome://extensions`, pick on real page). Reload extension after content/background changes; popup changes show on reopen.

## Architecture

Manifest V3 extension, **Chrome + Firefox** from one codebase. Locator logic = plain DOM, no Playwright dep — only emits Playwright-syntax strings.

CI (`.github/workflows/ci.yml`, PRs to `master`): `Check` job (`npm run check` → `build:firefox` → `web-ext lint`) + `E2E Tests` job. `web-ext lint` warns on missing `data_collection_permissions` and `innerHTML` assignments — 0 errors, so it does not gate.

### Cross-browser build

One `src/manifest.json` → two builds. `webpack.config.js` reads `TARGET` (`chrome` default / `firefox`) + `OUT_DIR` (set by `build:chrome`/`build:firefox` via `cross-env`), **transforms manifest at copy time**: Chrome → `background.service_worker` (strips `browser_specific_settings`); Firefox → `background.scripts` + keeps gecko `browser_specific_settings`. `scripts/set-version.js` syncs version into `package.json` + `src/manifest.json`. Releases via `.github/workflows/release.yml` (manual dispatch → E2E → Chrome zip + signed Firefox `.xpi` → tag → Release).

### Three runtime contexts (webpack entries → bundles)

- `src/background/index.ts` → `background.js` — service worker
- `src/content/picker.ts` → `content.js` — content script, injected into `<all_urls>` at `document_idle`
- `src/popup/index.tsx` → `popup.js` — React popup UI

Entries defined in `webpack.config.js`; `src/manifest.json` + `popup.html` copied/templated into `dist/`. New context → add entry there.

### Message flow (non-obvious)

Popup cannot message content script directly → two paths:

1. **Popup → content (commands):** popup sends `TOGGLE_PICKER` / `GET_PICKER_STATE` via `chrome.runtime.sendMessage`. **Background relays** popup messages (no `sender.tab`) to active tab's content script, returns response async (`return true`). Messages w/ `sender.tab` (from content) handled in background, not relayed.
2. **Content → popup (results/state):** on selection, content broadcasts `ELEMENT_SELECTED` directly — **NOT** relayed; both background (persist history) and popup (update display) receive it. On Escape, content broadcasts `PICKER_STATE_CHANGED` (`{ active: false }`) → popup resets toggle.

History written **in background** (`background/index.ts`), NOT popup/content: on `ELEMENT_SELECTED` w/ `sender.tab`, background builds `HistoryEntry` from `sender.tab.url` + calls `addToHistory` — popup is usually closed on click, can't reliably write. Popup re-reads via `getHistory`. Content never touches `chrome.storage`. Message type constants + payload interfaces live in `src/shared/messaging.ts` — keep synced across all three contexts.

### Settings & theme (split storage)

- **Settings** (`src/shared/settings.ts`): `chrome.storage.local` key `pickwright_settings`, read by background + popup. `historyMode`: `keep` / `autoClear` (wipe on browser startup) / `off` (never record). `getSettings` merges over `DEFAULT_SETTINGS`.
- **Background enforces `historyMode`:** `ELEMENT_SELECTED` skips `addToHistory` when `off`; `chrome.runtime.onStartup` calls `clearHistory` when `autoClear`.
- **Theme is popup-only** (`localStorage` key `pw-theme`, `dark` default) — NOT in `settings.ts` (`localStorage` unavailable in background worker). Applied via `data-theme` on `<html>`.
- Popup `view` state: `main` / `settings`; settings uses generic `Segmented` radiogroup. Turning `historyMode` off also clears existing entries immediately.

### Picking mechanism (`src/content/`)

- `picker.ts` orchestrates: on activate sets crosshair cursor + binds **document-level capture-phase listeners** — **NO blocking overlay div**. `overlay.ts` = purely visual (highlight box + tooltip, `pointer-events: none`). Page interaction suppressed by `SUPPRESSED_EVENTS` (`mousedown`/`mouseup`/`pointerdown`/`pointerup`/`touchstart`/`touchend`/`dblclick`/`contextmenu`) bound on `document` at capture phase, each `stopImmediatePropagation` (blocks Angular dropdowns etc). `click` **excluded** → dedicated `onClick`: `stopImmediatePropagation` + `preventDefault` so page never sees selecting click.
- `resolveAt` finds element under cursor via `document.elementFromPoint` (no overlay toggling — overlay can't be hit), skips picker-owned elements via `isPickerElement`, drills **open** shadow roots via `drillIntoShadow` (`inspect.ts`, `shadowRoot.elementFromPoint`).
- `getFrameSelector` (`inspect.ts`): element in **same-origin** iframe → frame identifier (cross-origin silently skipped, try/catch). Carried on `meta.frameSelector` → `frameLocator(...)` prefix. No event blockers injected into iframes.

### Locator pipeline (`src/locator-engine/`)

`inspect.collectMetadata` → `getLocator` (`generate.ts` builds candidates → `score.ts` picks the lowest-scoring **unique** one), from `picker.onMouseMove` + `picker.onClick`.

- Strategy scores live in `playwright-port.ts` `SCORE` (**lower = better**); `score.ts` picks the lowest-scoring unique candidate.
- Framework-noise filtering (`isStableId` / `isStableClass`) is central — auto-generated identifiers (`mat-`/`cdk-`/`ng-`, hashed classes, etc.) are rejected so they never win.
- Authoritative noise heuristics, full priority order, uniqueness/chaining invariants: `.claude/rules/locator-engine.md`.

Test-ID attrs (highest priority): `data-testid`, `data-test-id`, `data-cy`.
