// Locator candidate generation

import { ElementMetadata } from '../shared/types';
import { LocatorCandidate } from './types';

/**
 * Generate all possible locator candidates for an element.
 * Priority: getByTestId → getByRole → getByLabel → getByPlaceholder → getByText → CSS
 */
export function generateCandidates(el: Element, meta: ElementMetadata): LocatorCandidate[] {
  const candidates: LocatorCandidate[] = [];
  const prefix = meta.frameSelector ? `frameLocator('${esc(meta.frameSelector)}').` : '';

  // 1. getByTestId (only for data-testid; data-test-id/data-cy use CSS locator)
  const testId = meta.dataAttributes['data-testid'];
  if (testId) {
    candidates.push({
      strategy: 'getByTestId',
      value: `${prefix}getByTestId('${esc(testId)}')`,
      score: 0,
      reason: 'data-testid is the most stable selector',
      unique: true,
      cssEquivalent: cssAttr('data-testid', testId),
    });
  }
  // data-test-id / data-cy — emit as CSS locator (getByTestId only matches data-testid by default)
  const altTestId = meta.dataAttributes['data-test-id'] || meta.dataAttributes['data-cy'];
  const altTestAttr = meta.dataAttributes['data-test-id'] ? 'data-test-id' : 'data-cy';
  if (!testId && altTestId) {
    candidates.push({
      strategy: 'locator',
      value: `${prefix}locator('${esc(cssAttr(altTestAttr, altTestId))}')`,
      score: 0,
      reason: `${altTestAttr} as CSS selector (configure testIdAttribute for getByTestId)`,
      unique: true,
      cssEquivalent: cssAttr(altTestAttr, altTestId),
    });
  }

  // 2. getByRole
  const role = meta.role || getImplicitRole(meta.tagName, el);
  if (role) {
    const name = getAccessibleName(el, meta);
    if (name) {
      candidates.push({
        strategy: 'getByRole',
        value: `${prefix}getByRole('${esc(role)}', { name: '${esc(name)}' })`,
        score: 0,
        reason: 'Role + accessible name is stable and semantic',
        unique: true,
        cssEquivalent: null,
      });
    }
    // Role-only candidate (less specific, still useful)
    candidates.push({
      strategy: 'getByRole',
      value: `${prefix}getByRole('${esc(role)}')`,
      score: 0,
      reason: 'Role without name — less specific',
      unique: true,
      cssEquivalent: null,
    });
  }

  // 3. getByLabel
  const label = findAssociatedLabel(el);
  if (label) {
    candidates.push({
      strategy: 'getByLabel',
      value: `${prefix}getByLabel('${esc(label)}')`,
      score: 0,
      reason: 'Label association is accessibility-friendly',
      unique: true,
      cssEquivalent: null,
    });
  }

  // 4. getByPlaceholder
  if (meta.placeholder) {
    candidates.push({
      strategy: 'getByPlaceholder',
      value: `${prefix}getByPlaceholder('${esc(meta.placeholder)}')`,
      score: 0,
      reason: 'Placeholder text as locator',
      unique: true,
      cssEquivalent: cssAttr('placeholder', meta.placeholder),
    });
  }

  // 5. getByText (only for short, meaningful text)
  if (meta.textContent.length > 0 && meta.textContent.length <= 50) {
    candidates.push({
      strategy: 'getByText',
      value: `${prefix}getByText('${esc(meta.textContent)}')`,
      score: 0,
      reason: 'Visible text — may break on i18n changes',
      unique: true,
      cssEquivalent: null,
    });
  }

  // 6. CSS fallback
  const cssSelector = buildCssSelector(el, meta);
  candidates.push({
    strategy: 'locator',
    value: `${prefix}locator('${esc(cssSelector)}')`,
    score: 0,
    reason: 'CSS fallback — less stable',
    unique: true,
    cssEquivalent: cssSelector,
  });

  return candidates;
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

  // <a> only carries the link role when it has an href
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

function getAccessibleName(el: Element, meta: ElementMetadata): string | null {
  // aria-label has highest priority
  const ariaLabel = meta.ariaAttributes['aria-label'];
  if (ariaLabel) return ariaLabel.slice(0, 60);

  // aria-labelledby
  const labelledBy = meta.ariaAttributes['aria-labelledby'];
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

  // Associated <label>
  const label = findAssociatedLabel(el);
  if (label) return label;

  // title
  if (meta.title) return meta.title.slice(0, 60);

  // For buttons/links, use visible text
  if (['button', 'a'].includes(meta.tagName) && meta.textContent) {
    return meta.textContent.slice(0, 60);
  }

  return null;
}

function findAssociatedLabel(el: Element): string | null {
  if (el.id) {
    const root = el.getRootNode() as Document | ShadowRoot;
    const selector = `label[for="${CSS.escape(el.id)}"]`;
    const label =
      (root as Document).querySelector?.(selector) ?? document.querySelector(selector);
    if (label?.textContent) return label.textContent.trim().slice(0, 60);
  }
  const parent = el.closest('label');
  if (parent?.textContent) return parent.textContent.trim().slice(0, 60);
  return null;
}

function buildCssSelector(el: Element, meta: ElementMetadata): string {
  // 1. ID (if stable-looking)
  if (meta.id && isStableId(meta.id)) {
    return `#${CSS.escape(meta.id)}`;
  }

  // 2. data-testid
  const testId = meta.dataAttributes['data-testid'];
  if (testId) return cssAttr('data-testid', testId);

  // 3. formcontrolname (Angular)
  if (meta.formControlName) {
    return cssAttr('formcontrolname', meta.formControlName);
  }

  // 4. name attribute
  if (meta.name) {
    return `${meta.tagName}${cssAttr('name', meta.name)}`;
  }

  // 5. placeholder
  if (meta.placeholder) {
    return `${meta.tagName}${cssAttr('placeholder', meta.placeholder)}`;
  }

  // 6. role attribute
  if (meta.role) {
    return `${meta.tagName}${cssAttr('role', meta.role)}`;
  }

  // 7. Stable classes
  const stableClasses = meta.classes.filter(isStableClass).slice(0, 2);
  if (stableClasses.length > 0) {
    return `${meta.tagName}.${stableClasses.join('.')}`;
  }

  // 8. Nth-child as last resort (but with parent context)
  return buildNthChildSelector(el, meta);
}

function buildNthChildSelector(el: Element, meta: ElementMetadata): string {
  const parent = el.parentElement;
  if (!parent) return meta.tagName;

  const siblings = Array.from(parent.children).filter(
    (s) => s.tagName === el.tagName,
  );
  if (siblings.length === 1) return `${getParentHint(parent)} > ${meta.tagName}`;

  const index = siblings.indexOf(el) + 1;
  return `${getParentHint(parent)} > ${meta.tagName}:nth-of-type(${index})`;
}

function getParentHint(parent: Element): string {
  if (parent.id && isStableId(parent.id)) return `#${CSS.escape(parent.id)}`;
  const stableClasses = Array.from(parent.classList).filter(isStableClass).slice(0, 1);
  if (stableClasses.length > 0) return `${parent.tagName.toLowerCase()}.${stableClasses[0]}`;
  return parent.tagName.toLowerCase();
}

function isStableId(id: string): boolean {
  // Reject IDs that look auto-generated
  return !/^\d|^(mat-|cdk-|ng-|_ng|ember|react-)/.test(id) && !id.includes(':');
}

function isStableClass(cls: string): boolean {
  // Reject Angular/CDK/framework-generated classes
  return !/^(ng-|cdk-|mat-ripple|_ngcontent|_nghost|mat-mdc-|mdc-|p-|ui-)/.test(cls) &&
    !/^[a-z]{1,3}-[a-f0-9]{4,}$/i.test(cls);
}

function esc(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

// Build a quoted CSS attribute selector with the value safely escaped.
function cssAttr(name: string, value: string): string {
  return `[${name}="${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"]`;
}
