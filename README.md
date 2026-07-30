# Pickwright

<p align="center"><img src="docs/pickwright-banner.png" alt="Pickwright banner" /></p>

A Manifest V3 browser extension for **Chrome** and **Firefox** that lets you pick any element on a page and generates a Playwright-friendly locator, ready to paste into your test code.

## Features

- **Element Picker** — hover to highlight, click to select without triggering page actions
- **Playwright Locators** — generates `getByTestId`, `getByRole`, `getByLabel`, `getByPlaceholder`, `getByAltText`, `getByTitle`, `getByText`, `.nth()` and CSS fallback locators
- **Smart Scoring** — ranks candidates by stability, accessibility, and uniqueness
- **Clipboard Copy** — selected locator is instantly copied to clipboard with a toast confirmation
- **Multi-Pick** — **Pick multiple** keeps the picker armed across clicks so you can collect a whole form in one pass, with a live count on the Stop button
- **Recent History** — last 20 locators stored for quick reuse, with a per-entry copy
- **Settings** — light/dark theme, and a history mode of **Keep**, **Auto-clear** (wiped on browser startup) or **Off** (nothing recorded)
- **Angular Support** — detects dropdown triggers and generates stable `formcontrolname` locators (dev-only `ng-reflect-*` attributes are ignored)
- **Dropdown Picking** — hold **Shift** and click to let the page open dropdowns/menus while the picker stays armed, then pick inside
- **Alternatives** — the popup lists up to 3 alternative locators for the last pick, click to copy
- **Keyboard Shortcut** — `Alt+Shift+L` toggles the picker without opening the popup
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

1. Navigate to any webpage (does **not** work on `chrome://`, `chrome-extension://`, or Chrome Web Store pages)
2. Click the **Pickwright** icon in the toolbar
3. Click **Pick element** — the button switches to **Stop picking** and your cursor changes to a crosshair
4. Hover over elements — a blue highlight box follows your cursor with a tag/class tooltip
5. **Click any element** to:
   - Generate the best Playwright locator
   - Copy it to clipboard automatically
   - See a toast confirmation in the bottom-right corner
6. Press **Esc** at any time to cancel picking mode
7. Reopen the popup to see the **last captured locator** plus your **recent history** (scrollable, last 20) — click any entry to recopy it

### Picking several elements

Click **Pick multiple** instead of **Pick element** to stay in picking mode across clicks. Each element you click is copied and added to history, the Stop button shows how many you've collected, and picking ends when you press **Stop picking** or **Esc**. This needs history enabled — the button is disabled while the history mode is **Off**.

### Settings

Open the gear icon in the popup header for:

- **Theme** — Light or Dark.
- **History** — **Keep** stores locators across browser restarts, **Auto-clear** wipes them on browser startup, **Off** records nothing and clears what's already stored.

### Generated Locator Priority

Locators are generated and scored in this order (highest priority first):

| Priority | Strategy | Example |
|----------|----------|---------|
| 1 | `getByTestId` (`data-testid`) | `getByTestId('submit-btn')` |
| 2 | Other test-ID attribute as CSS (`data-test-id`, `data-cy`) | `locator('[data-cy="submit-btn"]')` |
| 3 | `getByRole` + name | `getByRole('button', { name: 'Submit' })` |
| 4 | `getByLabel` | `getByLabel('Email address')` |
| 5 | `getByPlaceholder` | `getByPlaceholder('Search...')` |
| 6 | `getByAltText` | `getByAltText('Company logo')` |
| 7 | `getByText` | `getByText('Sign in')` |
| 8 | `getByTitle` | `getByTitle('Close')` |
| 9 | Angular `formcontrolname` | `locator('[formcontrolname="email"]')` |
| 10 | CSS `#id` (stable ids only) | `locator('#login-form')` |
| 11 | `getByRole` without name | `getByRole('button')` |
| 12 | CSS tag / attribute selector | `locator('input[name="email"]')` |
| 13 | CSS path fallback | `locator('#login-form > button')` |

Every candidate above must match exactly one element to be eligible. `.nth(n)` is a last resort, offered only for a role match that has no accessible name and is ambiguous — it is never appended to the other strategies.

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
3. Create a branch off `master` and make your change — CI runs lint and the E2E suite on every PR.
4. Open a pull request against `master` with a clear description of what changed and why.

Please keep PRs focused and follow the existing code style (enforced via ESLint + Prettier).

### AI-assisted contributions

AI-assisted and AI-generated contributions are welcome. What matters is whether the change is a genuine improvement, not which tools produced it — this project is built with AI assistance itself.

You are still the author of what you submit: be able to explain why the change works, and try it in the browser first. Unreviewed model output — invented APIs, unrelated refactors, rewrites nobody asked for — gets closed regardless of how it was written.

## Privacy

Pickwright performs no off-device collection or transmission — no tracking, no
analytics, no network requests. Your selection history is stored only locally in
the extension's own browser storage, and you choose whether it persists, clears
on startup, or is never recorded. See the full [Privacy Policy](docs/PRIVACY.md).

## License

MIT
