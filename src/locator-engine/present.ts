// Presentation for locator strings/strategies: syntax highlighting, escaping,
// and the strategy-to-pill grouping shown in the popup and content-script toast.
// Single source of truth so a new LocatorStrategy can't render under a stale pill.

import { LocatorStrategy } from './types';

export type PillKind = 'role' | 'testId' | 'label' | 'text' | 'css';

const PILL_BY_STRATEGY: Record<LocatorStrategy, PillKind> = {
  getByRole: 'role',
  getByTestId: 'testId',
  getByLabel: 'label',
  getByPlaceholder: 'text',
  getByText: 'text',
  getByAltText: 'text',
  getByTitle: 'text',
  locator: 'css',
};

export function pillFor(strategy: LocatorStrategy): PillKind {
  return PILL_BY_STRATEGY[strategy];
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

type TokenKind = 'fn' | 'str' | 'key';

function highlightTokens(s: string, render: (kind: TokenKind, text: string) => string): string {
  return escapeHtml(s)
    .replace(/(getBy[A-Za-z]+)/g, (m) => render('fn', m))
    .replace(/('[^']*')/g, (m) => render('str', m))
    .replace(/\b(name|exact|hasText|level)\b(?=\s*:)/g, (m) => render('key', m));
}

/** Class-based highlight for the popup, styled via popup.css's tok-fn/tok-str/tok-key. */
export function highlight(s: string): string {
  return highlightTokens(s, (kind, text) => `<span class="tok-${kind}">${text}</span>`);
}

const INLINE_COLOR: Record<TokenKind, string> = {
  fn: '#79b8ff',
  str: '#00d062',
  key: '#ffa657',
};

/** Inline-styled highlight for the content-script toast, injected into arbitrary host pages. */
export function highlightInline(s: string): string {
  return highlightTokens(
    s,
    (kind, text) => `<span style="color:${INLINE_COLOR[kind]}">${text}</span>`,
  );
}
