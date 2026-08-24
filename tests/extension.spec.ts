import { test, expect } from './fixtures';
import type { FrameLocator, Page } from '@playwright/test';
import { MESSAGE_TYPES } from '../src/shared/messaging';

// The fixtures (extensionContext/serverUrl/extensionId) are worker-scoped, so a
// single browser is shared across this file. Each test gets a fresh page with
// the picker freshly activated; only the select/history test actually picks an
// element, so history stays empty for the hover-only cases regardless of order.
test.describe('Pickwright Chrome Extension E2E', () => {
  let page: Page;

  test.beforeEach(async ({ extensionContext, serverUrl }) => {
    page = await extensionContext.newPage();
    await page.goto(`${serverUrl}/tests/test-page.html`);
    await page.bringToFront();

    // Toggle the picker by relaying TOGGLE_PICKER from the background worker to
    // the active tab — this mirrors clicking the extension button.
    let [background] = extensionContext.serviceWorkers();
    if (!background) {
      background = await extensionContext.waitForEvent('serviceworker');
    }
    await background.evaluate(async (toggleType) => {
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!activeTab?.id) throw new Error('Active tab not found via chrome.tabs.query');
      await chrome.tabs.sendMessage(activeTab.id, { type: toggleType });
    }, MESSAGE_TYPES.TOGGLE_PICKER);

    await expect(page.locator('#pickwright-highlight')).toBeAttached();
    await expect(page.locator('#pickwright-tooltip')).toBeAttached();
  });

  test.afterEach(async () => {
    await page.close();
  });

  // Hover a target and assert the tooltip shows the expected generated locator.
  async function expectLocatorOnHover(
    selector: string,
    expected: string,
    opts?: { frames?: string[] },
  ): Promise<void> {
    const target = (opts?.frames ?? []).reduce<Page | FrameLocator>(
      (fl, frameSelector) => fl.frameLocator(frameSelector),
      page,
    );
    const locator = target.locator(selector);
    await locator.hover();
    await expect(page.locator('#pickwright-tooltip')).toHaveText(expected);
  }

  test('getByTestId for data-testid elements', async () => {
    await expectLocatorOnHover('[data-testid="submit-btn"]', "getByTestId('submit-btn')");
  });

  test('getByPlaceholder when role is non-unique (two textboxes share the role)', async () => {
    await expectLocatorOnHover('#username-input', "getByPlaceholder('Enter username')");
  });

  test('getByRole with name from associated label', async () => {
    await expectLocatorOnHover('#email-field', "getByRole('textbox', { name: 'Email Address' })");
  });

  test('getByRole with name for links', async () => {
    await expectLocatorOnHover('#home-link', "getByRole('link', { name: 'Go Home' })");
  });

  test('frameLocator prefix for nested same-origin iframe element', async () => {
    await expectLocatorOnHover(
      '#iframe-btn',
      "frameLocator('iframe#test-iframe').getByRole('button', { name: 'Click Frame Button' })",
      { frames: ['#test-iframe'] },
    );
  });

  test('frameLocator escapes a control character in the iframe name', async () => {
    // The newline becomes the CSS hex escape `\a `. Passing that selector back
    // to frameLocator proves it still resolves. The emitted string doubles the
    // backslash because it is a JS string literal the user pastes into code.
    await expectLocatorOnHover(
      '#nl-frame-btn',
      `frameLocator('iframe[name="outer\\\\a frame"]').getByRole('button', { name: 'Newline Frame Button' })`,
      { frames: ['iframe[name="outer\\a frame"]'] },
    );
  });

  test('frameLocator disambiguates duplicate anonymous iframes', async () => {
    // Neither duplicate has id/name/src, so the identifier alone ('iframe')
    // would match both — the emitted selector must still resolve to exactly
    // the frame that was hovered, not the ambiguous ('iframe') string.
    const secondDupFrame = page.locator('iframe').nth(3).contentFrame();
    await secondDupFrame.locator('#dup-frame-btn-2').hover();

    const tooltip = await page.locator('#pickwright-tooltip').textContent();
    const match = tooltip?.match(/^frameLocator\('(.+)'\)\.getByRole/);
    if (!match) throw new Error(`Unexpected tooltip: ${tooltip}`);
    expect(match[1]).not.toBe('iframe');

    const resolved = page.frameLocator(match[1]).locator('#dup-frame-btn-2');
    await expect(resolved).toHaveCount(1);
    await expect(resolved).toHaveText('Dup Frame Button 2');
  });

  test('frameLocator chain composes one segment per nested same-origin iframe level', async () => {
    await expectLocatorOnHover(
      '#nested-btn',
      "frameLocator('iframe#nested-outer-iframe').frameLocator('iframe#nested-inner-iframe').getByRole('button', { name: 'Nested Frame Button' })",
      { frames: ['#nested-outer-iframe', '#nested-inner-iframe'] },
    );
  });

  test('custom data-* CSS fallback when text exceeds the getByText limit', async () => {
    await expectLocatorOnHover('#datacy-div', 'locator(\'[data-cy="container-box"]\')');
  });

  test('accessible name via aria-label', async () => {
    await expectLocatorOnHover('#aria-btn', "getByRole('button', { name: 'Close Dialog' })");
  });

  test('accessible name via title', async () => {
    await expectLocatorOnHover(
      '#title-btn',
      "getByRole('button', { name: 'Information Details' })",
    );
  });

  test('disambiguates a non-unique wrapper via a stable descendant (:has)', async () => {
    // Two ng-select wrappers share every class; only the descendant input id is
    // unique. The CSS fallback must scope each one with :has() to stay distinct.
    await expectLocatorOnHover(
      'ng-select:has(#tenureType-ctrl)',
      "locator('ng-select.simp-form-control.simp-select:has(#tenureType-ctrl)')",
    );
    await expectLocatorOnHover(
      'ng-select:has(#holding-ctrl)',
      "locator('ng-select.simp-form-control.simp-select:has(#holding-ctrl)')",
    );
  });

  test('getByAltText for an image with alt text', async () => {
    await expectLocatorOnHover('#logo-img', "getByAltText('Company Logo')");
  });

  test('getByTitle when only a title attribute identifies the element', async () => {
    await expectLocatorOnHover('#info-icon', "getByTitle('More information')");
  });

  test('chains getByTestId via parent when child testid is non-unique', async () => {
    await expectLocatorOnHover(
      '[data-testid="card-alpha"] [data-testid="card-action"]',
      "getByTestId('card-alpha').getByTestId('card-action')",
    );
  });

  test('retargets a non-interactive icon to its interactive button parent', async () => {
    await expectLocatorOnHover('#save-icon', "getByRole('button', { name: 'Save' })");
  });

  test('prefers a trimmed text alternative that resolves uniquely by substring', async () => {
    await expectLocatorOnHover('#item-row', "getByText('Item')");
  });

  test('retargets across a shadow boundary to an interactive host', async () => {
    await expectLocatorOnHover(
      '#composed-icon',
      "getByRole('button', { name: 'Composed Action' })",
    );
  });

  test('drills into open shadow roots', async () => {
    await expectLocatorOnHover('#shadow-btn', "getByRole('button', { name: 'Shadow Button' })");
  });

  test('Angular dropdown trigger generates a locator without opening it', async () => {
    await expectLocatorOnHover(
      '#dropdown-trigger',
      "getByRole('button', { name: 'Select Option' })",
    );
  });

  test('maps td to the cell role (expanded implicit role map)', async () => {
    await expectLocatorOnHover(
      'td[aria-label="Account balance"]',
      "getByRole('cell', { name: 'Account balance' })",
    );
  });

  test('maps input[type=file] to the button role', async () => {
    await expectLocatorOnHover(
      'input[type="file"]',
      "getByRole('button', { name: 'Upload avatar' })",
    );
  });

  test('maps a text input with a datalist to the combobox role', async () => {
    await expectLocatorOnHover(
      'input[list="pw-colors"]',
      "getByRole('combobox', { name: 'Pick a color' })",
    );
  });

  test('maps footer outside a landmark to the contentinfo role', async () => {
    await expectLocatorOnHover(
      'footer[aria-label="Page footer"]',
      "getByRole('contentinfo', { name: 'Page footer' })",
    );
  });

  test('selects an element: toast, clipboard, and history', async ({
    extensionContext,
    extensionId,
  }) => {
    const expectedLocator = "getByRole('button', { name: 'Select Option' })";

    await page.locator('#dropdown-trigger').click();

    // Picker deactivates on selection.
    await expect(page.locator('#pickwright-highlight')).toBeHidden();

    // Toast confirms the copy and the dropdown-not-opened warning.
    const toast = page.locator('#pickwright-toast');
    await expect(toast).toBeVisible();
    await expect(toast).toContainText(expectedLocator);
    await expect(toast).toContainText('⚠ Warning');
    await expect(toast).toContainText('Dropdown not opened');

    // Clipboard contents (poll to avoid races with the async write).
    await expect
      .poll(() => page.evaluate(() => navigator.clipboard.readText()))
      .toBe(expectedLocator);

    // History records exactly the one element we selected.
    const popupPage = await extensionContext.newPage();
    await popupPage.goto(`chrome-extension://${extensionId}/popup.html`);
    const historyRows = popupPage.locator('.row');
    await expect(historyRows).toHaveCount(1);
    await expect(historyRows.locator('.row-locator')).toContainText(expectedLocator);

    // Turning History off routes the clear through background (CLEAR_HISTORY)
    // rather than popup writing chrome.storage directly — exercises that path.
    await popupPage.getByRole('button', { name: 'Settings' }).click();
    const historyGroup = popupPage.getByRole('radiogroup', { name: 'History' });
    await historyGroup.getByRole('radio', { name: 'Off' }).click();
    await expect(historyRows).toHaveCount(0);

    // Settings persist across this worker-scoped context — restore the default
    // so later tests (e.g. "Pick multiple", disabled when history is off) run
    // against a clean state regardless of file order.
    await historyGroup.getByRole('radio', { name: 'Keep' }).click();

    // With History back on, the section re-renders from storage — count must
    // stay 0 here, proving CLEAR_HISTORY cleared the persisted entry rather
    // than the row just being hidden while off.
    await expect(historyRows).toHaveCount(0);

    await popupPage.close();
  });

  test('popup commands reach the content script through the background relay', async ({
    extensionContext,
    extensionId,
  }) => {
    // extensionContext.newPage() activates the new tab; re-activate the content
    // page before navigating popupPage so its very first GET_PICKER_STATE call
    // (fired on mount) reaches it via the relay's active-tab lookup, not itself.
    const popupPage = await extensionContext.newPage();
    try {
      await page.bringToFront();
      await popupPage.goto(`chrome-extension://${extensionId}/popup.html`);

      // beforeEach activated the picker directly on the content script; stop it
      // here via the real popup -> background -> content TOGGLE_PICKER relay.
      await popupPage.getByRole('button', { name: 'Stop picking' }).click();
      await expect(page.locator('#pickwright-highlight')).toBeHidden();
      await expect(popupPage.getByRole('button', { name: 'Pick element' })).toBeVisible();

      // Start multi-pick through the same relay path.
      await popupPage.getByRole('button', { name: 'Pick multiple' }).click();
      await expect(page.locator('#pickwright-highlight')).toBeAttached();
      await expect(popupPage.getByRole('button', { name: 'Stop picking' })).toBeVisible();

      // Stopping relays MULTI_PICK_STOP; content's PICKER_DEACTIVATED broadcast
      // must reach this same popup instance and reset it back to idle.
      await popupPage.getByRole('button', { name: 'Stop picking' }).click();
      await expect(page.locator('#pickwright-highlight')).toBeHidden();
      await expect(popupPage.getByRole('button', { name: 'Pick element' })).toBeVisible();
    } finally {
      await popupPage.close();
    }
  });
});
