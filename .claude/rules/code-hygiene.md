---
paths:
  - "src/**/*.ts"
  - "src/**/*.tsx"
  - "tests/**/*.ts"
---

# Code hygiene

## No dead code

- `tsconfig.json` `noUnusedLocals`/`noUnusedParameters` catch unused locals/params — NOT unused **exports**. `combineScores` shipped dead because it was exported.
- Don't add an export until a second caller needs it (rule of three). Ported a helper "for completeness" → delete it if unused.
- Prefix intentionally-unused params with `_`.
- `@types/chrome` provides `chrome.*`; no bundler polyfills.

## Comments

- State what the code does or a non-obvious constraint. Present tense, factual, one line.
- No reader-narration: no "note that…", no justifications, no contrasts written as chat sentences.
- No JSDoc-style decoration.
- A comment that lists an ordering/priority is a liability — it drifts from the source of truth (the `SCORE` table). Either omit it or update it in the same edit.

## Mutation

- Helper that adjusts a field in place → return `void`, mutate the arg. Don't mutate-and-return (`penalizeForLength` did; reads as if it returns a new object).

## Before declaring done

- `npx tsc --noEmit` clean.
- `npm run test` green (builds first; persistent Chromium + unpacked `dist/`).
- Engine has no unit tests — behavior change must be provable via E2E or it's unverified.
