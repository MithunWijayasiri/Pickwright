// Locator engine unit tests: one HTML snippet per case, assert the emitted
// locator string. Run via `npm run test:engine` (builds the harness first).
//
// Assert the emitted string, never internal candidate arrays — string
// assertions survive refactors of the candidate pipeline.
// Private helpers (isStableId, isStableClass, ...) are exercised through the
// public API on purpose; adding test-only exports is forbidden by
// .claude/rules/code-hygiene.md.

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

// Group 1 — priority ladder. One case per SCORE rung, asserting the expected
// strategy wins when higher rungs are absent. This is the regression net for
// reordering SCORE in playwright-port.ts.
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
      name: 'nth: role .nth(index) when role alone is ambiguous',
      html: `<button>Same</button><button>Same</button>`,
      pick: 'button:nth-of-type(2)',
      expected: `getByRole('button').nth(1)`,
    },
  ]);
});

// Group 2 — framework-noise filtering. Each case gives the element ONLY a noisy
// identifier, so a leak would show up in the output. Regexes mirror
// isStableId / isStableClass in generate.ts — keep both in sync.
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
