// One HTML snippet per case, asserting the emitted locator string only — never
// internal candidate arrays, so cases survive refactors of the pipeline. Private
// helpers stay private and are driven through getLocator; no test-only exports.
// Run via `npm run test:engine` (builds the harness first).

import { test, expect, Page } from '@playwright/test';
import path from 'path';

const HARNESS = path.resolve(__dirname, '../../dist/engine-harness.js');

type Case = {
  name: string;
  html: string;
  /** Selector for the element to generate a locator for. */
  pick: string;
  /** Exact expected locator string. */
  expected?: string;
  /** Locator must NOT contain this — used for noise-filter cases, where
   *  pinning the exact CSS fallback would be brittle. */
  expectNot?: RegExp;
};

async function locatorFor(page: Page, html: string, pick: string): Promise<string> {
  await page.setContent(html);
  await page.addScriptTag({ path: HARNESS });
  return page.evaluate((sel) => window.__pickwrightEngine.locatorFor(sel), pick);
}

function run(cases: Case[]) {
  for (const c of cases) {
    test(c.name, async ({ page }) => {
      const actual = await locatorFor(page, c.html, c.pick);
      if (c.expected !== undefined) expect(actual).toBe(c.expected);
      if (c.expectNot) expect(actual).not.toMatch(c.expectNot);
    });
  }
}

// One case per SCORE rung: the named strategy must win when better rungs are
// absent. Regression net for reordering SCORE.
test.describe('priority ladder', () => {
  run([
    {
      name: 'testId: data-testid beats id and text',
      html: `<button id="submit-btn" data-testid="submit">Submit</button>`,
      pick: '[data-testid="submit"]',
      expected: `getByTestId('submit')`,
    },
    {
      name: 'otherTestId: data-test-id emits locator(css), not getByTestId',
      html: `<button data-test-id="save">Save</button>`,
      pick: '[data-test-id="save"]',
      expected: `locator('[data-test-id="save"]')`,
    },
    {
      name: 'otherTestId: data-cy emits locator(css)',
      html: `<button data-cy="cancel">Cancel</button>`,
      pick: '[data-cy="cancel"]',
      expected: `locator('[data-cy="cancel"]')`,
    },
    {
      name: 'roleWithName: beats cssId',
      html: `<button id="submit-btn">Submit</button>`,
      pick: '#submit-btn',
      expected: `getByRole('button', { name: 'Submit' })`,
    },
    {
      name: 'roleWithName: label supplies the accessible name for an input',
      html: `<label for="email">Email</label><input id="email">`,
      pick: '#email',
      expected: `getByRole('textbox', { name: 'Email' })`,
    },
    {
      // Narrow by construction: getAccessibleName() consults the label first, so a
      // labeled element normally wins at roleWithName (100) before label (120) is
      // reached. It takes aria-label diverging from the <label> text, plus a
      // duplicate aria-label, to make role+name non-unique and let label win.
      name: 'label: wins when role+name is ambiguous but the label is not',
      html: `<label for="a">Nickname</label><input id="a" aria-label="Nick"><input id="b" aria-label="Nick">`,
      pick: '#a',
      expected: `getByLabel('Nickname')`,
    },
    {
      name: 'placeholder: beats role-only and css',
      html: `<input placeholder="Search">`,
      pick: 'input',
      expected: `getByPlaceholder('Search')`,
    },
    {
      name: 'altText: img alt beats role-only',
      html: `<img alt="Logo" src="data:,">`,
      pick: 'img',
      expected: `getByAltText('Logo')`,
    },
    {
      name: 'text: visible text beats css fallback',
      html: `<div>Unique text here</div>`,
      pick: 'div',
      expected: `getByText('Unique text here')`,
    },
    {
      name: 'title: wins when there is no text to compete',
      html: `<span title="Info"></span>`,
      pick: 'span',
      expected: `getByTitle('Info')`,
    },
    {
      name: 'formControlName: beats css on the same attribute',
      html: `<input formcontrolname="userEmail">`,
      pick: 'input',
      expected: `locator('[formcontrolname="userEmail"]')`,
    },
    {
      name: 'cssId: stable id wins when nothing semantic exists',
      html: `<div id="wrapper"></div>`,
      pick: '#wrapper',
      expected: `locator('#wrapper')`,
    },
    {
      name: 'roleWithoutName: beats the nth-child css fallback',
      html: `<nav></nav>`,
      pick: 'nav',
      expected: `getByRole('navigation')`,
    },
    {
      // Two inputs make role-only (510) non-unique, so the tag+attribute
      // selector is the lowest-scoring unique candidate ahead of nth (10000).
      name: 'cssTagName: tag + attribute selector when role alone is ambiguous',
      html: `<input name="email"><input name="phone">`,
      pick: 'input[name="email"]',
      expected: `locator('input[name="email"]')`,
    },
    {
      name: 'nth: role .nth(index) when role alone is ambiguous',
      html: `<button>Same</button><button>Same</button>`,
      pick: 'button:nth-of-type(2)',
      expected: `getByRole('button').nth(1)`,
    },
  ]);
});

