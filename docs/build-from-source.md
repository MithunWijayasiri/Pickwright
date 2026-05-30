# Build From Source

Most users should install Pickwright from the [Releases page](https://github.com/MithunWijayasiri/Pickwright/releases/latest) — see the [README](../README.md#installation). Build from source only if you want the latest unreleased changes or are developing the extension.

## Step 1 — Clone and build

```bash
git clone https://github.com/MithunWijayasiri/Pickwright.git
cd Pickwright
npm install
npm run build
```

This produces a `dist/` folder — that's the unpacked extension you load into your browser. The same `dist/` works in both Chrome and Firefox.

## Step 2 — Load into Chrome

1. Open Chrome and go to **`chrome://extensions`**
2. Enable **Developer mode** using the toggle in the top-right corner
3. Click **Load unpacked**
4. Select the **`dist/`** folder inside the project (e.g. `C:\Github\Pickwright\dist`)
5. Pickwright appears in your extensions list — pin it via the puzzle-piece icon in the toolbar for easy access

> **Note:** You must reload the extension (`chrome://extensions` → refresh icon) and refresh the target page any time you rebuild.

## Step 2 (alt) — Load into Firefox

1. Open Firefox and go to **`about:debugging#/runtime/this-firefox`**
2. Click **Load Temporary Add-on…**
3. Select the **`dist/manifest.json`** file (not the folder) inside the project
4. Pickwright appears under **Temporary Extensions** and is pinned to the toolbar

> **Note:** Temporary add-ons are removed when Firefox restarts — reload them the same way after each restart. After rebuilding, click **Reload** on the add-on in `about:debugging` and refresh the target page. Requires Firefox 121 or later.

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
