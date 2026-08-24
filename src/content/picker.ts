// Pickwright content script — picker orchestration

import { broadcast, CommandMessage, CommandResponseMap, MESSAGE_TYPES } from '../shared/messaging';
import {
  createOverlay,
  removeOverlay,
  updateHighlight,
  hideHighlight,
  isPickerElement,
  TOAST_ID,
} from './overlay';
import { collectMetadata, isAngularDropdownTrigger, drillIntoShadow } from './inspect';
import { getLocator, highlightInline } from '../locator-engine';

let pickerActive = false;
let multiPickerActive = false;
let lastHoveredElement: Element | null = null;
let lastLocatorStr = '';

// Events to suppress on document so the page never reacts while picking.
// 'click' has its own dedicated handler and is NOT listed here.
const SUPPRESSED_EVENTS = [
  'mousedown',
  'mouseup',
  'pointerdown',
  'pointerup',
  'touchstart',
  'touchend',
  'dblclick',
  'contextmenu',
] as const;

// --- Activation / Deactivation ---

function activatePicker(): void {
  if (pickerActive) return;
  pickerActive = true;
  createOverlay();
  document.documentElement.style.cursor = 'crosshair';
  attachListeners();
}

function deactivatePicker(): void {
  if (!pickerActive) return;
  pickerActive = false;
  multiPickerActive = false;
  detachListeners();
  removeOverlay();
  document.documentElement.style.cursor = '';
  lastHoveredElement = null;
  lastLocatorStr = '';
  broadcast({ type: MESSAGE_TYPES.PICKER_DEACTIVATED });
}

// --- Event handlers (document capture phase) ---

// Cumulative offset from a (possibly nested-iframe) window's viewport to the
// top document's viewport, by walking up through each ancestor iframe's rect.
function offsetToTop(view: Window): { x: number; y: number } {
  let x = 0;
  let y = 0;
  let win: Window = view;

  while (win !== window) {
    const frame = win.frameElement as HTMLIFrameElement | null;
    if (!frame) break;
    const rect = frame.getBoundingClientRect();
    x += rect.left + frame.clientLeft;
    y += rect.top + frame.clientTop;
    if (win.parent === win) break;
    win = win.parent;
  }

  return { x, y };
}

function onMouseMove(e: MouseEvent): void {
  let clientX = e.clientX;
  let clientY = e.clientY;

  // Translate coordinates up through every nested same-origin iframe the event
  // originated inside, so resolveAt always receives top-document coordinates.
  if (e.view && e.view !== window) {
    const offset = offsetToTop(e.view);
    clientX += offset.x;
    clientY += offset.y;
  }

  const el = resolveAt(clientX, clientY);
  if (!el) {
    lastHoveredElement = null;
    lastLocatorStr = '';
    hideHighlight();
    return;
  }

  if (el !== lastHoveredElement) {
    lastHoveredElement = el;
    const meta = collectMetadata(el);
    const result = getLocator(el, meta);
    // best is undefined only if generateCandidates ever returned nothing — the CSS
    // fallback makes that unreachable, but the type stays honest so this guards it.
    if (!result.best) {
      lastLocatorStr = '';
      hideHighlight();
      return;
    }
    lastLocatorStr = result.best.value;
  }

  // Offset element bounding rect up through every nested iframe it sits inside
  let elRect = el.getBoundingClientRect();
  const elView = el.ownerDocument.defaultView;
  if (elView && elView !== window) {
    const offset = offsetToTop(elView);
    elRect = new DOMRect(
      elRect.left + offset.x,
      elRect.top + offset.y,
      elRect.width,
      elRect.height,
    );
  }

  updateHighlight(elRect, lastLocatorStr, clientX, clientY);
}

