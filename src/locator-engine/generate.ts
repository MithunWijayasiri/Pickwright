// Locator candidate generation

import { ElementMetadata } from '../shared/types';
import { LocatorCandidate } from './types';
import { SCORE, isGuidLike, makeSelectorForId } from './playwright-port';

const TEXT_MAX = 50;

/**
 * Generate all possible locator candidates for an element.
 * Priority follows Playwright's scoring (lower = better):
 * testId → role+name → placeholder → label → text → CSS id → role-only → CSS.
 * Each candidate carries its real uniqueness (matched against the DOM).
 */
export function generateCandidates(el: Element, meta: ElementMetadata): LocatorCandidate[] {
  const candidates: LocatorCandidate[] = [];
  const prefix = meta.frameSelector ? `frameLocator('${esc(meta.frameSelector)}').` : '';
  const add = (c: LocatorCandidate) => candidates.push(penalizeForLength(c));

  // 1. getByTestId (only data-testid; data-test-id/data-cy emit as CSS locator)
  const testId = meta.dataAttributes['data-testid'];
  if (testId) {
    const css = cssAttr('data-testid', testId);
    add({
      strategy: 'getByTestId',
      value: `${prefix}getByTestId('${esc(testId)}')`,
      score: SCORE.testId,
      reason: 'data-testid is the most stable selector',
      unique: isUnique(css, el),
      cssEquivalent: css,
    });
  }
  const altTestId = meta.dataAttributes['data-test-id'] || meta.dataAttributes['data-cy'];
  const altTestAttr = meta.dataAttributes['data-test-id'] ? 'data-test-id' : 'data-cy';
  if (!testId && altTestId) {
    const css = cssAttr(altTestAttr, altTestId);
    add({
      strategy: 'locator',
      value: `${prefix}locator('${esc(css)}')`,
      score: SCORE.otherTestId,
      reason: `${altTestAttr} as CSS selector (configure testIdAttribute for getByTestId)`,
      unique: isUnique(css, el),
      cssEquivalent: css,
    });
  }

  // 2. getByRole
  const role = roleOf(el);
  if (role) {
    const name = getAccessibleName(el, meta);
    if (name) {
      add({
        strategy: 'getByRole',
        value: `${prefix}getByRole('${esc(role)}', { name: '${esc(name)}' })`,
        score: SCORE.roleWithName,
        reason: 'Role + accessible name is stable and semantic',
        unique: countRoleMatches(el, role, name) === 1,
        cssEquivalent: null,
      });
    }
    add({
      strategy: 'getByRole',
      value: `${prefix}getByRole('${esc(role)}')`,
      score: SCORE.roleWithoutName,
      reason: 'Role without name — less specific',
      unique: countRoleMatches(el, role, null) === 1,
      cssEquivalent: null,
    });
  }

  // 3. getByPlaceholder
  if (meta.placeholder) {
    const css = cssAttr('placeholder', meta.placeholder);
    add({
      strategy: 'getByPlaceholder',
      value: `${prefix}getByPlaceholder('${esc(meta.placeholder)}')`,
      score: SCORE.placeholder,
      reason: 'Placeholder text as locator',
      unique: isUnique(css, el),
      cssEquivalent: css,
    });
    for (const alt of suitableTextAlternatives(meta.placeholder)) {
      add({
        strategy: 'getByPlaceholder',
        value: `${prefix}getByPlaceholder('${esc(alt.text)}')`,
        score: SCORE.placeholder - alt.scoreBonus,
        reason: 'Placeholder text (trimmed)',
        unique: isUnique(cssAttr('placeholder', alt.text), el),
        cssEquivalent: cssAttr('placeholder', alt.text),
      });
    }
  }

  // 3b. getByAltText
  const ALT_TAGS = ['APPLET', 'AREA', 'IMG', 'INPUT'];
  if (meta.alt && ALT_TAGS.includes(el.tagName)) {
    const css = cssAttr('alt', meta.alt);
    add({
      strategy: 'getByAltText',
      value: `${prefix}getByAltText('${esc(meta.alt)}')`,
      score: SCORE.altText,
      reason: 'Alt text on image/input',
      unique: isUnique(css, el),
      cssEquivalent: css,
    });
    for (const alt of suitableTextAlternatives(meta.alt)) {
      add({
        strategy: 'getByAltText',
        value: `${prefix}getByAltText('${esc(alt.text)}')`,
        score: SCORE.altText - alt.scoreBonus,
        reason: 'Alt text (trimmed)',
        unique: isUnique(cssAttr('alt', alt.text), el),
        cssEquivalent: cssAttr('alt', alt.text),
      });
    }
  }

  // 4. getByLabel
  const label = findAssociatedLabel(el);
  if (label) {
    add({
      strategy: 'getByLabel',
      value: `${prefix}getByLabel('${esc(label)}')`,
      score: SCORE.label,
      reason: 'Label association is accessibility-friendly',
      unique: countLabelMatches(el, label) === 1,
      cssEquivalent: null,
    });
  }

  // 5. getByTitle
  if (meta.title) {
    const css = cssAttr('title', meta.title);
    add({
      strategy: 'getByTitle',
      value: `${prefix}getByTitle('${esc(meta.title)}')`,
      score: SCORE.title,
      reason: 'Title attribute as locator',
      unique: isUnique(css, el),
      cssEquivalent: css,
    });
    for (const alt of suitableTextAlternatives(meta.title)) {
      add({
        strategy: 'getByTitle',
        value: `${prefix}getByTitle('${esc(alt.text)}')`,
        score: SCORE.title - alt.scoreBonus,
        reason: 'Title attribute (trimmed)',
        unique: isUnique(cssAttr('title', alt.text), el),
        cssEquivalent: cssAttr('title', alt.text),
      });
    }
  }

  // 6. getByText (short, meaningful text only)
  if (meta.textContent.length > 0 && meta.textContent.length <= TEXT_MAX) {
    add({
      strategy: 'getByText',
      value: `${prefix}getByText('${esc(meta.textContent)}')`,
      score: SCORE.text,
      reason: 'Visible text — may break on i18n changes',
      unique: countTextMatches(el, meta.textContent) === 1,
      cssEquivalent: null,
    });
    for (const alt of suitableTextAlternatives(meta.textContent)) {
      add({
        strategy: 'getByText',
        value: `${prefix}getByText('${esc(alt.text)}')`,
        score: SCORE.text - alt.scoreBonus,
        reason: 'Visible text (trimmed)',
        unique: countTextMatches(el, alt.text) === 1,
        cssEquivalent: null,
      });
    }
  }

  // 7. CSS fallback — always unique by construction, so a unique candidate always exists.
  const cssSelector = buildCssSelector(el, meta);
  add({
    strategy: 'locator',
    value: `${prefix}locator('${esc(cssSelector)}')`,
    score: cssScore(cssSelector),
    reason: 'CSS fallback — less stable',
    unique: isUnique(cssSelector, el),
    cssEquivalent: cssSelector,
  });

  return candidates;
}

