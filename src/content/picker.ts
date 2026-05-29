// Pickwright content script — picker orchestration

import { MESSAGE_TYPES, Message } from '../shared/messaging';
import {
  createOverlay,
  removeOverlay,
  updateHighlight,
  hideHighlight,
  isPickerElement,
} from './overlay';
import {
  collectMetadata,
  getFrameSelector,
  isAngularDropdownTrigger,
  drillIntoShadow,
} from './inspect';
import { getLocator } from '../locator-engine';

let pickerActive = false;
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
  detachListeners();
  removeOverlay();
  document.documentElement.style.cursor = '';
  lastHoveredElement = null;
  lastLocatorStr = '';
}

// --- Event handlers (document capture phase) ---

function onMouseMove(e: MouseEvent): void {
  const el = resolveAt(e.clientX, e.clientY);
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

  updateHighlight(el.getBoundingClientRect(), lastLocatorStr, e.clientX, e.clientY);
}

function onClick(e: MouseEvent): void {
  // Intercept in capture phase — page never sees this click
  e.stopImmediatePropagation();
  e.preventDefault();

  const el = resolveAt(e.clientX, e.clientY);
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
    },
  });

  deactivatePicker();
}

function onKeyDown(e: KeyboardEvent): void {
  if (e.key === 'Escape') {
    e.preventDefault();
    e.stopImmediatePropagation();
    deactivatePicker();
    chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.PICKER_STATE_CHANGED,
      payload: { active: false },
    });
  }
}

function suppressEvent(e: Event): void {
  e.stopImmediatePropagation();
  if (e.type === 'contextmenu') e.preventDefault();
}

// --- Listener management ---

function attachListeners(): void {
  document.addEventListener('mousemove', onMouseMove, true);
  document.addEventListener('click', onClick, true);
  document.addEventListener('keydown', onKeyDown, true);
  for (const evt of SUPPRESSED_EVENTS) {
    document.addEventListener(evt, suppressEvent, true);
  }
}

function detachListeners(): void {
  document.removeEventListener('mousemove', onMouseMove, true);
  document.removeEventListener('click', onClick, true);
  document.removeEventListener('keydown', onKeyDown, true);
  for (const evt of SUPPRESSED_EVENTS) {
    document.removeEventListener(evt, suppressEvent, true);
  }
}

// --- Element resolution ---

function resolveAt(x: number, y: number): Element | null {
  const el = document.elementFromPoint(x, y);
  if (!el || isPickerElement(el)) return null;
  return drillIntoShadow(el, x, y);
}

// --- Clipboard ---

function copyToClipboard(text: string): void {
  navigator.clipboard.writeText(text).catch(() => {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    Object.assign(textarea.style, { position: 'fixed', opacity: '0', left: '-9999px' });
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    textarea.remove();
  });
}

// --- Toast ---

function showToast(text: string, isDropdown: boolean): void {
  const toast = document.createElement('div');
  Object.assign(toast.style, {
    position: 'fixed',
    bottom: '20px',
    right: '20px',
    background: '#1e293b',
    color: '#fff',
    padding: '10px 16px',
    borderRadius: '8px',
    fontSize: '12px',
    fontFamily: 'monospace',
    zIndex: '2147483647',
    maxWidth: '350px',
    wordBreak: 'break-all',
    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
    opacity: '0',
    transform: 'translateY(8px)',
    transition: 'opacity 150ms, transform 150ms',
    pointerEvents: 'none',
    whiteSpace: 'pre-wrap',
  });

  toast.textContent = isDropdown
    ? `✓ Copied: ${text}\n⚠ Dropdown trigger — not opened`
    : `✓ Copied: ${text}`;

  document.documentElement.appendChild(toast);

  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
  });

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(8px)';
    setTimeout(() => toast.remove(), 200);
  }, 2500);
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

  if (message.type === MESSAGE_TYPES.GET_PICKER_STATE) {
    sendResponse({ active: pickerActive });
    return;
  }
});
