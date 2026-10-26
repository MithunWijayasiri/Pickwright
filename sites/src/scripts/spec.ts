import { getElement, winnerOf } from '../data/demo';

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const TOKEN = /('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")|(\/\/[^\n]*)|\b(await|async|import|from)\b|([A-Za-z_]\w*)(?=\()/g;

/** Wraps strings, comments, keywords and call names in the `.s`, `.cm`, `.kw` and `.fn` spans. */
export function highlight(code: string): string {
  return escapeHtml(code).replace(TOKEN, (_m, str, cm, kw, fn) =>
    str
      ? `<span class="s">${str}</span>`
      : cm
        ? `<span class="cm">${cm}</span>`
        : kw
          ? `<span class="kw">${kw}</span>`
          : `<span class="fn">${fn}</span>`,
  );
}

// The test shown for each picked element.
const TESTS = [
  { name: 'user signs in', keys: ['email', 'password', 'signin'], end: "await expect(page).toHaveURL('/dashboard');" },
  { name: 'login page loads', keys: ['heading'], end: "await expect(page).toHaveTitle('Sign in');" },
  { name: 'user signs in with SSO', keys: ['sso'], end: "await expect(page).toHaveURL('/sso');" },
  { name: 'user opens password reset', keys: ['forgot'], end: "await expect(page).toHaveURL('/reset');" },
];

// Prettier's breaks at a 58-column print width, so every line plus the diff gutter fits the panel.
function step(key: string): string[] {
  const el = getElement(key);
  const loc = winnerOf(el).locator;
  const [single, broken] =
    el.action === 'expect'
      ? [`await expect(page.${loc}).toBeVisible();`, ['await expect(', `  page.${loc},`, ').toBeVisible();']]
      : [`await page.${loc}${el.action};`, ['await page', `  .${loc}`, `  ${el.action};`]];
  return (single.length + 2 <= 58 ? [single] : broken).map((l) => `  ${l}`);
}

const kept = (lines: string[]) => lines.map((l) => `  ${highlight(l)}`).join('\n');

/** A login.spec.ts test with the picked element's step shown as an added diff; returns highlighted HTML. */
export function buildSpec(picked: string): string {
  const test = TESTS.find((t) => t.keys.includes(picked));
  if (!test) throw new Error(`No spec test uses ${picked}`);

  const head = kept(["import { test, expect } from '@playwright/test';", '', `test('${test.name}', async ({ page }) => {`, "  await page.goto('/login');"]);
  const steps = test.keys.map((key) => {
    if (key !== picked) return `${kept(step(key))}\n`;
    const added = step(key).map((l) => `<span class="spec-plus">+</span> ${highlight(l)}`);
    // Block-level, so no newline after it, or it renders as an empty line.
    return `<span class="spec-add">${added.join('\n')}</span>`;
  });
  return `${head}\n${steps.join('')}${kept([`  ${test.end}`, '});'])}`;
}
