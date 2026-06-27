---
paths:
  - "src/locator-engine/**"
  - "src/content/inspect.ts"
  - "src/content/picker.ts"
---

# Locator-engine rules

Invariants for `src/locator-engine/`. Violating these is how the parity PR shipped bugs.

## Scoring: lower = better

- All strategy scores live in `playwright-port.ts` `SCORE` (testId 1 … nth 10000). Lower wins.
- `score.ts` is dumb: it picks the lowest-scoring **unique** candidate. No per-strategy logic there anymore.
- Order is fixed by the numbers, NOT by emit order in `generate.ts`: testId → role+name → label → placeholder → altText → text → title → cssId → role-only → css.
- Adding/reordering a strategy = edit the `SCORE` value. Then fix any doc comment that lists the order — they drift (the PR shipped a backwards `placeholder → label` comment while scores said the opposite).

## Every candidate carries real uniqueness

- `unique` must reflect an actual DOM match, computed in `generate.ts` (`isUnique` / `count*Matches`), not assumed `true`.
- CSS fallback is unique-by-construction (`buildUniqueCssPath`), so a unique candidate always exists → selection never returns nothing.

## Uniqueness: match the matcher's semantics

- Exact base candidates (`meta.textContent`, full attr value) use exact checks: `countTextMatches` (normalized `===`) / `isUnique` (`querySelectorAll` identity).
- Trimmed alternatives from `suitableTextAlternatives` are substring matches (Playwright default `exact: false`), so they need substring uniqueness, NOT exact:
  - text → `isUniqueTextSubstring` (innermost-element rule: el's text contains it AND no child element's does AND el is the sole match — excludes ancestors and guards identity).
  - placeholder / alt / title → `countAttrSubstring(el, attr, text) === 1`. NOT `isUnique(cssAttr(...))` — CSS `[attr="x"]` is exact, so it never matches a trimmed value.
- Rule: pair a candidate's `unique` check with how that strategy actually resolves. Exact matcher → exact check; substring matcher → substring check. Mismatch = the candidate is never selectable (CSS fallback always wins), i.e. dead code. A naive `textContent.includes()` count is also wrong — every ancestor contains the substring, so it's never unique.

## Framework-noise filtering

- `isStableId` + `isStableClass` (`generate.ts`) + `isGuidLike` (`playwright-port.ts`) reject `mat-/cdk-/ng-/_ng/ember/react-`, ids with `:`, hash-suffixed classes, GUID-like ids.
- Locator-quality change → adjust these heuristics AND the `SCORE` table together; they're coupled.

## Test-ID attrs

- `getByTestId` only emits for `data-testid`. `data-test-id` / `data-cy` emit as `locator(css)` (`SCORE.otherTestId`).
- Non-unique `data-testid` → `findChainedTestId` scopes via a parent `data-testid` (`getByTestId('parent').getByTestId('child')`).
