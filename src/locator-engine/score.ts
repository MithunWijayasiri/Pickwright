// Locator selection: candidates carry Playwright-aligned scores (lower = better)
// and real uniqueness, computed in generate.ts. Selection picks the
// lowest-scoring unique candidate so the chosen locator always matches one element.

import { LocatorCandidate, LocatorResult } from './types';
import { getLocatorReasons } from './explain';

export function scoreAndSelect(candidates: LocatorCandidate[], el: Element): LocatorResult {
  // The CSS fallback is unique by construction, so a unique candidate always exists.
  const unique = candidates.filter((c) => c.unique);
  const pool = unique.length > 0 ? unique : candidates;

  pool.sort((a, b) => a.score - b.score);

  const deduped = deduplicateRoleCandidates(pool);

  if (deduped[0]) {
    deduped[0].reasons = getLocatorReasons(deduped[0], el);
  }

  return {
    best: deduped[0],
    alternatives: deduped.slice(1, 4),
  };
}

/** Drop the role-only candidate when a role+name candidate is present. */
function deduplicateRoleCandidates(candidates: LocatorCandidate[]): LocatorCandidate[] {
  const hasRoleWithName = candidates.some(
    (c) => c.strategy === 'getByRole' && c.value.includes('name:'),
  );
  if (!hasRoleWithName) return candidates;

  return candidates.filter((c) => !(c.strategy === 'getByRole' && !c.value.includes('name:')));
}
