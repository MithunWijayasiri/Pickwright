import { ElementMetadata } from '../shared/types';
import { generateCandidates } from './generate';
import { scoreAndSelect } from './score';
import { LocatorResult } from './types';

export * from './types';
export * from './present';

export function getLocator(el: Element, meta: ElementMetadata): LocatorResult {
  const candidates = generateCandidates(el, meta);
  return scoreAndSelect(candidates);
}
