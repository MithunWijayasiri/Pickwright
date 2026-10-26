function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const TOKEN = /('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")|\b(await|async|import|from)\b|([A-Za-z_]\w*)(?=\()/g;

/** Wraps strings, keywords and call names in the `.s`, `.kw` and `.fn` spans. */
export function highlight(code: string): string {
  return escapeHtml(code).replace(TOKEN, (_m, str, kw, fn) =>
    str ? `<span class="s">${str}</span>` : kw ? `<span class="kw">${kw}</span>` : `<span class="fn">${fn}</span>`,
  );
}

/** The login.spec.ts source with the picked lines inserted; returns highlighted HTML. */
export function buildSpec(lines: string[]): string {
  return highlight(
    [
      "import { test, expect } from '@playwright/test';",
      '',
      "test('user signs in', async ({ page }) => {",
      "  await page.goto('/login');",
      ...lines.map((l) => `  ${l}`),
      '});',
    ].join('\n'),
  );
}
