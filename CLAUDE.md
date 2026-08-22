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

`check` is the pre-push gate. Non-obvious constraints behind it:

- `typecheck` runs `tsc --noEmit` twice — root tsconfig (`src/**`) + `tsconfig.test.json` (`tests/**`, `playwright.config.ts`). Tests stay out of the root config: `ts-loader` builds its program from it and would pull `@playwright/test` node globals into the bundle typecheck.
- `.prettierrc` needs `endOfLine: auto` — working copies are CRLF (`core.autocrlf=true`, no `.gitattributes`), so prettier's `lf` default fails every file on line endings alone.

Two suites, both real-browser:

- **E2E** (`tests/`): persistent Chromium w/ unpacked `dist/`, serves `tests/test-page.html` over local HTTP, drives picker via messages relayed through background. `npx playwright install chromium` once first.
- **Engine units** (`tests/engine/`): table-driven, `about:blank`, no extension. Reaches the engine via `dist/engine-harness.js` — webpack entry gated on `TEST_HARNESS=1`, compiled with `tsconfig.test.json` through a second `ts-loader` rule (root `rootDir: ./src` rejects it, TS6059). Not jsdom, on purpose: `isVisible` reads layout, and 0×0 rects would break every uniqueness count while tests still passed. Scope + open groups: `docs/backlog.md`.

Picker UX still needs a manual check (reload at `chrome://extensions`, pick on a real page). Reload after content/background changes; popup changes show on reopen.

## Architecture

Manifest V3 extension, **Chrome + Firefox** from one codebase. Locator logic = plain DOM, no Playwright dep — only emits Playwright-syntax strings.

CI (`.github/workflows/ci.yml`, PRs to `master`): `Check` job (`npm run check` → `build:firefox` → `web-ext lint`, warnings don't gate) + `E2E Tests` job (engine units, then E2E).

### Cross-browser build

One `src/manifest.json` → two builds. `webpack.config.js` reads `TARGET` (`chrome` default / `firefox`) + `OUT_DIR` (set by `build:chrome`/`build:firefox` via `cross-env`), **transforms manifest at copy time**: Chrome → `background.service_worker` (strips `browser_specific_settings`); Firefox → `background.scripts` + keeps gecko `browser_specific_settings`. `scripts/set-version.js` syncs version into `package.json` + `src/manifest.json`. Releases via `.github/workflows/release.yml` (manual dispatch → E2E → Chrome zip + signed Firefox `.xpi` → tag → Release).

### Three runtime contexts (webpack entries → bundles)

- `src/background/index.ts` → `background.js` — service worker
- `src/content/picker.ts` → `content.js` — content script, injected into `<all_urls>` at `document_idle`
- `src/popup/index.tsx` → `popup.js` — React popup UI

Entries defined in `webpack.config.js`; `src/manifest.json` + `popup.html` copied/templated into `dist/`. New context → add entry there.

### Message flow (non-obvious)

Popup cannot message content script directly → two paths:

1. **Popup → content (commands):** popup sends one of `CommandMessage` (`TOGGLE_PICKER` / `GET_PICKER_STATE` / `MULTI_PICK_START` / `MULTI_PICK_STOP`) via the typed `sendCommand` helper. **Background relays** it to the active tab's content script, returns response async (`return true`). Dispatch in background is by `message.type` (`COMMAND_TYPES.has(...)`), never by `sender.tab` truthiness — a genuine `default_popup` view has no tab, but Playwright can only drive it by opening `popup.html` as a real tab, which *does* carry `sender.tab`; type-based dispatch keeps both cases correct. Content's handler switch has a `never`-typed default, so an unhandled command is a compile error, not a silent drop.
2. **Content → popup (results/state):** broadcasts (`ELEMENT_SELECTED`, `PICKER_DEACTIVATED`) go via the typed `broadcast` helper — **NOT** relayed; both background and popup receive them. `deactivatePicker()` is the single place that broadcasts `PICKER_DEACTIVATED`, so every off-path (Escape, multi-pick stop, single-pick auto-off, popup-initiated toggle-off) emits it — popup's listener resets `pickerActive`/`multiPickerActive`/`multiPickCount` from that one message instead of per-path handlers. On selection, content also broadcasts `ELEMENT_SELECTED`; background persists history from it.

History written **in background** (`background/index.ts`), NOT popup/content: on `ELEMENT_SELECTED`, background builds `HistoryEntry` from `sender.tab?.url` + calls `addToHistory` — popup is usually closed on click, can't reliably write. Popup re-reads via `getHistory`. Content never touches `chrome.storage`. Message types, payload interfaces, response types, and the `sendCommand`/`broadcast` helpers live in `src/shared/messaging.ts` — direction and response shape are declared once there.

E2E note: a popup opened via `extensionContext.newPage()` becomes the active tab, and the relay resolves its target via `chrome.tabs.query({active:true})` — `page.bringToFront()` on the content tab before sending a command keeps the relay pointed at the right tab (`tests/extension.spec.ts`, relay test).

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
- Framework-noise filtering (`isStableId` / `isStableClass`) is central — auto-generated identifiers never win.
- Invariants that are not obvious from the code: `.claude/rules/locator-engine.md` (loads automatically when editing the engine).
