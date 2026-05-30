import { test, expect } from './fixtures';

test.describe('Pickwright Chrome Extension E2E Tests', () => {
  test('should toggle picker, hover elements for locators, select, copy to clipboard, and display in history', async ({
    context,
    extensionId,
    serverUrl,
  }) => {
    // 1. Load the mock test page via the local HTTP server
    const page = await context.newPage();
    const testPageUrl = `${serverUrl}/tests/test-page.html`;
    await page.goto(testPageUrl);
    await page.bringToFront();

    // 2. Retrieve background service worker
    let [background] = context.serviceWorkers();
    if (!background) {
      background = await context.waitForEvent('serviceworker');
    }

    // 3. Trigger TOGGLE_PICKER message from background directly to the active tab (our test page).
    // This perfectly mimics clicking the extension button while the test page is focused.
    await background.evaluate(async () => {
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (activeTab && activeTab.id) {
        await chrome.tabs.sendMessage(activeTab.id, { type: 'TOGGLE_PICKER' });
      } else {
        throw new Error('Active tab not found via chrome.tabs.query');
      }
    });

    // 4. Verify picker overlays are attached to the test page
    await expect(page.locator('#pickwright-highlight')).toBeAttached();
    await expect(page.locator('#pickwright-tooltip')).toBeAttached();

    // 5. Test locator generation by hovering over various elements
    
    // Test Case A: getByTestId
    await page.locator('[data-testid="submit-btn"]').hover();
    await expect(page.locator('#pickwright-tooltip')).toHaveText("getByTestId('submit-btn')");

    // Test Case B: getByPlaceholder / Role-fallback
    await page.locator('#username-input').hover();
    await expect(page.locator('#pickwright-tooltip')).toHaveText("getByRole('textbox')");

    // Test Case C: getByLabel / getByRole-with-name
    await page.locator('#email-field').hover();
    await expect(page.locator('#pickwright-tooltip')).toHaveText("getByRole('textbox', { name: 'Email Address' })");

    // Test Case D: getByRole
    await page.locator('#home-link').hover();
    await expect(page.locator('#pickwright-tooltip')).toHaveText("getByRole('link', { name: 'Go Home' })");

    // Test Case E: frameLocator nested iframe element
    const frame = page.frameLocator('#test-iframe');
    await frame.locator('#iframe-btn').hover();
    await expect(page.locator('#pickwright-tooltip')).toHaveText(
      "frameLocator('iframe#test-iframe').getByRole('button', { name: 'Click Frame Button' })"
    );

    // Test Case F: Custom data-* attribute fallback (long text bypasses getByText)
    await page.locator('#datacy-div').hover();
    await expect(page.locator('#pickwright-tooltip')).toHaveText("locator('[data-cy=\"container-box\"]')");

    // Test Case G: Accessible name via aria-label
    await page.locator('#aria-btn').hover();
    await expect(page.locator('#pickwright-tooltip')).toHaveText("getByRole('button', { name: 'Close Dialog' })");

    // Test Case H: Accessible name via title
    await page.locator('#title-btn').hover();
    await expect(page.locator('#pickwright-tooltip')).toHaveText("getByRole('button', { name: 'Information Details' })");

    // Test Case I: Shadow DOM drill-in support
    await page.locator('#shadow-btn').hover();
    await expect(page.locator('#pickwright-tooltip')).toHaveText("getByRole('button', { name: 'Shadow Button' })");

    // Test Case J: Angular Dropdown Trigger (hover checks)
    await page.locator('#dropdown-trigger').hover();
    await expect(page.locator('#pickwright-tooltip')).toHaveText("getByRole('button', { name: 'Select Option' })");

    // 6. Test select/click behavior on Angular Dropdown Trigger to verify the toast warning message
    await page.locator('#dropdown-trigger').click();

    // Verify picker is deactivated
    await expect(page.locator('#pickwright-highlight')).toBeHidden();

    // Verify warning toast notification is displayed on page
    const toast = page.locator('div:has-text("✓ Copied:")');
    await expect(toast).toBeVisible();
    await expect(toast).toContainText("getByRole('button', { name: 'Select Option' })");
    await expect(toast).toContainText("⚠ Dropdown trigger — not opened");

    // Verify locator has been copied to clipboard
    const clipboardContent = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboardContent).toBe("getByRole('button', { name: 'Select Option' })");

    // 7. Verify elements are recorded in history
    const popupPage = await context.newPage();
    await popupPage.goto(`chrome-extension://${extensionId}/popup.html`);

    // Verify history section shows 1 recorded item with the exact locator
    const historyRows = popupPage.locator('.row');
    await expect(historyRows).toHaveCount(1);
    await expect(historyRows.locator('.row-locator')).toContainText("getByRole('button', { name: 'Select Option' })");
  });
});
