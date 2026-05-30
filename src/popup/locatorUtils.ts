// Derive strategy metadata and syntax highlighting from a Playwright locator string.

export type PillKind = 'role' | 'testId' | 'label' | 'text' | 'css';

export interface StrategyInfo {
  /** Full method name for the result-card badge, e.g. "getByRole". */
  badge: string;
  /** Short, color-coded label for history pills. */
  pill: PillKind;
}

export function getStrategy(locator: string): StrategyInfo {
  const match = locator.match(/getBy([A-Za-z]+)/);
  if (match) {
    const method = `getBy${match[1]}`;
    switch (method) {
      case 'getByRole':
        return { badge: method, pill: 'role' };
      case 'getByTestId':
        return { badge: method, pill: 'testId' };
      case 'getByLabel':
        return { badge: method, pill: 'label' };
      case 'getByPlaceholder':
      case 'getByText':
      case 'getByTitle':
      case 'getByAltText':
        return { badge: method, pill: 'text' };
      default:
        return { badge: method, pill: 'text' };
    }
  }
  return { badge: 'locator', pill: 'css' };
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Wrap function names / strings / option keys in syntax-highlight spans. */
export function highlight(s: string): string {
  return escapeHtml(s)
    .replace(/(getBy[A-Za-z]+)/g, '<span class="tok-fn">$1</span>')
    .replace(/('[^']*')/g, '<span class="tok-str">$1</span>')
    .replace(/\b(name|exact|hasText|level)\b(?=\s*:)/g, '<span class="tok-key">$1</span>');
}