function onClick(e: MouseEvent): void {
  // Shift+click passes through to the page (opens dropdowns/menus); picker stays armed.
  if (e.shiftKey) return;
  // Intercept in capture phase — page never sees this click
  e.stopImmediatePropagation();
  e.preventDefault();

  let clientX = e.clientX;
  let clientY = e.clientY;

  if (e.view && e.view !== window) {
    const offset = offsetToTop(e.view);
    clientX += offset.x;
    clientY += offset.y;
  }

  const el = resolveAt(clientX, clientY);
  if (!el) return;

  const meta = collectMetadata(el);

  const result = getLocator(el, meta);
  const best = result.best;
  // See the onMouseMove guard above: unreachable per the engine's uniqueness invariant.
  if (!best) return;

  copyToClipboard(best.value);
  showToast(best.value, isAngularDropdownTrigger(el));

  broadcast({
    type: MESSAGE_TYPES.ELEMENT_SELECTED,
    payload: {
      locator: best.value,
      strategy: best.strategy,
      alternatives: result.alternatives.map((a) => a.value),
      reasons: best.reasons ?? [],
      tag: meta.tagName,
      textSnippet: meta.textContent.slice(0, 40),
      multiPick: multiPickerActive,
    },
  });

  if (!multiPickerActive) {
    deactivatePicker();
  }
}

function onKeyDown(e: KeyboardEvent): void {
  if (e.key === 'Escape') {
    e.preventDefault();
    e.stopImmediatePropagation();
    deactivatePicker();
  }
}

function suppressEvent(e: Event): void {
  // Shift held: let the event through so dropdowns/menus can open while picking.
  if ((e as MouseEvent).shiftKey) return;
  e.stopImmediatePropagation();
  if (e.type === 'contextmenu') e.preventDefault();
}

// --- Listener management ---

function onIframeLoad(e: Event): void {
  const target = e.target as HTMLElement | null;
  if (target && target.tagName === 'IFRAME') {
    bindToIframe(target as HTMLIFrameElement);
  }
}

function bindDocumentListeners(doc: Document): void {
  unbindDocumentListeners(doc);
  doc.addEventListener('mousemove', onMouseMove, true);
  doc.addEventListener('click', onClick, true);
  doc.addEventListener('keydown', onKeyDown, true);
  doc.addEventListener('load', onIframeLoad, true);
  for (const evt of SUPPRESSED_EVENTS) {
    doc.addEventListener(evt, suppressEvent, true);
  }
}

function unbindDocumentListeners(doc: Document): void {
  doc.removeEventListener('mousemove', onMouseMove, true);
  doc.removeEventListener('click', onClick, true);
  doc.removeEventListener('keydown', onKeyDown, true);
  doc.removeEventListener('load', onIframeLoad, true);
  for (const evt of SUPPRESSED_EVENTS) {
    doc.removeEventListener(evt, suppressEvent, true);
  }
}

// Recurses into nested same-origin iframes so hover/click/load listeners
// reach every depth, not just direct children of the top document.
function bindToIframe(frame: HTMLIFrameElement): void {
  try {
    const doc = frame.contentDocument;
    if (!doc) return;
    bindDocumentListeners(doc);
    for (const child of Array.from(doc.querySelectorAll('iframe'))) {
      bindToIframe(child);
    }
  } catch {
    // Ignore cross-origin frames
  }
}

function unbindFromIframe(frame: HTMLIFrameElement): void {
  try {
    const doc = frame.contentDocument;
    if (!doc) return;
    for (const child of Array.from(doc.querySelectorAll('iframe'))) {
      unbindFromIframe(child);
    }
    unbindDocumentListeners(doc);
  } catch {
    // Ignore cross-origin frames
  }
}

function attachListeners(): void {
  bindDocumentListeners(document);

  // Attach same-origin iframe event handlers for existing iframes, recursively
  const frames = document.querySelectorAll('iframe');
  for (const frame of Array.from(frames)) {
    bindToIframe(frame);
  }
}