// Each element gets ONLY a noisy identifier, so a leak shows up in the output.
// Mirrors the isStableId / isStableClass regexes — keep both in sync.
test.describe('noise filtering', () => {
  run([
    {
      name: 'id: mat- prefix rejected',
      html: `<div id="mat-input-3">Name</div>`,
      pick: '#mat-input-3',
      expectNot: /mat-input-3/,
    },
    {
      name: 'id: cdk- prefix rejected',
      html: `<div id="cdk-overlay-7"></div>`,
      pick: '#cdk-overlay-7',
      expectNot: /cdk-overlay-7/,
    },
    {
      name: 'id: ng- prefix rejected',
      html: `<div id="ng-select-5"></div>`,
      pick: '#ng-select-5',
      expectNot: /ng-select-5/,
    },
    {
      name: 'id: colon rejected',
      html: `<div id="form:field"></div>`,
      pick: '[id="form:field"]',
      expectNot: /form:field/,
    },
    {
      name: 'id: GUID-like rejected',
      html: `<div id="f47ac10b-58cc-4372-a567-0e02b2c3d479"></div>`,
      pick: 'div',
      expectNot: /f47ac10b/,
    },
    {
      name: 'class: hashed css- suffix rejected',
      html: `<div class="css-1a2b3c"></div>`,
      pick: '.css-1a2b3c',
      expectNot: /css-1a2b3c/,
    },
    {
      name: 'class: jsx- hash rejected',
      html: `<div class="jsx-1234"></div>`,
      pick: '.jsx-1234',
      expectNot: /jsx-1234/,
    },
    {
      name: 'class: ng- prefix rejected',
      html: `<div class="ng-untouched"></div>`,
      pick: '.ng-untouched',
      expectNot: /ng-untouched/,
    },
    {
      name: 'class: PrimeNG p- prefix rejected',
      html: `<div class="p-dropdown-item"></div>`,
      pick: '.p-dropdown-item',
      expectNot: /p-dropdown-item/,
    },
    {
      name: 'class: _ngcontent rejected',
      html: `<div class="_ngcontent-abc"></div>`,
      pick: '[class="_ngcontent-abc"]',
      expectNot: /_ngcontent/,
    },
    {
      name: 'class: mat-mdc- prefix rejected',
      html: `<div class="mat-mdc-button-base"></div>`,
      pick: '.mat-mdc-button-base',
      expectNot: /mat-mdc-button-base/,
    },
    {
      name: 'data-testid is never noise even next to a framework id',
      html: `<div id="mat-input-3" data-testid="keep"></div>`,
      pick: '[data-testid="keep"]',
      expected: `getByTestId('keep')`,
    },
  ]);
});

