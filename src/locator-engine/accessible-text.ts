// One accessible-text rule for both sides of uniqueness counting: the picked
// element (meta.textContent) and every competitor element walked by the engine.
// Skips aria-hidden and display:none / visibility:hidden subtrees, so an
// element's computed name matches what Playwright's name-from-content sees.

export function getAccessibleText(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent ?? '';
  }

  if (node.nodeType === Node.ELEMENT_NODE) {
    const el = node as Element;

    if (el.getAttribute('aria-hidden') === 'true') {
      return '';
    }

    try {
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') {
        return '';
      }
    } catch {
      // Fallback for non-window/test contexts
    }

    let text = '';
    for (const child of Array.from(el.childNodes)) {
      text += getAccessibleText(child);
    }
    return text;
  }

  return '';
}
