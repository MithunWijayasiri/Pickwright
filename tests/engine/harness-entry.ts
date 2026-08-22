// Exposes the engine on `window` so specs can call it inside a real document.
// Emitted only when TEST_HARNESS is set at build time — never ships to users.

import { getLocator } from '../../src/locator-engine';
import { collectMetadata } from '../../src/content/inspect';

declare global {
  interface Window {
    __pickwrightEngine: {
      locatorFor(selector: string): string;
      cssEquivalentFor(selector: string): string | null;
    };
  }
}

window.__pickwrightEngine = {
  // Uses the real collectMetadata so fixtures cannot drift from what picker.ts passes.
  locatorFor(selector: string): string {
    const el = document.querySelector(selector);
    if (!el) throw new Error(`Fixture selector matched nothing: ${selector}`);
    const best = getLocator(el, collectMetadata(el)).best;
    if (!best) throw new Error(`No candidate returned for: ${selector}`);
    return best.value;
  },
  // CSS-shaped winners must resolve to exactly one element (resolve-to-one).
  cssEquivalentFor(selector: string): string | null {
    const el = document.querySelector(selector);
    if (!el) throw new Error(`Fixture selector matched nothing: ${selector}`);
    return getLocator(el, collectMetadata(el)).best.cssEquivalent;
  },
};
