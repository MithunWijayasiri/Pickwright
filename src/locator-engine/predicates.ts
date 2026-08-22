// Shared structural checks on rendered candidate/selector strings, used by
// both score.ts (dedupe) and explain.ts (reasons) so the same fact isn't
// pattern-matched twice with room to drift.

import { LocatorCandidate } from './types';

export function hasRoleName(candidate: LocatorCandidate): boolean {
  return candidate.strategy === 'getByRole' && candidate.value.includes('name:');
}

export function isNthRoleCandidate(candidate: LocatorCandidate): boolean {
  return candidate.value.includes('.nth(');
}

export function isNthSelector(selector: string): boolean {
  return /:nth-(child|of-type)/.test(selector);
}