// Score for the generated CSS fallback, based on what it ended up using.
function cssScore(selector: string): number {
  if (selector.startsWith('#') || selector.startsWith('[id=')) return SCORE.cssId;
  if (/:nth-(child|of-type)/.test(selector)) return SCORE.nth;
  return SCORE.cssTagName;
}

// Playwright's length penalty: bump mid-range scores slightly for long selectors.
function penalizeForLength(c: LocatorCandidate): LocatorCandidate {
  if (c.score > 50 && c.score < 300) {
    c.score += Math.min(10, (c.value.length / 10) | 0);
  }
  return c;
}

function getImplicitRole(tagName: string, el: Element): string | null {
  const map: Record<string, string> = {
    button: 'button',
    select: 'combobox',
    textarea: 'textbox',
    img: 'img',
    nav: 'navigation',
    main: 'main',
    form: 'form',
    dialog: 'dialog',
    table: 'table',
    h1: 'heading',
    h2: 'heading',
    h3: 'heading',
    h4: 'heading',
    h5: 'heading',
    h6: 'heading',
  };

  if (tagName === 'a') {
    return el.hasAttribute('href') ? 'link' : null;
  }

  if (tagName === 'input') {
    const type = el.getAttribute('type') ?? 'text';
    const inputRoles: Record<string, string> = {
      checkbox: 'checkbox',
      radio: 'radio',
      range: 'slider',
      number: 'spinbutton',
      search: 'searchbox',
      email: 'textbox',
      tel: 'textbox',
      url: 'textbox',
      text: 'textbox',
      password: 'textbox',
      submit: 'button',
      button: 'button',
      reset: 'button',
      image: 'button',
    };
    return inputRoles[type] ?? null;
  }

  return map[tagName] ?? null;
}

