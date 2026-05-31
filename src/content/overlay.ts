// Overlay rendering for element highlighting (purely visual, pointer-events: none)

const HIGHLIGHT_ID = 'pickwright-highlight';
const TOOLTIP_ID = 'pickwright-tooltip';
export const TOAST_ID = 'pickwright-toast';

let highlight: HTMLDivElement | null = null;
let tooltip: HTMLDivElement | null = null;

export function createOverlay(): void {
  if (document.getElementById(HIGHLIGHT_ID)) return;

  highlight = createElement(HIGHLIGHT_ID, {
    position: 'fixed',
    border: '2px solid #2563eb',
    backgroundColor: 'rgba(37, 99, 235, 0.1)',
    borderRadius: '2px',
    pointerEvents: 'none',
    zIndex: '2147483647',
    display: 'none',
    transition: 'top 50ms, left 50ms, width 50ms, height 50ms',
  });

  tooltip = createElement(TOOLTIP_ID, {
    position: 'fixed',
    background: '#1e293b',
    color: '#fff',
    fontSize: '11px',
    fontFamily: 'monospace',
    padding: '3px 7px',
    borderRadius: '3px',
    pointerEvents: 'none',
    zIndex: '2147483647',
    display: 'none',
    whiteSpace: 'nowrap',
    maxWidth: '300px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  });

  document.documentElement.appendChild(highlight);
  document.documentElement.appendChild(tooltip);
}

export function removeOverlay(): void {
  highlight?.remove();
  tooltip?.remove();
  highlight = null;
  tooltip = null;
}

export function updateHighlight(
  rect: DOMRect,
  label: string,
  mouseX?: number,
  mouseY?: number,
): void {
  if (!highlight || !tooltip) return;

  highlight.style.display = 'block';
  highlight.style.top = `${rect.top}px`;
  highlight.style.left = `${rect.left}px`;
  highlight.style.width = `${rect.width}px`;
  highlight.style.height = `${rect.height}px`;

  tooltip.textContent = label;
  tooltip.style.display = 'block';

  if (mouseX !== undefined && mouseY !== undefined) {
    let left = mouseX + 15;
    let top = mouseY + 15;

    const tooltipWidth = tooltip.offsetWidth || 150;
    const tooltipHeight = tooltip.offsetHeight || 22;

    if (left + tooltipWidth > window.innerWidth) {
      left = mouseX - tooltipWidth - 10;
    }
    if (top + tooltipHeight > window.innerHeight) {
      top = mouseY - tooltipHeight - 10;
    }

    tooltip.style.left = `${Math.max(0, left)}px`;
    tooltip.style.top = `${Math.max(0, top)}px`;
  } else {
    tooltip.style.top = `${Math.max(0, rect.top - 22)}px`;
    tooltip.style.left = `${rect.left}px`;
  }
}

export function hideHighlight(): void {
  if (highlight) highlight.style.display = 'none';
  if (tooltip) tooltip.style.display = 'none';
}

export function isPickerElement(el: Element): boolean {
  return (
    el.id === HIGHLIGHT_ID ||
    el.id === TOOLTIP_ID ||
    el.closest(`#${TOAST_ID}`) !== null
  );
}

function createElement(id: string, styles: Partial<CSSStyleDeclaration>): HTMLDivElement {
  const el = document.createElement('div');
  el.id = id;
  Object.assign(el.style, styles);
  return el;
}
