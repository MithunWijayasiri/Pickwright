// One accessible-text rule for both sides of uniqueness counting: the picked
// element (meta.textContent) and every competitor element walked by the engine.
// Skips aria-hidden and display:none subtrees; visibility:hidden skips only
// direct text owned by the hidden element so descendants with
// visibility:visible still contribute (Chromium override).

export function getAccessibleText(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent ?? '';
  }

  if (node.nodeType === Node.ELEMENT_NODE) {
    const el = node as Element;

    if (el.getAttribute('aria-hidden')?.toLowerCase() === 'true') {
      return '';
    }

    try {
      const style = window.getComputedStyle(el);
      if (style.display === 'none') {
        return '';
      }
      if (style.visibility === 'hidden') {
        let text = '';
        for (const child of Array.from(el.childNodes)) {
          if (child.nodeType === Node.ELEMENT_NODE) {
            text += getAccessibleText(child);
          }
        }
        return text;
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
