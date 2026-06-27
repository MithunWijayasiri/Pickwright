// Pickwright content script — picker orchestration

import { MESSAGE_TYPES, Message } from '../shared/messaging';
import {
  createOverlay,
  removeOverlay,
  updateHighlight,
  hideHighlight,
  isPickerElement,
  TOAST_ID,
} from './overlay';
import {
  collectMetadata,
  getFrameSelector,
  isAngularDropdownTrigger,
  drillIntoShadow,
} from './inspect';
import { getLocator } from '../locator-engine';

let pickerActive = false;
let multiPickerActive = false;
let lastHoveredElement: Element | null = null;
let lastLocatorStr = '';
let pickCount = 0;

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
  pickCount = 0;
  detachListeners();
  removeOverlay();
  document.documentElement.style.cursor = '';
  lastHoveredElement = null;
  lastLocatorStr = '';
}

// --- Event handlers (document capture phase) ---

function onMouseMove(e: MouseEvent): void {
  let clientX = e.clientX;
  let clientY = e.clientY;

  // Translate coordinates if event originated inside a same-origin iframe
  const iframe = e.view && e.view !== window ? (e.view.frameElement as HTMLIFrameElement) : null;
  if (iframe) {
    const rect = iframe.getBoundingClientRect();
    clientX += rect.left;
    clientY += rect.top;
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
    meta.frameSelector = getFrameSelector(el);
    const result = getLocator(el, meta);
    lastLocatorStr = result.best.value;
  }

  // Offset element bounding rect by iframe position if nested
  let elRect = el.getBoundingClientRect();
  const elIframe =
    el.ownerDocument !== document && el.ownerDocument.defaultView?.frameElement
      ? (el.ownerDocument.defaultView.frameElement as HTMLIFrameElement)
      : null;
  if (elIframe) {
    const iframeRect = elIframe.getBoundingClientRect();
    elRect = new DOMRect(
      elRect.left + iframeRect.left,
      elRect.top + iframeRect.top,
      elRect.width,
      elRect.height,
    );
  }

  updateHighlight(elRect, lastLocatorStr, clientX, clientY);
}

function onClick(e: MouseEvent): void {
  // Intercept in capture phase — page never sees this click
  e.stopImmediatePropagation();
  e.preventDefault();

  let clientX = e.clientX;
  let clientY = e.clientY;

  const iframe = e.view && e.view !== window ? (e.view.frameElement as HTMLIFrameElement) : null;
  if (iframe) {
    const rect = iframe.getBoundingClientRect();
    clientX += rect.left;
    clientY += rect.top;
  }

  const el = resolveAt(clientX, clientY);
  if (!el) return;

  const meta = collectMetadata(el);
  meta.frameSelector = getFrameSelector(el);

  const result = getLocator(el, meta);
  const locatorStr = result.best.value;

  copyToClipboard(locatorStr);
  showToast(locatorStr, isAngularDropdownTrigger(el));

  chrome.runtime.sendMessage({
    type: MESSAGE_TYPES.ELEMENT_SELECTED,
    payload: {
      locator: locatorStr,
      alternatives: result.alternatives.map((a) => a.value),
      tag: meta.tagName,
      textSnippet: meta.textContent.slice(0, 40),
      score: result.best.score,
      multiPick: multiPickerActive,
      // TODO: Pass result.best.reasons to payload for explainability feature
    },
  });

  if (!multiPickerActive) {
    deactivatePicker();
  } else {
    pickCount++;
  }
}

function onKeyDown(e: KeyboardEvent): void {
  if (e.key === 'Escape') {
    e.preventDefault();
    e.stopImmediatePropagation();
    const wasMulti = multiPickerActive;
    deactivatePicker();
    chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.PICKER_STATE_CHANGED,
      payload: { active: false, multi: wasMulti },
    });
  }
}

