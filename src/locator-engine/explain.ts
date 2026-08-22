// Reasons shown in the popup alongside the chosen locator.

import { LocatorCandidate, LocatorReason } from './types';
import { hasRoleName, isNthSelector } from './predicates';

export function getLocatorReasons(candidate: LocatorCandidate): LocatorReason[] {
  const reasons: LocatorReason[] = [];

  // 1. Strategy Base Reasons
  switch (candidate.strategy) {
    case 'getByTestId':
      reasons.push({
        code: 'strategy-testid',
        message: 'data-testid is the most stable selector source',
      });
      break;
    case 'getByRole':
      reasons.push({
        code: 'strategy-role',
        message: 'Uses ARIA role for semantic selection',
      });
      break;
    case 'getByLabel':
      reasons.push({
        code: 'strategy-label',
        message: 'Uses associated label text for accessibility-friendly selection',
      });
      break;
    case 'getByPlaceholder':
      reasons.push({
        code: 'strategy-placeholder',
        message: 'Uses placeholder attribute value',
      });
      break;
    case 'getByText':
      reasons.push({
        code: 'strategy-text',
        message: 'Uses direct visible text content',
      });
      break;
    case 'locator':
      reasons.push({
        code: 'strategy-css',
        message: 'Uses CSS selector fallback',
      });
      break;
  }

  // 2. Uniqueness
  if (candidate.unique) {
    reasons.push({
      code: 'unique',
      message: 'Uniquely identifies the target element on the page',
    });
  } else {
    reasons.push({
      code: 'not-unique',
      message: 'Warning: Locator is not unique and matches multiple elements',
    });
  }

  // 3. Strategy heuristics / bonuses / penalties
  if (candidate.strategy === 'getByRole') {
    if (hasRoleName(candidate)) {
      reasons.push({
        code: 'role-with-name',
        message: 'Accessible name present, making the role selector highly specific',
      });
    } else {
      reasons.push({
        code: 'role-without-name',
        message: 'ARIA role without accessible name is less specific',
      });
    }
  }

  if (candidate.strategy === 'getByText') {
    reasons.push({
      code: 'text-fragile',
      message:
        'Text-based locators can be fragile to content and internationalization (i18n) changes',
    });
  }

  if (candidate.strategy === 'locator' && candidate.cssEquivalent) {
    if (isNthSelector(candidate.cssEquivalent)) {
      reasons.push({
        code: 'css-nth',
        message: 'nth-child/nth-of-type selector is highly fragile to DOM order changes',
      });
    }
    if (/\.\w/.test(candidate.cssEquivalent)) {
      reasons.push({
        code: 'css-class',
        message: 'CSS class selectors can be unstable due to style changes',
      });
    }
  }

  // 4. Length-based readability rules
  if (candidate.value.length < 40) {
    reasons.push({
      code: 'short-length',
      message: 'Short, clean and readable locator',
    });
  } else if (candidate.value.length > 80) {
    reasons.push({
      code: 'long-length',
      message: 'Long locator is harder to read and maintain',
    });
  }

  return reasons;
}
