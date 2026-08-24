# Backlog

Single place for unstarted work. Completed items live in git history, not here.

Priority: **A1** (parent >> child chaining) is the largest remaining locator-quality gap. Everything else is opportunistic.

## Engine unit tests — phase 3

Suite: `tests/engine/locator.spec.ts`, `npm run test:engine`. Remaining groups:

- **Test-ID handling** — `data-testid` → `getByTestId`; `data-test-id` / `data-cy` → `locator(css)`; duplicate `data-testid` → chained parent scope via `findChainedTestId`.
- **Resolve-to-one invariant** — assert in *every* case that a CSS-shaped result matches exactly one element (`page.locator(...).count()`). Cheap, catches `buildUniqueCssPath` returning a non-unique path.

Add cases by copying 4 lines in the existing tables; no harness changes needed.

### Decision needed: does `SCORE.label` earn its place?

`getByLabel` is near-unreachable. `getAccessibleName` consults `findAssociatedLabel` first, so a labeled element with a role wins at `roleWithName` (100) before `label` (120); and `countLabelMatches` only scans `input, textarea, select, [role]`, so a labeled element with no role never counts as unique. Reachable only when `aria-label` diverges from the `<label>` text *and* role+name is non-unique — what the spec fixture encodes.

Matches Playwright (it won't resolve a labeled `<div>` either), so not a bug. Removing the strategy drops `countLabelMatches` too; keeping it costs one contrived fixture.

## A1. Recursive parent >> child chaining — HIGH

Port of Playwright's parent-nesting search (`selectorGenerator.ts` → `generateSelectorFor`, "nest under parent" branch).

Component-heavy Angular apps (tables, `mat-list`, repeated cards): the picked element has no unique locator of its own — every row has an identical "Edit" button. Current fallback is `.nth()` (order-fragile) then a deep `:nth-child` CSS path (breaks on any reorder, unreadable). Playwright instead scopes the child under a uniquely-identifiable ancestor:

```ts
// Pickwright today
locator('table > tbody > tr:nth-child(3) > td:nth-child(5) > button')

// After A1
getByRole('row', { name: 'John Smith' }).getByRole('button', { name: 'Edit' })
```

Survives row reordering and column changes, states intent, and matches what a QA would hand-write. One-level chaining already exists for `data-testid` (`findChainedTestId`), proving the shape works.

### How Playwright does it

- When the best candidate matches >1 element, iterate ancestors; compute each ancestor's own best selector, combine `ancestor >> candidate`, verify the pair is unique, keep the minimum combined score.
- Combined score = sum of token scores, so chains lose to any unique single candidate and beat `cssFallback`.
- Per-element candidate caches (`cacheAllowText` / `cacheDisallowText`) — ancestors get revisited constantly during recursion.
- Bounded recursion; `nth` index ≤ 5.

### Invariants (see `.claude/rules/locator-engine.md`)

- Chain `unique` = real DOM check: anchor unique in its root AND child unique **within the anchor's subtree**. Scoped counting, not document-wide.
- Chain score = anchor + child + `SCORE.chainPenalty` (new constant). Keeps unique single < chain < `.nth()` / `:nth-child` CSS.
- `score.ts` stays dumb — chains are just candidates with scores.
- `frameLocator` prefix applied once, on the anchor only.
- Same shadow root only (cross-shadow chaining = D3).

### Steps

1. **Scoped counters** (`generate.ts`): parameterize `countRoleMatches` / `countTextMatches` / `isUnique` by a search root (`Document | ShadowRoot | Element`) instead of hardcoded `rootOf(el)`. Pure refactor.
2. **Anchor discovery**: walk ancestors (bound: 3 levels or first hit). Qualifies if it has a unique candidate from `data-testid` → stable id → role+name → `formcontrolname` → label. Reuse `generateCandidates` with text disabled (Playwright's `allowText=false` for parents); cache per ancestor.
3. **Chain assembly**: for each (anchor, child) pair where the child is unique within the anchor, emit a candidate with `value = anchorValue + '.' + childValue`, combined score, `cssEquivalent: null`. Build chains only when no unique non-CSS single candidate exists — same trigger as `.nth()`.
4. **Child `.nth()` inside anchor**: if the child is not unique even within the anchor, allow `anchor.getByRole('button').nth(i)` with an in-anchor index.
5. **Absorb `findChainedTestId`** — testId→testId becomes a special case of 2+3; delete the bespoke function.
6. `LocatorCandidate.strategy` stays the *child's* strategy (`findChainedTestId` precedent). Verify `popup/locatorUtils.ts getStrategy` parses chained strings.

### Tests

- Engine units: repeated identical row-action buttons; anchor via `data-testid` container; regression cases proving unique single candidates are unchanged (chains only fire when nothing single is unique).
- E2E: add a table with repeated row actions to `tests/test-page.html`.

### Risks

- **Perf**: `onMouseMove` calls `getLocator` on every hover. Mitigate by running chain search only in the `onClick` path, or cache per hovered element; hard-bound ancestor count.
- **Uniqueness mismatch**: chained `getByText` / `getByLabel` need the same substring-vs-exact care as singles — pair each with the matching scoped counter.

Effort ~1 week incl. E2E. Steps 1–2 are safe standalone refactors; 3–5 land together.

## Popup explainability UI

Show a collapsible **▼ Why this locator?** section listing the heuristics behind the score. The engine already attaches `LocatorReason[]` (`{ code, message }`) to the best candidate — it is computed and then dropped.

Plumbing — add `reasons?: LocatorReason[]` to:

- `ElementSelectedMessage` payload (`shared/messaging.ts`) and `HistoryEntry` (`shared/storage.ts`)
- the `sendMessage` payload in `content/picker.ts` (`result.best.reasons`, resolves an existing TODO)
- the `HistoryEntry` built in `background/index.ts`

UI (`popup/App.tsx` + `popup.css`): collapsible toggle, loop `reasons[]`, style positive codes (`unique`, `role-with-name`, `strategy-testid`) as checks and negative ones (`fragile`, `nth-of-type`, `without-name`, `length`) as warnings.

## Playwright port parity — remaining

Sources (microsoft/playwright `main`): `packages/injected/src/selectorGenerator.ts` (orchestrator, core ported), `roleUtils.ts` (ARIA roles + accname), `selectorUtils.ts` (element text, labels), `domUtils.ts` (visibility, shadow), `packages/isomorphic/stringUtils.ts` (escaping), `locatorUtils.ts` (`getBy*` builders), `locatorGenerators.ts` (token → per-language syntax).

| # | Item | Worth | Notes |
|---|---|---|---|
| C2 | Full `getElementAccessibleName` | MED-HIGH, large | Real accname algorithm: `aria-labelledby` chains, `::before/::after` content, recursion, hidden handling. Current: `aria-label` → `aria-labelledby` → label → title → text, with title-before-text an intentional divergence. Name-from-content subset already ported. Mismatch → wrong `getByRole` name. |
| D2 | `elementText` / `getElementLabels` | MED | Visible-text-only extraction (skips hidden subtrees, shadow-aware) and full label collection. Current: `getAccessibleText` (`src/locator-engine/accessible-text.ts`) skips `aria-hidden`/`display:none` and `visibility:hidden` direct text (keeps `visibility:visible` descendants); `findAssociatedLabel` covers `for=` + ancestor `<label>` only. |
| D3 | Cross-shadow traversal | MED | `parentElementOrShadowHost`, `closestCrossShadow`. Needed for A1 inside web components. CSS path currently stays within one root. |
| E1 | `escapeForTextSelector` / `escapeForAttributeSelector` | MED | Exact vs substring, RegExp inputs, quote normalization. Current escaping is naive (iframe attr values now handle control chars; text does not). |
| C1 ph4 | Scoped grid roles | LOW | `td`/`th` → `gridcell` inside `role=grid/treegrid`. ~15 lines. Real data-grids carry explicit `role`, which `roleOf` already honors, so this only fires for a bare `<td>` in `<table role=grid>`. Do it if a real case appears. |
| A4 | `multiple` mode | LOW | Generates with/without text and cssId, dedupes. Pickwright surfaces alternatives differently. |
| B4 | `getByText` exact regex `/^…$/` | LOW | Minor precision gain for short text. |
| B5 | role + `description` | LOW | `getByRole(role, { name, description })` when ambiguous. Niche; pairs with C3. |
| B6 | `internal:has-text` combos | LOW | `tag >> has-text=…`. Rarely the best locator. |

Deliberately skipped: `forTextExpect` mode (assertion generation, not picking), ARIA state helpers (`getAriaChecked` etc. — assertions, not selection), and `locatorGenerators.ts` multi-language output (only relevant if Python/Java/C# output is ever offered; needs the token model first).

## Accepted risk: `image-size` advisory (dev-only)

`npm audit` reports 2 high-severity `image-size` advisories (ICNS/JXL/HEIF parser infinite loops, DoS), reached only via `web-ext lint` (`addons-linter` pins `image-size@2.0.2` exactly):

```
image-size  (2 high)
  addons-linter >=3.0.0
    web-ext >=6.1.0
```

No patched `image-size` exists — `2.0.2` is latest, advisory range is `<=2.0.2`. `npm audit fix --force` offers `web-ext@5.5.0`, a five-major downgrade that breaks `web-ext lint` (`ci.yml`) and `web-ext sign` (`release.yml`). Declined.

Dev-tree only, not in the shipped extension bundle — exposure is a developer/CI runner linting Pickwright's own extension assets, not page content or runtime code.

Revisit when `addons-linter` unpins `image-size` or `image-size` ships a patched release. See #36.

## Firefox manifest

`browser_specific_settings.gecko.data_collection_permissions` is missing. `web-ext lint` warns it is required for new Firefox extensions — a warning today (0 errors, does not gate CI), an AMO submission blocker later.
