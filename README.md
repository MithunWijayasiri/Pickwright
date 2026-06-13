# Pickwright

<p align="center"><img src="docs/pickwright-banner.png" alt="Pickwright banner" /></p>

A Manifest V3 browser extension for **Chrome** and **Firefox** that lets you pick any element on a page and generates a Playwright-friendly locator, ready to paste into your test code.

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

Grab the latest packages from the [**Releases page**](https://github.com/MithunWijayasiri/Pickwright/releases/latest), then follow the steps for your browser.

### Chrome / Edge

1. Download **`pickwright-chrome-v<version>.zip`** from the [latest release](https://github.com/MithunWijayasiri/Pickwright/releases/latest).
2. Unzip it into a folder you'll keep — the extension loads from this folder, so deleting or moving it removes Pickwright.
3. Open **`chrome://extensions`** (on Edge, **`edge://extensions`**).
4. Turn on **Developer mode** with the toggle in the top-right corner.
5. Click **Load unpacked** and select the unzipped folder.
6. Pin Pickwright via the puzzle-piece icon in the toolbar for one-click access.

### Firefox

1. Download **`pickwright-firefox-v<version>.xpi`** from the [latest release](https://github.com/MithunWijayasiri/Pickwright/releases/latest).
2. Open **`about:addons`** in Firefox.
3. Click the gear icon ⚙ → **Install Add-on From File…** (or simply drag the `.xpi` onto the Firefox window).
4. Select the downloaded `.xpi` and confirm the prompt.

The `.xpi` is signed, so it stays installed across restarts. Requires Firefox 121 or later.

> **Want the latest unreleased changes, or developing the extension?** See [Build From Source](docs/build-from-source.md).

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

## Development & Configuration

Build commands, the development workflow, E2E testing, and configuration details (manifest permissions, supported test-ID attributes) live in [Build From Source](docs/build-from-source.md).

## Troubleshooting

- **Extension fails to load**: Ensure you loaded the compiled `dist/` directory, not the project root. Run `npm run build` first.
- **Picker doesn't activate or highlight**: Refresh the page after reloading the extension. Content scripts are blocked on `chrome://` and Chrome Web Store pages.
- **Wrong element targeted**: Elements inside **closed** shadow roots or cross-origin iframes have restricted access. The picker will target the shadow host or iframe boundary.
- **Clipboard is empty**: If clipboard copy fails, check the page's console for Content Security Policy (CSP) restriction blocks.


## Browser Compatibility

- Chrome 88+ (Manifest V3)
- Edge 88+ (Chromium-based)
- Firefox 121+ (Manifest V3)
- Other Chromium browsers with MV3 support

## Contributing

Contributions are welcome! To get started:

1. Check the [issues](https://github.com/MithunWijayasiri/Pickwright/issues) for something to work on, or open a new one to discuss your idea first.
2. Fork the repo and set up your dev environment — see [Build From Source](docs/build-from-source.md).
3. Create a branch off `master`, make your change, and run `npm run lint` and `npm run test` before opening a PR.
4. Open a pull request against `master` with a clear description of what changed and why.

Please keep PRs focused and follow the existing code style (enforced via ESLint + Prettier).

## Privacy

Pickwright performs no off-device collection or transmission — no tracking, no
analytics, no network requests. Your selection history is stored only locally in
the extension's own browser storage. See the full [Privacy Policy](docs/PRIVACY.md).

## License

MIT
