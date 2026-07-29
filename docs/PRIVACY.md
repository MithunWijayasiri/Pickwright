# Privacy Policy for Pickwright

_Last updated: 29 July 2026_

Pickwright ("the extension") lets you pick page elements and generate
Playwright-friendly locators. This policy states what it does and does not do
with your data.

## TL;DR

Pickwright is a free, open-source project. It collects nothing from you: no
accounts, no analytics, no servers to send data to. It asks only for the
permissions it needs to pick an element and save your recent locators, and
everything it stores stays on your computer. The full source is available at
https://github.com/MithunWijayasiri/Pickwright.

## What data the extension handles

- **Selection history.** When you pick an element, the extension saves a history
  entry to your browser's local extension storage (`chrome.storage.local` /
  `browser.storage.local`) so you can review it later. Each entry contains: the
  page URL the element came from, a timestamp, the generated locator, its
  confidence score, the element's tag name, a short snippet of the element's
  text, and (when available) the alternative candidate locators and the reasons
  the chosen locator was preferred. The extension keeps up to 20 entries,
  subject to the retention mode you choose (see "Data retention and deletion"
  below). This data never leaves your device.
- **Clipboard.** When you copy a locator, the extension writes that text to your
  system clipboard using the standard browser clipboard API. It does not read
  your clipboard.
- **Active tab content.** While the picker is active, the extension reads the
  structure of the current page (DOM elements, attributes, text) locally to
  compute a locator. It processes that information in memory on your device and
  does not send it anywhere.

## What the extension does NOT do

- It does not make network requests or contact external servers.
- It does not use analytics, telemetry, cookies, or tracking.
- It does not collect personally identifiable information.
- It does not read data from tabs other than the one you are using the picker
  on.
- It does not sell or transfer data to third parties.

## Content script scope

So that you can toggle the picker from the toolbar icon or the keyboard
shortcut (`Alt+Shift+L`), the extension registers a small content script on all
URLs, running at `document_idle`. Until you activate the picker, that script
only waits for the toggle message. It neither reads nor modifies the page.

## Permissions

- **`activeTab`** — lets the extension interact with the page in the currently
  active tab, only when you invoke the picker.
- **`storage`** — lets the extension save your selection history and settings
  locally, under two keys:
  - `pickwright_history` — the list of history entries, capped at 20.
  - `pickwright_settings` — a single object holding your retention-mode
    preference.

## Data retention and deletion

The extension stores all data locally in your browser, and you control it. The
popup offers three history retention modes:

- **Keep** (default) — history persists across browser restarts, up to 20
  entries, oldest dropped first.
- **Auto-clear** — the extension clears history each time your browser starts.
- **Off** — the extension does not record history, and switching to this mode
  clears any entries already stored.

You can also clear the history manually from the popup at any time, or uninstall
the extension to remove all stored data.

## Changes to this policy

If this policy changes, you will find the updated version at this same location
with a revised "Last updated" date.

## Contact

For questions about this policy, open an issue on the project's GitHub
repository: https://github.com/MithunWijayasiri/Pickwright
