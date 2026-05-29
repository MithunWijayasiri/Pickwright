// Locator scoring and selection logic

import { LocatorCandidate, LocatorResult } from './types';
import { getLocatorReasons } from './explain';

// Base scores per strategy (higher = more preferred)
const STRATEGY_SCORES: Record<string, number> = {
  getByTestId: 100,
  getByRole: 85,
  getByLabel: 75,
  getByPlaceholder: 60,
  getByText: 40,
  locator: 20,
};

/**
 * Score each candidate and return the best one plus alternatives.
 */
export function scoreAndSelect(candidates: LocatorCandidate[], el: Element): LocatorResult {
  const scored = candidates.map((c) => {
    const unique = checkUniqueness(c, el);
    const candidateWithUnique = { ...c, unique };
    const score = computeScore(candidateWithUnique);
    const finalCandidate: LocatorCandidate = {
      ...candidateWithUnique,
      score,
    };
    finalCandidate.reasons = getLocatorReasons(finalCandidate, el);
    return finalCandidate;
  });

  // Prefer unique candidates
  const unique = scored.filter((c) => c.unique);
  const pool = unique.length > 0 ? unique : scored;

  pool.sort((a, b) => b.score - a.score);

  // Deduplicate: if we have role+name and role-only, drop role-only
  const deduped = deduplicateRoleCandidates(pool);

  return {
    best: deduped[0],
    alternatives: deduped.slice(1, 4),
  };
}

function computeScore(candidate: LocatorCandidate): number {
  let score = STRATEGY_SCORES[candidate.strategy] ?? 0;

  // Bonus: role with accessible name
  if (candidate.strategy === 'getByRole' && candidate.value.includes('name:')) {
    score += 10;
  }

  // Penalty: role without name (less specific)
  if (candidate.strategy === 'getByRole' && !candidate.value.includes('name:')) {
    score -= 15;
  }

  // Penalty: text-based (i18n fragility)
  if (candidate.strategy === 'getByText') {
    score -= 5;
  }

  // Penalties judged on the CSS selector itself, not the frameLocator(...) prefix
  if (candidate.strategy === 'locator' && candidate.cssEquivalent) {
    // nth-of-type is brittle to DOM changes
    if (candidate.cssEquivalent.includes('nth-of-type')) score -= 15;
    // class selectors are moderately fragile
    if (/\.\w/.test(candidate.cssEquivalent)) score -= 5;
  }

  // Bonus: short, readable selectors
  if (candidate.value.length < 40) score += 5;
  if (candidate.value.length > 80) score -= 5;

  return score;
}

/**
 * Check if a locator uniquely identifies one element on the page.
 * Only CSS-verifiable strategies carry a cssEquivalent; role/label/text
 * can't be replicated with querySelectorAll, so they're assumed unique.
 */
function checkUniqueness(candidate: LocatorCandidate, el: Element): boolean {
  const selector = candidate.cssEquivalent;
  if (!selector) return true; // can't verify non-CSS strategies, assume OK

  try {
    const root = el.getRootNode() as Document | ShadowRoot;
    const matches = root.querySelectorAll(selector);
    return matches.length === 1 && matches[0] === el;
  } catch {
    return false;
  }
}

/**
 * If both role+name and role-only candidates exist, drop the role-only one.
 */
function deduplicateRoleCandidates(candidates: LocatorCandidate[]): LocatorCandidate[] {
  const hasRoleWithName = candidates.some(
    (c) => c.strategy === 'getByRole' && c.value.includes('name:'),
  );
  if (!hasRoleWithName) return candidates;

  return candidates.filter(
    (c) => !(c.strategy === 'getByRole' && !c.value.includes('name:')),
  );
}
