# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

| Command | Description |
|---------|-------------|
| `npm run build` | Production build → `dist/` (load this folder as an unpacked extension) |
| `npm run dev` | Development build with watch mode |
| `npm run lint` | ESLint over `src/**/*.{ts,tsx}` |
| `npm run format` | Prettier write over `src` + `tests` (`.{ts,tsx,css,html}`) and `playwright.config.ts` |
| `npm run test` | Playwright E2E suite (runs `npm run build` first) |

E2E tests live in `tests/` and run via Playwright (`@playwright/test`). They launch a persistent Chromium context with the unpacked `dist/` extension loaded, serve `tests/test-page.html` over a local HTTP server, and drive the picker by relaying messages through the background worker. Run `npx playwright install chromium` once before the first run. The locator engine itself has no automated unit tests — coverage is the end-to-end suite plus manual verification: build, reload the extension at `chrome://extensions`, and pick elements on a real page. After changing content or background code the extension must be reloaded; popup changes show on reopen.

## Code review / `gh` CLI

The GitHub CLI (`gh`) is **not installed** in this environment, so the `/review` skill cannot fetch PR metadata or diffs from GitHub. Do **not** run `gh pr list` / `gh pr view` / `gh pr diff` — they fail with "command not found." Review locally instead:

- Diff a feature branch against the default branch: `git diff master...<branch>`.
- If no branch is given, review the current branch against `master`.
- The remote is `https://github.com/MithunWijayasiri/Pickwright.git`; `master` is the default and PR base branch.

## Architecture

Pickwright is a Manifest V3 Chrome extension. The locator-generation logic is plain DOM code with no Playwright dependency — it only emits Playwright-syntax strings.

### Three runtime contexts (webpack entry points → bundles)

- `src/background/index.ts` → `background.js` — service worker
- `src/content/picker.ts` → `content.js` — content script, injected into `<all_urls>` at `document_idle`
- `src/popup/index.tsx` → `popup.js` — React popup UI

`webpack.config.js` defines these three entries; `src/manifest.json` and `popup.html` are copied/templated into `dist/`. Adding a new context means adding an entry there.

### Message flow (the non-obvious part)

The popup cannot message the content script directly, so two paths exist:

1. **Popup → content (commands):** popup sends `TOGGLE_PICKER` / `GET_PICKER_STATE` via `chrome.runtime.sendMessage`. The **background worker relays** it: it ignores messages with a `sender.tab` (those come from content) and forwards popup messages to the active tab's content script, returning the response asynchronously (`return true`).
2. **Content → popup (results/state):** on selection, the content script broadcasts `ELEMENT_SELECTED` directly via `chrome.runtime.sendMessage` — **not** relayed. The popup listens for it. On Escape it likewise broadcasts `PICKER_STATE_CHANGED` (`{ active: false }`) so the popup can reset its toggle.

History is written **in the popup** (`App.tsx`), not the content script: the popup receives `ELEMENT_SELECTED`, enriches it with the active tab URL, and calls `addToHistory`. The content script never touches `chrome.storage`. All message type constants and payload interfaces live in `src/shared/messaging.ts` — keep them in sync across all three contexts.

### Picking mechanism (`src/content/`)

- `picker.ts` orchestrates: on activate it sets a crosshair cursor and binds **document-level capture-phase listeners** — there is **no blocking overlay div**. The overlay (`overlay.ts`) is now purely visual: a highlight box + tooltip with `pointer-events: none`. Page interaction is suppressed instead by binding the `SUPPRESSED_EVENTS` list (`mousedown`/`mouseup`/`pointerdown`/`pointerup`/`touchstart`/`touchend`/`dblclick`/`contextmenu`) on `document` at the capture phase, each calling `stopImmediatePropagation` (this is what prevents Angular dropdowns etc. from opening). `click` is **not** in that list — it has a dedicated `onClick` handler that calls `stopImmediatePropagation` + `preventDefault` so the page never sees the selecting click.
- To find the real element under the cursor, `resolveAt` calls `document.elementFromPoint` directly (no overlay toggling needed since the overlay can't be hit), skips picker-owned elements via `isPickerElement`, then drills through **open** shadow roots via `drillIntoShadow` (`inspect.ts`, using `shadowRoot.elementFromPoint`).
- `getFrameSelector` (`inspect.ts`) detects when the element lives in a **same-origin** iframe and returns a frame identifier; cross-origin frames are silently skipped (try/catch). The result is carried on `meta.frameSelector` and turned into a `frameLocator(...)` prefix in the generated locator. No event blockers are injected into iframes.

### Locator pipeline (`src/locator-engine/`)

`inspect.collectMetadata` → `getLocator` (which orchestrates `generateCandidates` → `scoreAndSelect`), called from `picker.onMouseMove` and `picker.onClick`.

- `generate.ts` emits up to 6 candidate strategies in priority order: `getByTestId` → `getByRole` (with and without accessible name) → `getByLabel` → `getByPlaceholder` → `getByText` (only for text ≤ 50 chars) → `locator(css)` fallback. The CSS builder cascades ID → testid → Angular `formcontrolname` → `name` → placeholder → role → stable classes → `nth-of-type`.
- `score.ts` ranks via the `STRATEGY_SCORES` base table plus adjustments (bonus for role+name, penalties for role-only / text / nth-of-type / class selectors / long strings), validates **uniqueness** by running an extracted CSS selector through `querySelectorAll` on the element's root node, prefers unique candidates, and returns `{ best, alternatives }`.
- **Framework-noise filtering is central:** `isStableId` and `isStableClass` reject auto-generated identifiers (`mat-`, `cdk-`, `ng-`, `_ngcontent`, hash-suffixed classes, IDs containing `:`). When changing locator quality, adjust these heuristics and the score table together.

Test-ID attributes recognized (highest priority): `data-testid`, `data-test-id`, `data-cy`.

## TypeScript / tooling notes

- `tsconfig.json` is strict with `noUnusedLocals` / `noUnusedParameters` — unused identifiers fail the build, so prefix intentionally-unused params with `_`.
- `@types/chrome` provides the `chrome.*` extension APIs; no bundler polyfills are configured.
