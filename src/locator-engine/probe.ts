// The single uniqueness probe: owns the search root, the visibility policy and
// the early exit. Strategy code supplies predicates only, so a counter can
// never drift from the matcher it is paired with.

export type SearchRoot = Document | ShadowRoot | Element;

export interface CountOptions {
  /**
   * Skip candidates failing isVisible. Semantic counters (role/text/label/attr)
   * opt in; CSS-path probes stay visibility-blind so an emitted selector stays
   * valid even when layout hides the element.
   */
  visibleOnly?: boolean;
  /** Native prefilter for the walk (defaults to '*'). */
  scopeSelector?: string;
}

export function rootOf(el: Element): SearchRoot {
  return el.getRootNode() as SearchRoot;
}

export function isVisible(el: Element): boolean {
  try {
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 || rect.height > 0;
  } catch {
    // Fail open: excluding an unreadable candidate would under-count and could
    // claim a uniqueness the DOM does not support.
    return true;
  }
}

function* candidates(root: SearchRoot, options: CountOptions): Generator<Element> {
  for (const cand of root.querySelectorAll(options.scopeSelector ?? '*')) {
    if (!options.visibleOnly || isVisible(cand)) yield cand;
  }
}

/** Number of matching candidates, capped at 2 — callers only distinguish 0/1/many. */
export function countMatches(
  root: SearchRoot,
  matcher: (cand: Element) => boolean,
  options: CountOptions = {},
): number {
  let count = 0;
  for (const cand of candidates(root, options)) {
    if (!matcher(cand)) continue;
    if (++count > 1) return count;
  }
  return count;
}

/** 0-based position of `expected` among the matching candidates, or -1. */
export function indexOfMatch(
  root: SearchRoot,
  matcher: (cand: Element) => boolean,
  expected: Element,
  options: CountOptions = {},
): number {
  let index = 0;
  for (const cand of candidates(root, options)) {
    if (!matcher(cand)) continue;
    if (cand === expected) return index;
    index++;
  }
  return -1;
}

/**
 * True when `selector` resolves to exactly one element under `root` and that
 * element is `expected`.
 */
export function isSoleSelectorMatch(
  root: SearchRoot,
  selector: string,
  expected: Element,
): boolean {
  try {
    const matches = root.querySelectorAll(selector);
    return matches.length === 1 && matches[0] === expected;
  } catch {
    // Invalid selector: fail closed — never claim uniqueness without proof.
    return false;
  }
}