function detachListeners(): void {
  const frames = document.querySelectorAll('iframe');
  for (const frame of Array.from(frames)) {
    unbindFromIframe(frame);
  }

  unbindDocumentListeners(document);
}

// --- Element resolution ---

const INTERACTIVE_SELECTOR =
  'button,select,input,[role=button],[role=checkbox],[role=radio],a,[role=link]';

/**
 * If the target is a non-interactive child (icon/glyph) inside an interactive
 * ancestor, retarget to that ancestor. Matches Playwright's retarget behavior.
 */
function retargetToInteractive(el: Element): Element {
  const tag = el.tagName;
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return el;
  if ((el as HTMLElement).isContentEditable) return el;

  const interactive = closestInteractiveComposed(el);
  if (interactive && isElementVisible(interactive)) return interactive;
  return el;
}

// Nearest interactive ancestor across open shadow boundaries (composed tree).
// Element.closest stops at the shadow root, so hop shadowRoot → host manually.
function closestInteractiveComposed(el: Element): Element | null {
  let node: Node | null = el;
  while (node) {
    if (node instanceof Element && node.matches(INTERACTIVE_SELECTOR)) return node;
    const parent: Node | null = node.parentNode;
    node = parent instanceof ShadowRoot ? parent.host : parent;
  }
  return null;
}

function isElementVisible(el: Element): boolean {
  try {
    const style = window.getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden';
  } catch {
    return true;
  }
}

function resolveAt(x: number, y: number): Element | null {
  let el = document.elementFromPoint(x, y);
  if (!el || isPickerElement(el)) return null;

  // Drill recursively into same-origin iframes
  while (el && el.tagName === 'IFRAME') {
    const iframe = el as HTMLIFrameElement;
    try {
      const doc = iframe.contentDocument;
      if (!doc) break;
      const rect = iframe.getBoundingClientRect();
      x -= rect.left + iframe.clientLeft;
      y -= rect.top + iframe.clientTop;
      const nextEl = doc.elementFromPoint(x, y);
      // nextEl comes from the inner document, so it can never be the iframe
      // itself; the `tagName === 'IFRAME'` loop condition handles termination.
      if (!nextEl) break;
      el = nextEl;
    } catch {
      break; // Cross-origin, cannot drill
    }
  }

  const resolved = drillIntoShadow(el, x, y);
  return retargetToInteractive(resolved);
}

// --- Clipboard ---

function copyToClipboard(text: string): void {
  navigator.clipboard.writeText(text).catch(() => {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    Object.assign(textarea.style, { position: 'fixed', opacity: '0', left: '-9999px' });
    document.body.appendChild(textarea);
    textarea.select();
    // execCommand is deprecated but remains the only synchronous clipboard
    // fallback when the async Clipboard API rejects. Cast through a local type
    // so the editor's deprecation marker doesn't flag this intentional fallback.
    (document as unknown as { execCommand(commandId: string): boolean }).execCommand('copy');
    textarea.remove();
  });
}

// --- Toast ---

