import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';

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
    await background.evaluate(async () => {
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!activeTab?.id) throw new Error('Active tab not found via chrome.tabs.query');
      await chrome.tabs.sendMessage(activeTab.id, { type: 'TOGGLE_PICKER' });
    });

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
    opts?: { frame?: string },
  ): Promise<void> {
    const target = opts?.frame
      ? page.frameLocator(opts.frame).locator(selector)
      : page.locator(selector);
    await target.hover();
    await expect(page.locator('#pickwright-tooltip')).toHaveText(expected);
  }

  test('getByTestId for data-testid elements', async () => {
    await expectLocatorOnHover('[data-testid="submit-btn"]', "getByTestId('submit-btn')");
  });

  test('getByRole (role only) when no accessible name', async () => {
    await expectLocatorOnHover('#username-input', "getByRole('textbox')");
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
      { frame: '#test-iframe' },
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

  test('drills into open shadow roots', async () => {
    await expectLocatorOnHover('#shadow-btn', "getByRole('button', { name: 'Shadow Button' })");
  });

  test('Angular dropdown trigger generates a locator without opening it', async () => {
    await expectLocatorOnHover(
      '#dropdown-trigger',
      "getByRole('button', { name: 'Select Option' })",
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
    const toast = page.locator('div:has-text("✓ Copied:")');
    await expect(toast).toBeVisible();
    await expect(toast).toContainText(expectedLocator);
    await expect(toast).toContainText('⚠ Dropdown trigger — not opened');

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
    await popupPage.close();
  });
});
