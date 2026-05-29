// Element inspection and metadata extraction

import { ElementMetadata } from '../shared/types';

/**
 * Recursively drill into open shadow DOMs to find the deepest element.
 * Exported so picker.ts can use it directly without an overlay dependency.
 */
export function drillIntoShadow(el: Element, x: number, y: number): Element {
  let current = el;
  let shadow = current.shadowRoot;

  while (shadow) {
    const deeper = shadow.elementFromPoint(x, y);
    if (!deeper || deeper === current) break;
    current = deeper;
    shadow = current.shadowRoot;
  }

  return current;
}

/**
 * Detect if element is inside a same-origin iframe and return a frame selector.
 */
export function getFrameSelector(el: Element): string | null {
  const doc = el.ownerDocument;
  if (!doc || doc === document) return null;

  // Find the iframe element in the parent document that contains this doc
  try {
    const frames = document.querySelectorAll('iframe');
    for (const frame of Array.from(frames)) {
      try {
        if (frame.contentDocument === doc) {
          return buildFrameIdentifier(frame);
        }
      } catch {
        // cross-origin iframe, skip
      }
    }
  } catch {
    // access denied
  }

  return null;
}

function buildFrameIdentifier(frame: HTMLIFrameElement): string {
  if (frame.id) return `iframe#${frame.id}`;
  if (frame.name) return `iframe[name="${frame.name}"]`;
  const src = frame.getAttribute('src');
  if (src) return `iframe[src="${src}"]`;
  return 'iframe';
}

/**
 * Collect all relevant metadata from an element for locator generation.
 */
export function collectMetadata(el: Element): ElementMetadata {
  const ariaAttributes: Record<string, string> = {};
  const dataAttributes: Record<string, string> = {};

  for (const attr of Array.from(el.attributes)) {
    if (attr.name.startsWith('aria-')) {
      ariaAttributes[attr.name] = attr.value;
    } else if (attr.name.startsWith('data-')) {
      dataAttributes[attr.name] = attr.value;
    }
  }

  const textContent = getDirectTextContent(el).trim().slice(0, 100);

  return {
    tagName: el.tagName.toLowerCase(),
    id: el.id || null,
    classes: Array.from(el.classList),
    textContent,
    ariaAttributes,
    role: el.getAttribute('role'),
    placeholder: el.getAttribute('placeholder'),
    title: el.getAttribute('title'),
    name: el.getAttribute('name'),
    formControlName:
      el.getAttribute('formcontrolname') || el.getAttribute('ng-reflect-name'),
    dataAttributes,
    frameSelector: null, // set by caller if in iframe
  };
}

/**
 * Check if element is an Angular dropdown trigger that should not be activated.
 */
export function isAngularDropdownTrigger(el: Element): boolean {
  const hasPopup = el.getAttribute('aria-haspopup');
  const expanded = el.getAttribute('aria-expanded');
  const role = el.getAttribute('role');

  // Common Angular Material / CDK dropdown patterns
  if (hasPopup === 'true' || hasPopup === 'listbox' || hasPopup === 'menu') return true;
  if (role === 'combobox' || role === 'listbox') return true;
  if (expanded !== null) return true;

  // mat-select, mat-autocomplete triggers
  if (el.classList.contains('mat-select-trigger')) return true;
  if (el.classList.contains('mat-mdc-select-trigger')) return true;
  if (el.tagName.toLowerCase() === 'mat-select') return true;

  return false;
}

/**
 * Build a short label for the tooltip during hover.
 */
export function buildTooltipLabel(el: Element): string {
  const tag = el.tagName.toLowerCase();
  const id = el.id ? `#${el.id}` : '';
  const cls =
    el.classList.length > 0
      ? `.${Array.from(el.classList).slice(0, 2).join('.')}`
      : '';
  return `${tag}${id}${cls}`;
}

function getDirectTextContent(el: Element): string {
  let text = '';
  for (const node of Array.from(el.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent ?? '';
    }
  }
  return text;
}