/** Explicit role attribute, else implicit role from the tag. */
function roleOf(el: Element): string | null {
  return el.getAttribute('role') || getImplicitRole(el.tagName.toLowerCase(), el);
}

function getAccessibleName(el: Element, meta?: ElementMetadata): string | null {
  const ariaLabel = el.getAttribute('aria-label');
  if (ariaLabel) return ariaLabel.slice(0, 60);

  const labelledBy = el.getAttribute('aria-labelledby');
  if (labelledBy) {
    const root = el.getRootNode() as Document | ShadowRoot;
    const text = labelledBy
      .trim()
      .split(/\s+/)
      .map((id) => root.querySelector?.(`#${CSS.escape(id)}`)?.textContent?.trim() ?? '')
      .filter(Boolean)
      .join(' ');
    if (text) return text.slice(0, 60);
  }

  const label = findAssociatedLabel(el);
  if (label) return label;

  const title = el.getAttribute('title');
  if (title) return title.slice(0, 60);

  const role = roleOf(el);
  if (role && ['button', 'link', 'heading'].includes(role)) {
    const text = meta ? meta.textContent : normalizeText(el.textContent ?? '');
    if (text) return text.slice(0, 60);
  }

  return null;
}

function findAssociatedLabel(el: Element): string | null {
  if (el.id) {
    const root = el.getRootNode() as Document | ShadowRoot;
    const selector = `label[for="${CSS.escape(el.id)}"]`;
    const label = (root as Document).querySelector?.(selector) ?? document.querySelector(selector);
    if (label?.textContent) return label.textContent.trim().slice(0, 60);
  }
  const parent = el.closest('label');
  if (parent?.textContent) return parent.textContent.trim().slice(0, 60);
  return null;
}

// --- Uniqueness counting (walks the element's root node, visible only) ---

function rootOf(el: Element): Document | ShadowRoot {
  return el.getRootNode() as Document | ShadowRoot;
}

function isVisible(el: Element): boolean {
  try {
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 || rect.height > 0;
  } catch {
    return true;
  }
}

function countRoleMatches(el: Element, role: string, name: string | null): number {
  let count = 0;
  for (const cand of rootOf(el).querySelectorAll('*')) {
    if (!isVisible(cand)) continue;
    if (roleOf(cand) !== role) continue;
    if (name !== null && getAccessibleName(cand) !== name) continue;
    if (++count > 1) return count;
  }
  return count;
}

function countTextMatches(el: Element, text: string): number {
  let count = 0;
  for (const cand of rootOf(el).querySelectorAll('*')) {
    if (!isVisible(cand)) continue;
    if (normalizeText(cand.textContent ?? '') === text) {
      if (++count > 1) return count;
    }
  }
  return count;
}

function countLabelMatches(el: Element, label: string): number {
  let count = 0;
  for (const cand of rootOf(el).querySelectorAll('input, textarea, select, [role]')) {
    if (!isVisible(cand)) continue;
    if (findAssociatedLabel(cand) === label) {
      if (++count > 1) return count;
    }
  }
  return count;
}

