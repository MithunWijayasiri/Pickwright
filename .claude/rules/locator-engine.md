---
paths:
  - "src/locator-engine/**"
  - "src/content/inspect.ts"
  - "src/content/picker.ts"
  - "tests/engine/**"
---

# Locator-engine rules

Invariants for `src/locator-engine/`. Violating these is how the parity PR shipped bugs.

## Scoring: lower = better

- All strategy scores live in `playwright-port.ts` `SCORE` (testId 1 … nth 10000). Lower wins.
- `score.ts` is dumb: it picks the lowest-scoring **unique** candidate. No per-strategy logic there anymore.
- Order is fixed by the numbers, NOT by emit order in `generate.ts`: testId → role+name → label → placeholder → altText → text → title → formControlName → cssId → role-only → css → role `.nth()`.
- Role `.nth(N)`: emitted only when role alone matches >1 visible elements and index ≤ 5. `unique: true` by construction. Exempt from the role-only dedupe in `score.ts` — it is the recourse when role+name is not unique.
- `getByRole` name-from-content only for roles in `NAME_FROM_CONTENT_ROLES` (Playwright's `allowsNameFromContent` list) — not every role takes its name from text.
- Adding/reordering a strategy = edit the `SCORE` value. Then fix any doc comment that lists the order — they drift (the PR shipped a backwards `placeholder → label` comment while scores said the opposite).
- The ladder is pinned by `tests/engine/locator.spec.ts` (one case per rung). Reordering `SCORE` WILL fail cases there. Decide per case whether the new winner is intended and edit the expectation deliberately — never paste actual output back in to make it green.
- `SCORE.label` is near-unreachable: `getAccessibleName` consults `findAssociatedLabel` first, so a labeled element with a role wins at `roleWithName` (100) before `label` (120); and `countLabelMatches` only scans `input, textarea, select, [role]`, so a labeled element without a role never counts as unique. Matches Playwright — not a bug. Its spec fixture looks contrived on purpose.

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

- `isStableId` (`generate.ts`): rejects id prefixes `mat-/cdk-/ng-/_ng/ember/react-`, ids with `:`, GUID-like ids (`isGuidLike`, `playwright-port.ts`).
- `isStableClass` (`generate.ts`): rejects class prefixes `ng-/cdk-/mat-ripple/_ngcontent/_nghost/mat-mdc-/mdc-/p-/ui-` + hash-suffixed `^[a-z]{1,3}-[a-f0-9]{4,}$` (also catches `jsx-…`).
- `ng-reflect-*` attrs exist only in Angular dev builds — never collect as a locator source (`collectMetadata`). `formcontrolname` IS stable: own strategy at `SCORE.formControlName`.
- Mirror these regexes in TWO places when they change: here, and the noise-filtering cases in `tests/engine/locator.spec.ts`. `data-testid` is never noise — top signal, keep it out of both filters.
- Locator-quality change → adjust heuristics AND `SCORE` together; coupled.

## Test-ID attrs

- `getByTestId` only emits for `data-testid`. `data-test-id` / `data-cy` emit as `locator(css)` (`SCORE.otherTestId`).
- Non-unique `data-testid` → `findChainedTestId` scopes via a parent `data-testid` (`getByTestId('parent').getByTestId('child')`).