function suppressEvent(e: Event): void {
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

function bindToIframe(frame: HTMLIFrameElement): void {
  try {
    const doc = frame.contentDocument;
    if (doc) {
      // Ensure we don't double-register listeners if bindToIframe is called multiple times
      doc.removeEventListener('mousemove', onMouseMove, true);
      doc.removeEventListener('click', onClick, true);
      doc.removeEventListener('keydown', onKeyDown, true);
      for (const evt of SUPPRESSED_EVENTS) {
        doc.removeEventListener(evt, suppressEvent, true);
      }

      doc.addEventListener('mousemove', onMouseMove, true);
      doc.addEventListener('click', onClick, true);
      doc.addEventListener('keydown', onKeyDown, true);
      for (const evt of SUPPRESSED_EVENTS) {
        doc.addEventListener(evt, suppressEvent, true);
      }
    }
  } catch {
    // Ignore cross-origin frames
  }
}

function unbindFromIframe(frame: HTMLIFrameElement): void {
  try {
    const doc = frame.contentDocument;
    if (doc) {
      doc.removeEventListener('mousemove', onMouseMove, true);
      doc.removeEventListener('click', onClick, true);
      doc.removeEventListener('keydown', onKeyDown, true);
      for (const evt of SUPPRESSED_EVENTS) {
        doc.removeEventListener(evt, suppressEvent, true);
      }
    }
  } catch {
    // Ignore cross-origin frames
  }
}

function attachListeners(): void {
  document.addEventListener('mousemove', onMouseMove, true);
  document.addEventListener('click', onClick, true);
  document.addEventListener('keydown', onKeyDown, true);
  document.addEventListener('load', onIframeLoad, true);
  for (const evt of SUPPRESSED_EVENTS) {
    document.addEventListener(evt, suppressEvent, true);
  }

  // Attach same-origin iframe event handlers for existing iframes
  const frames = document.querySelectorAll('iframe');
  for (const frame of Array.from(frames)) {
    bindToIframe(frame);
  }
}

function detachListeners(): void {
  document.removeEventListener('mousemove', onMouseMove, true);
  document.removeEventListener('click', onClick, true);
  document.removeEventListener('keydown', onKeyDown, true);
  document.removeEventListener('load', onIframeLoad, true);
  for (const evt of SUPPRESSED_EVENTS) {
    document.removeEventListener(evt, suppressEvent, true);
  }

  // Detach same-origin iframe event handlers
  const frames = document.querySelectorAll('iframe');
  for (const frame of Array.from(frames)) {
    unbindFromIframe(frame);
  }
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

  const interactive = el.closest(INTERACTIVE_SELECTOR);
  if (interactive && isElementVisible(interactive)) return interactive;
  return el;
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
      x -= rect.left;
      y -= rect.top;
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

function highlightToInline(s: string): string {
  const escapeHtml = (str: string) =>
    str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return escapeHtml(s)
    .replace(/(getBy[A-Za-z]+)/g, '<span style="color:#79b8ff">$1</span>')
    .replace(/('[^']*')/g, '<span style="color:#00d062">$1</span>')
    .replace(/\b(name|exact|hasText|level)\b(?=\s*:)/g, '<span style="color:#ffa657">$1</span>');
}

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
    transition: 'opacity 250ms cubic-bezier(0.16, 1, 0.3, 1), transform 250ms cubic-bezier(0.16, 1, 0.3, 1)',
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
  codeRow.innerHTML = highlightToInline(text);
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
    warnRow.textContent = 'Dropdown trigger detected (not opened)';
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

chrome.runtime.onMessage.addListener((message: Message, _sender, sendResponse) => {
  if (message.type === MESSAGE_TYPES.TOGGLE_PICKER) {
    if (pickerActive) {
      deactivatePicker();
    } else {
      activatePicker();
    }
    sendResponse({ active: pickerActive });
    return;
  }

  if (message.type === MESSAGE_TYPES.MULTI_PICK_TOGGLE) {
    multiPickerActive = true;
    pickCount = 0;
    if (!pickerActive) {
      activatePicker();
    }
    sendResponse({ active: pickerActive, multi: true });
    return;
  }

  if (message.type === MESSAGE_TYPES.MULTI_PICK_STOP) {
    const count = pickCount;
    deactivatePicker();
    chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.MULTI_PICK_STATE_CHANGED,
      payload: { active: false },
    });
    sendResponse({ active: false, count });
    return;
  }

  if (message.type === MESSAGE_TYPES.GET_PICKER_STATE) {
    sendResponse({ active: pickerActive, multi: multiPickerActive });
    return;
  }
});