function normalizeText(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

// --- Text alternatives (port from Playwright) ---

function trimWordBoundary(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  const trimmed = text.substring(0, maxLength);
  const match = trimmed.match(/^(.*)\b(.+?)$/);
  return match ? match[1].trimEnd() : '';
}

/**
 * Generate text alternatives by stripping leading/trailing numbers and trimming
 * at word boundaries. "Delete (3)" → "Delete", "Item 42" → "Item".
 */
function suitableTextAlternatives(text: string): { text: string; scoreBonus: number }[] {
  let result: { text: string; scoreBonus: number }[] = [];

  // Strip leading numbers
  const leadingMatch = text.match(/^[\d.,]+[^.,\w]/);
  if (leadingMatch) {
    const alt = trimWordBoundary(text.substring(leadingMatch[0].length).trimStart(), 80);
    if (alt) result.push({ text: alt, scoreBonus: alt.length <= 30 ? 2 : 1 });
  }

  // Strip trailing numbers
  const trailingMatch = text.match(/[^.,\w][\d.,]+$/);
  if (trailingMatch) {
    const alt = trimWordBoundary(text.substring(0, text.length - trailingMatch[0].length).trimEnd(), 80);
    if (alt) result.push({ text: alt, scoreBonus: alt.length <= 30 ? 2 : 1 });
  }

  // Trimmed variants
  if (text.length <= 30) {
    result.push({ text, scoreBonus: 0 });
  } else {
    const long = trimWordBoundary(text, 80);
    if (long) result.push({ text: long, scoreBonus: 0 });
    const short = trimWordBoundary(text, 30);
    if (short) result.push({ text: short, scoreBonus: 1 });
  }

  return result.filter((r) => r.text);
}

// --- CSS selector building ---

function buildCssSelector(el: Element, meta: ElementMetadata): string {
  const base = buildBaseCssSelector(el, meta);
  if (isUnique(base, el)) return base;

  // Component wrapper whose own segment is non-unique (e.g. ng-select with only
  // framework classes): disambiguate via a stable *descendant* with :has().
  const withDescendant = augmentWithStableDescendant(base, el);
  if (withDescendant && isUnique(withDescendant, el)) return withDescendant;

  const withAncestor = augmentWithStableAncestor(base, el);
  if (withAncestor && isUnique(withAncestor, el)) return withAncestor;

  // Guaranteed-unique path (id → class combos → nth-child up the ancestor chain).
  return buildUniqueCssPath(el);
}

function buildBaseCssSelector(el: Element, meta: ElementMetadata): string {
  if (meta.id && isStableId(meta.id)) {
    return makeSelectorForId(meta.id);
  }

  const testId = meta.dataAttributes['data-testid'];
  if (testId) return cssAttr('data-testid', testId);

  const altTestId = meta.dataAttributes['data-test-id'] || meta.dataAttributes['data-cy'];
  if (altTestId) {
    const attr = meta.dataAttributes['data-test-id'] ? 'data-test-id' : 'data-cy';
    return cssAttr(attr, altTestId);
  }

  if (meta.formControlName) {
    return cssAttr('formcontrolname', meta.formControlName);
  }

  if (meta.name) {
    return `${meta.tagName}${cssAttr('name', meta.name)}`;
  }

  if (meta.placeholder) {
    return `${meta.tagName}${cssAttr('placeholder', meta.placeholder)}`;
  }

  if (meta.role) {
    return `${meta.tagName}${cssAttr('role', meta.role)}`;
  }

  const stableClasses = meta.classes.filter(isStableClass).slice(0, 2);
  if (stableClasses.length > 0) {
    return `${meta.tagName}.${stableClasses.map((c) => CSS.escape(c)).join('.')}`;
  }

  return buildNthChildSelector(el, meta);
}

/** True when `selector` matches exactly `el` within its root node. */
function isUnique(selector: string, el: Element): boolean {
  try {
    const matches = rootOf(el).querySelectorAll(selector);
    return matches.length === 1 && matches[0] === el;
  } catch {
    return false;
  }
}

function augmentWithStableDescendant(base: string, el: Element): string | null {
  const descendant = findStableDescendantSelector(el);
  return descendant ? `${base}:has(${descendant})` : null;
}

function findStableDescendantSelector(el: Element): string | null {
  const stableId = Array.from(el.querySelectorAll('[id]')).find((d) => isStableId(d.id));
  if (stableId) return makeSelectorForId(stableId.id);

  for (const attr of ['data-testid', 'data-test-id', 'data-cy']) {
    const d = el.querySelector(`[${attr}]`);
    const value = d?.getAttribute(attr);
    if (value) return cssAttr(attr, value);
  }

  const fc = el.querySelector('[formcontrolname]');
  const fcName = fc?.getAttribute('formcontrolname');
  if (fcName) return cssAttr('formcontrolname', fcName);

  const named = el.querySelector('[name]');
  const name = named?.getAttribute('name');
  if (name) return cssAttr('name', name);

  return null;
}

function augmentWithStableAncestor(base: string, el: Element): string | null {
  let parent = el.parentElement;
  while (parent) {
    let candidate: string | null = null;
    if (parent.id && isStableId(parent.id)) {
      candidate = `${makeSelectorForId(parent.id)} ${base}`;
    } else {
      const stableClass = Array.from(parent.classList).filter(isStableClass)[0];
      if (stableClass) {
        candidate = `${parent.tagName.toLowerCase()}.${CSS.escape(stableClass)} ${base}`;
      }
    }
    if (candidate && isUnique(candidate, el)) return candidate;
    parent = parent.parentElement;
  }
  return null;
}

/**
 * Build a guaranteed-unique `>`-joined path, ported from Playwright's cssFallback:
 * at each ancestor prefer id, then the smallest class combo, then nth-child.
 */
function buildUniqueCssPath(el: Element): string {
  const root = rootOf(el);
  const tokens: string[] = [];

  const uniqueWith = (prefix: string): string | null => {
    const selector = [prefix, ...tokens].join(' > ');
    try {
      const matches = root.querySelectorAll(selector);
      if (matches.length === 1 && matches[0] === el) return selector;
    } catch {
      /* invalid intermediate selector */
    }
    return null;
  };

  let current: Element | null = el;
  while (current && (current as Node) !== root) {
    const tag = current.tagName.toLowerCase();
    let best = '';

    if (current.id && isStableId(current.id)) {
      const tok = makeSelectorForId(current.id);
      const hit = uniqueWith(tok);
      if (hit) return hit;
      best = tok;
    }

    const parent: Element | null = current.parentElement;
    const classes = Array.from(current.classList).filter(isStableClass).map((c) => CSS.escape(c));
    for (let i = 0; i < classes.length; i++) {
      const tok = `${tag}.${classes.slice(0, i + 1).join('.')}`;
      const hit = uniqueWith(tok);
      if (hit) return hit;
      if (!best && parent && parent.querySelectorAll(tok).length === 1) best = tok;
    }

    if (parent) {
      const siblings = Array.from(parent.children);
      const sameTag = siblings.filter((s) => s.tagName === current!.tagName);
      const tok =
        sameTag.length > 1 ? `${tag}:nth-child(${siblings.indexOf(current) + 1})` : tag;
      const hit = uniqueWith(tok);
      if (hit) return hit;
      if (!best) best = tok;
    } else if (!best) {
      best = tag;
    }

    tokens.unshift(best);
    current = parent;
  }

  return tokens.join(' > ');
}

function buildNthChildSelector(el: Element, meta: ElementMetadata): string {
  const parent = el.parentElement;
  if (!parent) return meta.tagName;

  const siblings = Array.from(parent.children).filter((s) => s.tagName === el.tagName);
  if (siblings.length === 1) return `${getParentHint(parent)} > ${meta.tagName}`;

  const index = siblings.indexOf(el) + 1;
  return `${getParentHint(parent)} > ${meta.tagName}:nth-of-type(${index})`;
}

function getParentHint(parent: Element): string {
  if (parent.id && isStableId(parent.id)) return makeSelectorForId(parent.id);
  const stableClasses = Array.from(parent.classList).filter(isStableClass).slice(0, 1);
  if (stableClasses.length > 0) return `${parent.tagName.toLowerCase()}.${CSS.escape(stableClasses[0])}`;
  return parent.tagName.toLowerCase();
}

function isStableId(id: string): boolean {
  // Reject framework-generated prefixes and GUID/hash-like ids.
  return !/^(mat-|cdk-|ng-|_ng|ember|react-)/.test(id) && !id.includes(':') && !isGuidLike(id);
}

function isStableClass(cls: string): boolean {
  return (
    !/^(ng-|cdk-|mat-ripple|_ngcontent|_nghost|mat-mdc-|mdc-|p-|ui-)/.test(cls) &&
    !/^[a-z]{1,3}-[a-f0-9]{4,}$/i.test(cls)
  );
}

function esc(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function cssAttr(name: string, value: string): string {
  return `[${name}="${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"]`;
}
