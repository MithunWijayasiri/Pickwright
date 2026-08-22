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

// Cross-origin frames are silently skipped — contentDocument access throws.
export function getFrameSelector(el: Element): string | null {
  const doc = el.ownerDocument;
  if (!doc || doc === document) return null;

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
  if (frame.id) return `iframe#${CSS.escape(frame.id)}`;
  if (frame.name) return `iframe[name="${cssValue(frame.name)}"]`;
  const src = frame.getAttribute('src');
  if (src) return `iframe[src="${cssValue(src)}"]`;
  return 'iframe';
}

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

  const textContent = getAccessibleText(el).trim().slice(0, 100);

  return {
    tagName: el.tagName.toLowerCase(),
    id: el.id || null,
    classes: Array.from(el.classList),
    textContent,
    ariaAttributes,
    role: el.getAttribute('role'),
    placeholder: el.getAttribute('placeholder'),
    title: el.getAttribute('title'),
    alt: el.getAttribute('alt'),
    name: el.getAttribute('name'),
    // ng-reflect-* is intentionally ignored — it exists only in Angular dev builds.
    formControlName: el.getAttribute('formcontrolname'),
    dataAttributes,
    frameSelector: null, // set by caller if in iframe
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

export function buildTooltipLabel(el: Element): string {
  const tag = el.tagName.toLowerCase();
  const id = el.id ? `#${el.id}` : '';
  const cls = el.classList.length > 0 ? `.${Array.from(el.classList).slice(0, 2).join('.')}` : '';
  return `${tag}${id}${cls}`;
}