function showToast(text: string, isDropdown: boolean): void {
  // Drop any toast still on screen so rapid picks don't stack duplicate IDs.
  document.getElementById(TOAST_ID)?.remove();

  const toast = document.createElement('div');
  toast.id = TOAST_ID;
  Object.assign(toast.style, {
    position: 'fixed',
    bottom: '24px',
    right: '24px',
    width: '320px',
    background: '#0e0e10',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '4px',
    overflow: 'hidden',
    boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
    display: 'flex',
    alignItems: 'stretch',
    zIndex: '2147483647',
    opacity: '0',
    transform: 'translateX(30px) scale(0.96)',
    transition:
      'opacity 250ms cubic-bezier(0.16, 1, 0.3, 1), transform 250ms cubic-bezier(0.16, 1, 0.3, 1)',
    pointerEvents: 'auto',
  });

  const accentColor = isDropdown ? '#ffa657' : '#00d062';

  const sideBar = document.createElement('div');
  Object.assign(sideBar.style, {
    width: '3px',
    backgroundColor: accentColor,
    flexShrink: '0',
  });
  toast.appendChild(sideBar);

  const innerContent = document.createElement('div');
  Object.assign(innerContent.style, {
    padding: '10px 14px 12px', // Add slightly more bottom padding to accommodate progress bar
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    flex: '1',
    minWidth: '0',
  });

  const statusRow = document.createElement('div');
  Object.assign(statusRow.style, {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    fontFamily: "Consolas, Menlo, Monaco, 'JetBrains Mono', monospace",
    fontSize: '9px',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: accentColor,
  });
  statusRow.textContent = isDropdown ? '⚠ Warning' : '✓ Copied';
  innerContent.appendChild(statusRow);

  const codeRow = document.createElement('div');
  Object.assign(codeRow.style, {
    fontFamily: "Consolas, Menlo, Monaco, 'JetBrains Mono', monospace",
    fontSize: '11px',
    lineHeight: '1.4',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    color: '#f2f2f0',
  });
  codeRow.innerHTML = highlightInline(text);
  innerContent.appendChild(codeRow);

  if (isDropdown) {
    const warnRow = document.createElement('div');
    Object.assign(warnRow.style, {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '9px',
      color: '#ffa657',
      marginTop: '2px',
      fontWeight: '500',
    });
    warnRow.textContent = 'Dropdown not opened — Shift+click opens it so you can pick inside';
    innerContent.appendChild(warnRow);
  }

  toast.appendChild(innerContent);

  // Add progress bar
  const progressBar = document.createElement('div');
  Object.assign(progressBar.style, {
    position: 'absolute',
    bottom: '0',
    left: '0',
    height: '2px',
    backgroundColor: accentColor,
    width: '100%',
    transition: 'width 2800ms linear',
  });
  toast.appendChild(progressBar);

  document.documentElement.appendChild(toast);

  // Trigger smooth transition
  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateX(0) scale(1)';
    progressBar.style.width = '0%';
  });

  // Auto dismiss
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(30px) scale(0.96)';
    setTimeout(() => toast.remove(), 250);
  }, 2800);
}

// --- Message listener ---

// Handles every CommandMessage the background relays here (see COMMAND_TYPES
// in messaging.ts). The `never` default makes an unhandled command a compile
// error instead of a silently dropped message.
chrome.runtime.onMessage.addListener((message: CommandMessage, _sender, sendResponse) => {
  switch (message.type) {
    case MESSAGE_TYPES.TOGGLE_PICKER: {
      if (pickerActive) {
        deactivatePicker();
      } else {
        activatePicker();
      }
      const response: CommandResponseMap[typeof MESSAGE_TYPES.TOGGLE_PICKER] = {
        active: pickerActive,
      };
      sendResponse(response);
      return;
    }

    case MESSAGE_TYPES.MULTI_PICK_START: {
      multiPickerActive = true;
      if (!pickerActive) {
        activatePicker();
      }
      const response: CommandResponseMap[typeof MESSAGE_TYPES.MULTI_PICK_START] = {
        active: pickerActive,
        multi: true,
      };
      sendResponse(response);
      return;
    }

    case MESSAGE_TYPES.MULTI_PICK_STOP: {
      deactivatePicker();
      const response: CommandResponseMap[typeof MESSAGE_TYPES.MULTI_PICK_STOP] = {
        active: false,
      };
      sendResponse(response);
      return;
    }

    case MESSAGE_TYPES.GET_PICKER_STATE: {
      const response: CommandResponseMap[typeof MESSAGE_TYPES.GET_PICKER_STATE] = {
        active: pickerActive,
        multi: multiPickerActive,
      };
      sendResponse(response);
      return;
    }

    default: {
      const unhandled: never = message;
      return unhandled;
    }
  }
});
