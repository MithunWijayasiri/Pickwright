# Pickwright

![Pickwright banner](docs/pickwright-banner.png)

A Manifest V3 Chrome extension that lets you pick any element on a page and generates a Playwright-friendly locator, ready to paste into your test code.

## Features

- **Element Picker** — hover to highlight, click to select without triggering page actions
- **Playwright Locators** — generates `getByTestId`, `getByRole`, `getByLabel`, `getByPlaceholder`, `getByText`, and CSS fallback locators
- **Smart Scoring** — ranks candidates by stability, accessibility, and uniqueness
- **Clipboard Copy** — selected locator is instantly copied to clipboard with a toast confirmation
- **Recent History** — last 20 locators stored for quick reuse
- **Angular Support** — detects dropdown triggers, formcontrolname, and ng-reflect-* attributes without triggering UI changes
- **Shadow DOM** — traverses open shadow roots for accurate element targeting
- **Iframe Support** — fully highlights and selects elements inside same-origin frames (prepends `frameLocator('...')` prefix; cross-origin frames fall back to the frame boundary itself)

## Installation

### Step 1 — Clone and build

```bash
git clone https://github.com/your-org/pickwright.git
cd pickwright
npm install
npm run build
```

This produces a `dist/` folder — that's what you load into Chrome.

### Step 2 — Load into Chrome

1. Open Chrome and go to **`chrome://extensions`**
2. Enable **Developer mode** using the toggle in the top-right corner
3. Click **Load unpacked**
4. Select the **`dist/`** folder inside the project (e.g. `C:\Github\Pickwright\dist`)
5. Pickwright appears in your extensions list — pin it via the puzzle-piece icon in the toolbar for easy access

> **Note:** You must reload the extension (`chrome://extensions` → refresh icon) and refresh the target page any time you rebuild.

## Usage

1. Navigate to any webpage (does **not** work on `chrome://` or `chrome-extension://` pages)
2. Click the **Pickwright** icon in the toolbar
3. Click **Pick element** — the button switches to **Stop picking** and your cursor changes to a crosshair
4. Hover over elements — a blue highlight box follows your cursor with a tag/class tooltip
5. **Click any element** to:
   - Generate the best Playwright locator
   - Copy it to clipboard automatically
   - See a toast confirmation in the bottom-right corner
6. Press **Esc** at any time to cancel picking mode
7. Reopen the popup to see the **last captured locator** plus your **recent history** (scrollable, last 20) — click any entry to recopy it

### Generated Locator Priority

Locators are generated and scored in this order (highest priority first):

| Priority | Strategy | Example |
|----------|----------|---------|
| 1 | `getByTestId` | `getByTestId('submit-btn')` |
| 2 | `getByRole` + name | `getByRole('button', { name: 'Submit' })` |
| 3 | `getByLabel` | `getByLabel('Email address')` |
| 4 | `getByPlaceholder` | `getByPlaceholder('Search...')` |
| 5 | `getByText` | `getByText('Sign in')` |
| 6 | CSS fallback | `locator('#login-form > button')` |

## Development

### Prerequisites

- Node.js 18+
- npm 9+

### Commands

| Command | Description |
|---------|-------------|
| `npm run build` | Production build → `dist/` |
| `npm run dev` | Development build with watch mode |
| `npm run lint` | Run ESLint on source files |
| `npm run format` | Format code with Prettier |
| `npm run test` | Run Playwright E2E tests |

### Development Workflow

1. Run `npm run dev` — webpack watches for changes and rebuilds automatically
2. Edit files in `src/`
3. Go to `chrome://extensions` and click the **refresh icon** on Pickwright
4. Refresh the target page and test

### Automated E2E Testing

The project includes an automated End-to-End (E2E) test suite powered by **Playwright** that verifies the React popup, background relay, content script overlay, locator scoring engine, and iframe parsing.

To execute the tests locally:
1. Install Playwright's Chromium browser (required once):
   ```bash
   npx playwright install chromium
   ```
2. Run the test suite (this automatically builds the extension first):
   ```bash
   npm run test
   ```
The test runs Chromium in headed mode using a persistent profile, mounts the unpacked extension, hosts a local mock HTML test page, and runs all assertions.

## Configuration

### Manifest Permissions

| Permission | Purpose |
|-----------|---------|
| `activeTab` | Access the active tab for element picking |
| `storage` | Persist recent locator history |

### Supported Test ID Attributes

The extension recognizes these as stable "test id"-style attributes:
- `data-testid` (generated as `getByTestId(...)` by default)
- `data-test-id`
- `data-cy`

> **Note:** `data-test-id` and `data-cy` are emitted as `locator('[data-test-id="..."]')` CSS selectors. To use `getByTestId(...)` for these, configure [`testIdAttribute`](https://playwright.dev/docs/api/class-playwrightassertions) in your Playwright config.

## Troubleshooting

### Extension fails to load
- Make sure you selected the `dist/` folder, not the project root
- Run `npm run build` first and confirm it prints `compiled successfully`
- Check `chrome://extensions` for error messages

### Picker doesn't respond to clicks
- **Refresh the target page** after reloading the extension — the old content script stays loaded until the page reloads
- The page must be a regular HTTP/HTTPS URL — `chrome://`, `chrome-extension://`, and the Chrome Web Store block content scripts

### Hover highlight doesn't appear
- Some pages use `pointer-events: none` on their body — the highlight should still appear since it's injected at the `<html>` level
- Check the DevTools console on the page for any CSP errors

### Locator copies but targets wrong element
- If the element is inside a **closed** shadow root, the picker can't traverse into it and will target the shadow host instead
- For cross-origin iframes, only the frame boundary is selectable (same-origin iframes work fully)

### Angular dropdown opens during picking
- This should not happen — all `mousedown`/`pointerdown` events are suppressed at the document capture phase
- If it does, check the console for errors and file an issue with the Angular component details

### Clipboard paste is empty
- Some pages block `navigator.clipboard` via CSP; the extension has a `textarea` execCommand fallback but a strict CSP may block both
- Try pasting immediately after the toast appears

## Browser Compatibility

- Chrome 88+ (Manifest V3)
- Edge 88+ (Chromium-based)
- Other Chromium browsers with MV3 support

## License

MIT
