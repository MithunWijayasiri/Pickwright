import { getElement, rankGroups, winnerOf } from '../data/demo';
import { buildSpec } from './spec';

function must<T extends Element>(selector: string, root: ParentNode = document): T {
  const el = root.querySelector<T>(selector);
  if (!el) throw new Error(`Demo markup is missing ${selector}`);
  return el;
}

const page = must<HTMLElement>('#demo-page');
const hl = must<HTMLElement>('#demo-hl');
const tip = must<HTMLElement>('#demo-tip');
const tipTag = must<HTMLElement>('#demo-tip-tag');
const tipLoc = must<HTMLElement>('#demo-tip-loc');
const pickables = page.querySelectorAll<HTMLElement>('[data-key]');

const outPill = must<HTMLElement>('#demo-pill');
const outTag = must<HTMLElement>('#demo-tag');
const outMethod = must<HTMLElement>('#demo-method');
const outArgs = must<HTMLElement>('#demo-args');
const copyBtn = must<HTMLButtonElement>('#demo-copy');

const rankLabel = must<HTMLElement>('#rank-label');
const rankRows = document.querySelectorAll<HTMLElement>('#rank-list > li');
const specCode = must<HTMLElement>('#spec-code');

const state = {
  selected: 'signin',
  copied: false,
};

let copiedTimer = 0;

function pick(key: string) {
  state.selected = key;
  state.copied = false;
  render();
}

function render() {
  const el = getElement(state.selected);
  const win = winnerOf(el);

  pickables.forEach((p) => p.classList.toggle('picked', p.dataset.key === state.selected));

  const paren = win.locator.indexOf('(');
  outPill.textContent = win.tier.pill;
  outTag.textContent = `<${el.tag}>`;
  outMethod.textContent = win.locator.slice(0, paren);
  outArgs.textContent = win.locator.slice(paren);
  copyBtn.textContent = state.copied ? 'Copied' : 'Copy';

  rankLabel.textContent = el.label;
  rankGroups(el).forEach((r, i) => {
    const row = rankRows[i];
    if (!row) throw new Error('Ranking rows do not match the groups');
    row.dataset.state = r.state;
    const val = must<HTMLElement>('.val', row);
    val.textContent = r.value;
    val.title = r.value;
    must<HTMLElement>('.st', row).textContent = r.status;
  });

  specCode.innerHTML = buildSpec(state.selected);
}

// Hover and keyboard-focus highlight
let hovered: HTMLElement | null = null;
let focused: HTMLElement | null = null;

function updateHighlight() {
  const target = hovered ?? focused;
  if (!target) {
    hl.removeAttribute('data-on');
    return;
  }
  const el = getElement(target.dataset.key ?? '');
  const p = page.getBoundingClientRect();
  const r = target.getBoundingClientRect();
  const top = r.top - p.top;
  const left = r.left - p.left;

  if (!hl.hasAttribute('data-on')) hl.style.transitionProperty = 'opacity';
  hl.style.top = `${top}px`;
  hl.style.left = `${left}px`;
  hl.style.width = `${r.width}px`;
  hl.style.height = `${r.height}px`;
  tipTag.textContent = el.tag;
  const loc = winnerOf(el).locator;
  tipLoc.textContent = loc.length > 40 ? `${loc.slice(0, 39)}…` : loc;
  tip.toggleAttribute('data-below', top < 34);
  tip.toggleAttribute('data-end', left + tip.offsetWidth > page.clientWidth);
  hl.setAttribute('data-on', '');
  void hl.offsetWidth;
  hl.style.transitionProperty = '';
}

const pickableFrom = (t: EventTarget | null) => (t as Element | null)?.closest<HTMLElement>('[data-key]') ?? null;

page.addEventListener('mouseover', (e) => {
  hovered = pickableFrom(e.target);
  updateHighlight();
});
page.addEventListener('mouseleave', () => {
  hovered = null;
  updateHighlight();
});
page.addEventListener('focusin', (e) => {
  const t = pickableFrom(e.target);
  focused = t?.matches(':focus-visible') ? t : null;
  updateHighlight();
});
page.addEventListener('focusout', () => {
  focused = null;
  updateHighlight();
});
window.addEventListener('resize', updateHighlight);

page.addEventListener('click', (e) => {
  const key = pickableFrom(e.target)?.dataset.key;
  if (key) pick(key);
});
page.addEventListener('keydown', (e) => {
  // Real buttons already turn Enter and Space into a click.
  if ((e.key !== 'Enter' && e.key !== ' ') || (e.target as Element).tagName === 'BUTTON') return;
  const key = pickableFrom(e.target)?.dataset.key;
  if (!key) return;
  e.preventDefault();
  pick(key);
});

copyBtn.addEventListener('click', async () => {
  await navigator.clipboard.writeText(winnerOf(getElement(state.selected)).locator);
  state.copied = true;
  clearTimeout(copiedTimer);
  copiedTimer = window.setTimeout(() => {
    state.copied = false;
    render();
  }, 1500);
  render();
});

render();
