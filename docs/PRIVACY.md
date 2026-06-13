# Privacy Policy for Pickwright

_Last updated: 13 June 2026_

Pickwright ("the extension") is a browser extension that lets you pick page
elements and generate Playwright-friendly locators. Your privacy matters, and
this policy explains exactly what the extension does and does not do with your
data.

## Summary

Pickwright does **not** collect, transmit, sell, or share any personal data.
Everything it does happens locally in your browser. There are no servers,
no analytics, and no tracking.

## What data the extension handles

- **Selection history.** When you pick an element, a history entry is saved to
  your browser's local extension storage (`chrome.storage` / `browser.storage`)
  so you can review it later. Each entry contains: the page URL the element came
  from, a timestamp, the generated locator, its confidence score, the element's
  tag name, and a short snippet of the element's text. Up to 20 entries are
  kept. This data never leaves your device. You can clear it at any time from
  the extension's popup, and it is removed if you uninstall the extension.
- **Clipboard.** When you copy a locator, the extension writes that text to your
  system clipboard using the standard browser clipboard API. It does not read
  your clipboard.
- **Active tab content.** While the picker is active, the extension reads the
  structure of the current page (DOM elements, attributes, text) locally in
  order to compute a locator. This information is processed in memory on your
  device and is never sent anywhere.

## What the extension does NOT do

- It does not make any network requests or contact any external servers.
- It does not use analytics, telemetry, cookies, or tracking of any kind.
- It does not collect personally identifiable information.
- It does not access tabs other than the one you are actively using the picker on.
- It does not sell or transfer any data to third parties.

## Permissions

- **`activeTab`** — lets the extension interact with the page in the currently
  active tab only when you invoke the picker.
- **`storage`** — lets the extension save your selection history locally.

## Data retention and deletion

All data is stored locally in your browser. You remain in full control: clear
the history from the popup, or uninstall the extension to remove all stored data.

## Changes to this policy

If this policy changes, the updated version will be posted at this same location
with a revised "Last updated" date.

## Contact

Questions about this policy can be raised via the project's GitHub repository:
https://github.com/MithunWijayasiri/Pickwright
