// Pure helpers ported from Playwright's selector generator.
// Source: microsoft/playwright packages/injected/src/selectorGenerator.ts
// Licensed under Apache-2.0. Adapted to plain DOM (no InjectedScript engine).

// Strategy scores, lower is better — modeled on Playwright's constants.
export const SCORE = {
  testId: 1,
  otherTestId: 2,
  roleWithName: 100,
  label: 120,
  placeholder: 140,
  altText: 160,
  text: 180,
  title: 200,
  formControlName: 250,
  cssId: 500,
  roleWithoutName: 510,
  cssTagName: 530,
  nth: 10000,
  cssFallback: 10000000,
} as const;

// Auto-generated IDs (GUIDs, hashes) make poor locators. Detects them by
// counting transitions between character classes — many transitions = noise.
export function isGuidLike(id: string): boolean {
  let lastType: 'lower' | 'upper' | 'digit' | 'other' | undefined;
  let transitions = 0;
  for (let i = 0; i < id.length; ++i) {
    const c = id[i];
    if (c === '-' || c === '_') continue;
    let type: 'lower' | 'upper' | 'digit' | 'other';
    if (c >= 'a' && c <= 'z') type = 'lower';
    else if (c >= 'A' && c <= 'Z') type = 'upper';
    else if (c >= '0' && c <= '9') type = 'digit';
    else type = 'other';

    // camelCase transition (upper→lower) is not noise.
    if (type === 'lower' && lastType === 'upper') {
      lastType = type;
      continue;
    }
    if (lastType && lastType !== type) ++transitions;
    lastType = type;
  }
  return transitions >= id.length / 4;
}

// `#id` for simple identifiers, `[id="…"]` when the id needs escaping.
export function makeSelectorForId(id: string): string {
  return /^[a-zA-Z][a-zA-Z0-9\-_]+$/.test(id) ? '#' + id : `[id="${cssQuote(id)}"]`;
}

function cssQuote(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}
