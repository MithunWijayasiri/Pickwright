// Locator selection: candidates carry Playwright-aligned scores (lower = better)
// and real uniqueness, computed in generate.ts. Selection picks the
// lowest-scoring unique candidate so the chosen locator always matches one element.

import { LocatorCandidate, LocatorResult } from './types';
import { getLocatorReasons } from './explain';
import { hasRoleName, isNthRoleCandidate } from './predicates';

export function scoreAndSelect(candidates: LocatorCandidate[]): LocatorResult {
  // The CSS fallback is unique by construction, so a unique candidate always exists.
  const unique = candidates.filter((c) => c.unique);
  const pool = unique.length > 0 ? unique : candidates;

  pool.sort((a, b) => a.score - b.score);

  // Same locator string can arrive via two strategies (e.g. formcontrolname
  // candidate + CSS fallback) — keep the lowest-scoring copy only.
  const seen = new Set<string>();
  const byValue = pool.filter((c) => {
    if (seen.has(c.value)) return false;
    seen.add(c.value);
    return true;
  });

  const deduped = deduplicateRoleCandidates(byValue);

  if (deduped[0]) {
    deduped[0].reasons = getLocatorReasons(deduped[0]);
  }

  return {
    best: deduped[0],
    alternatives: deduped.slice(1, 4),
  };
}

/** Drop the role-only candidate when a role+name candidate is present. */
function deduplicateRoleCandidates(candidates: LocatorCandidate[]): LocatorCandidate[] {
  const hasRoleWithName = candidates.some((c) => hasRoleName(c));
  if (!hasRoleWithName) return candidates;

  // Keep .nth() candidates — they are the recourse when role+name is not unique.
  return candidates.filter(
    (c) => !(c.strategy === 'getByRole' && !hasRoleName(c) && !isNthRoleCandidate(c)),
  );
}
