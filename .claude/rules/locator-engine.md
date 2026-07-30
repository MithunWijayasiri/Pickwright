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

- `SCORE` in `playwright-port.ts` is the single source of order. Read it there; never restate the ladder in prose or comments — those drift (the parity PR shipped a backwards `placeholder → label` comment).
- `score.ts` is dumb: lowest-scoring **unique** candidate wins. No per-strategy logic.
- Emit order in `generate.ts` is irrelevant to ranking, except as a stable-sort tiebreak between equal scores.
- Role `.nth(N)`: only when role alone matches >1 visible elements and index ≤ 5. `unique: true` by construction, and exempt from the role-only dedupe in `score.ts` — it is the recourse when role+name is not unique.
- Name-from-content only for `NAME_FROM_CONTENT_ROLES` (Playwright's `allowsNameFromContent`).
- `SCORE.label` is near-unreachable by design — `getAccessibleName` consumes the label first, and `countLabelMatches` only scans `input, textarea, select, [role]`. Matches Playwright; its contrived spec fixture is deliberate. Details: `docs/locator-engine-unit-test-plan.md`.
- Changing `SCORE` fails cases in `tests/engine/locator.spec.ts` by design. Decide per case whether the new winner is intended — never paste actual output back in to go green.

## Every candidate carries real uniqueness

- `unique` must reflect an actual DOM match (`isUnique` / `count*Matches`), never assumed `true`.
- CSS fallback is unique by construction (`buildUniqueCssPath`), so a unique candidate always exists → selection never returns nothing.

## Uniqueness: match the matcher's semantics

**The rule:** pair a candidate's `unique` check with how that strategy actually resolves. Exact matcher → exact check; substring matcher → substring check. Mismatch = never selectable, CSS fallback silently always wins, i.e. dead code.

- Exact (`meta.textContent`, full attr value) → `countTextMatches` / `isUnique`.
- Trimmed alternatives from `suitableTextAlternatives` resolve as substrings (Playwright `exact: false`) → `isUniqueTextSubstring` for text, `countAttrSubstring(...) === 1` for placeholder/alt/title. Never `isUnique(cssAttr(...))` — CSS `[attr="x"]` is exact and never matches a trimmed value.
- Substring counting must apply the innermost-element rule. A naive `textContent.includes()` is always wrong: every ancestor contains the substring.
- Visibility is asymmetric — `isUnique` ignores `isVisible`, every substring/role/text count applies it. On a zero-size element the exact value wins and no trimmed variant can be unique. Bites when writing fixtures: use a block element if a trimmed variant should win.

## Framework-noise filtering

- `isStableId` (`generate.ts`): rejects id prefixes `mat-/cdk-/ng-/_ng/ember/react-`, ids with `:`, GUID-like ids (`isGuidLike`, `playwright-port.ts`).
- `isStableClass` (`generate.ts`): rejects class prefixes `ng-/cdk-/mat-ripple/_ngcontent/_nghost/mat-mdc-/mdc-/p-/ui-` + hash-suffixed `^[a-z]{1,3}-[a-f0-9]{4,}$` (also catches `jsx-…`).
- `ng-reflect-*` exists only in Angular dev builds — never a locator source. `formcontrolname` IS stable (own strategy at `SCORE.formControlName`).
- `data-testid` is never noise — keep it out of both filters.
- Changing these regexes = update two places: here, and the noise cases in `tests/engine/locator.spec.ts`.

## Test-ID attrs

- `getByTestId` only emits for `data-testid`. `data-test-id` / `data-cy` emit as `locator(css)` (`SCORE.otherTestId`).
- Non-unique `data-testid` → `findChainedTestId` scopes via a parent `data-testid` (`getByTestId('parent').getByTestId('child')`).