// Trimmed alternatives resolve as substrings (Playwright's exact: false), so they
// need substring uniqueness. Pair one with an exact check and the candidate is
// never selectable — the CSS fallback silently wins instead.
test.describe('uniqueness and matcher semantics', () => {
  run([
    {
      name: 'text: trailing number stripped, ancestors excluded from the count',
      html: `<div>Delete 3</div>`,
      pick: 'div',
      expected: `getByText('Delete')`,
    },
    {
      name: 'text: innermost element wins over its wrapper',
      html: `<div><span>Save 42</span></div>`,
      pick: 'span',
      expected: `getByText('Save')`,
    },
    {
      name: 'text: trimmed variant rejected when a sibling shares the substring',
      html: `<div>Delete 3</div><div>Delete 4</div>`,
      pick: 'div:nth-of-type(1)',
      expected: `getByText('Delete 3')`,
    },
    {
      name: 'placeholder: trimmed variant used when it stays unique',
      html: `<input placeholder="Search products 2024">`,
      pick: 'input',
      expected: `getByPlaceholder('Search products')`,
    },
    {
      name: 'placeholder: full value kept when the trimmed one is ambiguous',
      html: `<input placeholder="Search products 2024"><input placeholder="Search products 2025">`,
      pick: 'input:nth-of-type(1)',
      expected: `getByPlaceholder('Search products 2024')`,
    },
    {
      // A div, not a span: substring counts filter by isVisible, and an empty
      // inline element is 0x0, so no trimmed variant can ever be unique on it.
      name: 'title: trimmed variant used when it stays unique',
      html: `<div title="Close panel 2"></div>`,
      pick: 'div',
      expected: `getByTitle('Close panel')`,
    },
    {
      name: 'altText: trimmed variant used when it stays unique',
      html: `<img alt="Logo 2024" src="data:,">`,
      pick: 'img',
      expected: `getByAltText('Logo')`,
    },
    {
      name: 'text: no getByText candidate above TEXT_MAX (50 chars)',
      html: `<div class="notice">This paragraph is far too long to be a sensible text locator</div>`,
      pick: '.notice',
      expectNot: /getByText/,
    },
  ]);
});

// Role counting is visible-only, which is why these need a real browser:
// jsdom's 0x0 rects would make every count wrong.
test.describe('role and accessible name', () => {
  run([
    {
      name: 'name from content for a role in NAME_FROM_CONTENT_ROLES',
      html: `<h2>Dashboard</h2>`,
      pick: 'h2',
      expected: `getByRole('heading', { name: 'Dashboard' })`,
    },
    {
      name: 'no name from content for a role outside that list',
      html: `<p>Some notice</p>`,
      pick: 'p',
      expected: `getByText('Some notice')`,
    },
    {
      name: 'aria-label overrides name from content',
      html: `<button aria-label="Close dialog">&times;</button>`,
      pick: 'button',
      expected: `getByRole('button', { name: 'Close dialog' })`,
    },
    {
      name: 'aria-labelledby resolves through the referenced element',
      html: `<span id="lbl">Email</span><input aria-labelledby="lbl">`,
      pick: 'input',
      expected: `getByRole('textbox', { name: 'Email' })`,
    },
    {
      name: 'implicit role from input type',
      html: `<input type="checkbox" aria-label="Accept terms">`,
      pick: 'input',
      expected: `getByRole('checkbox', { name: 'Accept terms' })`,
    },
    {
      name: 'anchor without href has no link role',
      html: `<a>Learn more</a>`,
      pick: 'a',
      expected: `getByText('Learn more')`,
    },
    {
      // The case a fake DOM cannot express: without layout, the hidden button
      // would count too and role+name would look ambiguous.
      name: 'hidden siblings excluded, so role+name stays unique',
      html: `<button style="display:none">Same</button><button>Same</button>`,
      pick: 'button:nth-of-type(2)',
      expected: `getByRole('button', { name: 'Same' })`,
    },
    {
      name: 'display:none descendant skipped, so the element matches itself (#31)',
      html: `<button><span style="display:none">Hidden </span>Save</button>`,
      pick: 'button',
      expected: `getByRole('button', { name: 'Save' })`,
    },
    {
      name: 'aria-hidden descendant skipped, same self-match rule (#31)',
      html: `<button><span aria-hidden="true">Hidden </span>Save</button>`,
      pick: 'button',
      expected: `getByRole('button', { name: 'Save' })`,
    },
    {
      name: 'text: hidden descendant excluded from getByText, so it matches itself (#31)',
      html: `<div><span style="display:none">Hidden </span>Save</div>`,
      pick: 'div',
      expected: `getByText('Save')`,
    },
    {
      name: 'visibility:hidden skips direct text but includes visibility:visible descendant (#31)',
      html: `<button><span style="visibility:hidden">Hidden <span style="visibility:visible">Save</span></span></button>`,
      pick: 'button',
      expected: `getByRole('button', { name: 'Save' })`,
    },
    {
      name: 'nth not emitted past index 5',
      html: `<button>Same</button><button>Same</button><button>Same</button><button>Same</button><button>Same</button><button>Same</button><button>Same</button>`,
      pick: 'button:nth-of-type(7)',
      expectNot: /\.nth\(/,
    },
  ]);
});
