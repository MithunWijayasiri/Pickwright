import { ElementMetadata } from '../shared/types';
import { getAccessibleText } from '../locator-engine/accessible-text';

// Exported so picker.ts can drill shadow roots without an overlay dependency.
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

// Ordered outer-to-inner chain, one identifier per frame boundary crossed to
// reach el's document from the top document. Cross-origin frames are silently
// skipped — contentDocument/frameElement access throws or returns null.
export function getFrameSelectorChain(el: Element): string[] {
  const chain: string[] = [];
  let doc: Document | null = el.ownerDocument;

  while (doc && doc !== document) {
    try {
      const frame = doc.defaultView?.frameElement as HTMLIFrameElement | null;
      if (!frame) break;
      chain.unshift(buildFrameIdentifier(frame));
      doc = frame.ownerDocument;
    } catch {
      break;
    }
  }

  return chain;
}

// Attribute values reach frameLocator() as a quoted CSS string: backslashes and
// quotes escape, and control characters need hex escapes — a raw newline
// terminates the string and makes the selector invalid.
function cssValue(value: string): string {
  return (
    value
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      // eslint-disable-next-line no-control-regex
      .replace(/[\x00-\x1f\x7f]/g, (c) => `\\${c.charCodeAt(0).toString(16)} `)
  );
}

function buildFrameIdentifier(frame: HTMLIFrameElement): string {
  const scope = frame.ownerDocument;
  const candidate = frameIdentifierCandidate(frame);
  if (candidate && scope.querySelectorAll(candidate).length === 1) return candidate;
  return uniqueFramePath(frame);
}

function frameIdentifierCandidate(frame: HTMLIFrameElement): string | null {
  if (frame.id) return `iframe#${CSS.escape(frame.id)}`;
  if (frame.name) return `iframe[name="${cssValue(frame.name)}"]`;
  const src = frame.getAttribute('src');
  if (src) return `iframe[src="${cssValue(src)}"]`;
  return null;
}

// Positional fallback for a frame with no id/name/src, or one that shares its
// identifier with another frame elsewhere on the page. :nth-child is always
// well-defined regardless of tag mix, so the resulting path is guaranteed unique.
function uniqueFramePath(el: Element): string {
  const parts: string[] = [];
  let node: Element | null = el;
  while (node) {
    const parent: Element | null = node.parentElement;
    if (!parent) break;
    const index = Array.from(parent.children).indexOf(node) + 1;
    parts.unshift(`${node.tagName.toLowerCase()}:nth-child(${index})`);
    node = parent;
  }
  return parts.join(' > ');
}

export function collectMetadata(el: Element): ElementMetadata {
  const dataAttributes: Record<string, string> = {};

  for (const attr of Array.from(el.attributes)) {
    if (attr.name.startsWith('data-')) {
      dataAttributes[attr.name] = attr.value;
    }
  }

  const textContent = getAccessibleText(el).trim().slice(0, 100);

  return {
    tagName: el.tagName.toLowerCase(),
    id: el.id || null,
    classes: Array.from(el.classList),
    textContent,
    placeholder: el.getAttribute('placeholder'),
    title: el.getAttribute('title'),
    alt: el.getAttribute('alt'),
    name: el.getAttribute('name'),
    // ng-reflect-* is intentionally ignored — it exists only in Angular dev builds.
    formControlName: el.getAttribute('formcontrolname'),
    dataAttributes,
    frameSelectors: getFrameSelectorChain(el),
  };
}

// True for triggers the picker must not activate while selecting.
export function isAngularDropdownTrigger(el: Element): boolean {
  const hasPopup = el.getAttribute('aria-haspopup');
  const expanded = el.getAttribute('aria-expanded');
  const role = el.getAttribute('role');

  if (hasPopup === 'true' || hasPopup === 'listbox' || hasPopup === 'menu') return true;
  if (role === 'combobox' || role === 'listbox') return true;
  if (expanded !== null) return true;

  if (el.classList.contains('mat-select-trigger')) return true;
  if (el.classList.contains('mat-mdc-select-trigger')) return true;
  if (el.tagName.toLowerCase() === 'mat-select') return true;

  return false;
}
