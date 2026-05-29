// Standalone Locator Engine API

import { ElementMetadata } from '../shared/types';
import { generateCandidates } from './generate';
import { scoreAndSelect } from './score';
import { LocatorResult } from './types';

export * from './types';
export { generateCandidates } from './generate';
export { scoreAndSelect } from './score';
export { getLocatorReasons } from './explain';

/**
 * Unified high-level API to resolve the best Playwright locator and alternatives for a DOM element.
 */
export function getLocator(el: Element, meta: ElementMetadata): LocatorResult {
  const candidates = generateCandidates(el, meta);
  return scoreAndSelect(candidates, el);
}
