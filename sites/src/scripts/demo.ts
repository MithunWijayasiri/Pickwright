import { alternativesOf, getElement, rankGroups, specLineOf, winnerOf } from '../data/demo';
import { buildSpec } from './spec';

const MAX_HISTORY = 20;
const MAX_SESSION = 25;
const MAX_SPEC = 6;
const SHOWN = 4;

type Entry =
  | { id: number; kind: 'single'; key: string }
  | { id: number; kind: 'group'; keys: string[]; open: boolean };

function must<T extends Element>(selector: string, root: ParentNode = document): T {
  const el = root.querySelector<T>(selector);
  if (!el) throw new Error(`Demo markup is missing ${selector}`);
  return el;
}

function h<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

function copy(text: string) {
  navigator.clipboard?.writeText(text).catch(() => {});
}

const page = must<HTMLElement>('#demo-page');
const hl = must<HTMLElement>('#demo-hl');
const tip = must<HTMLElement>('#demo-tip');
const tipTag = must<HTMLElement>('#demo-tip-tag');
const tipLoc = must<HTMLElement>('#demo-tip-loc');
const toast = must<HTMLElement>('#demo-toast');
const pickables = page.querySelectorAll<HTMLElement>('[data-key]');

const ppPill = must<HTMLElement>('#pp-pill');
const ppTag = must<HTMLElement>('#pp-tag');
const ppMethod = must<HTMLElement>('#pp-method');
const ppArgs = must<HTMLElement>('#pp-args');
const ppAlts = must<HTMLElement>('#pp-alts');
const ppCopy = must<HTMLButtonElement>('#pp-copy');
const ppMulti = must<HTMLElement>('#pp-multi');
const ppNotice = must<HTMLElement>('#pp-notice');
const ppAction = must<HTMLButtonElement>('#pp-action');
const ppActionIcon = must<SVGElement>('#pp-action-icon');
const ppActionLabel = must<HTMLElement>('#pp-action-label');
const ppActionCount = must<HTMLElement>('#pp-action-count');
const ppHist = must<HTMLElement>('#pp-hist');
const ppHistCount = must<HTMLElement>('#pp-hist-count');

const rankLabel = must<HTMLElement>('#rank-label');
const rankRows = document.querySelectorAll<HTMLElement>('#rank-list > li');
const specCode = must<HTMLElement>('#spec-code');

let nextId = 1;
const state = {
  selected: 'signin',
  history: [{ id: nextId++, kind: 'single', key: 'signin' }] as Entry[],
  session: null as string[] | null,
  specPicks: ['signin'],
  copied: false,
  copiedGroup: null as number | null,
  notice: null as string | null,
};

let copiedTimer = 0;
let groupTimer = 0;
let noticeTimer = 0;
let toastTimer = 0;

function locatorOf(key: string): string {
  return winnerOf(getElement(key)).locator;
}

function pick(key: string) {
  if (state.session?.includes(key)) {
    toast.textContent = 'Already picked';
    toast.setAttribute('data-on', '');
    clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.removeAttribute('data-on'), 1600);
    return;
  }
  state.selected = key;
  state.copied = false;
  if (state.session) {
    state.session.push(key);
  } else {
    state.history = [{ id: nextId++, kind: 'single' as const, key }, ...state.history].slice(0, MAX_HISTORY);
  }
  state.specPicks = [...state.specPicks, key].slice(-MAX_SPEC);
  render();
}

function startMulti() {
  clearTimeout(noticeTimer);
  state.notice = null;
  state.session = [];
  render();
}

function stopMulti() {
  const keys = state.session ?? [];
  state.session = null;
  if (keys.length) {
    state.history = [{ id: nextId++, kind: 'group' as const, keys, open: true }, ...state.history].slice(0, MAX_HISTORY);
    state.notice = `Saved ${plural(keys.length, 'locator')} as one group.`;
    clearTimeout(noticeTimer);
    noticeTimer = window.setTimeout(() => {
      state.notice = null;
      render();
    }, 2500);
  }
  render();
}

function flashCopied() {
  state.copied = true;
  clearTimeout(copiedTimer);
  copiedTimer = window.setTimeout(() => {
    state.copied = false;
    render();
  }, 1500);
  render();
}

function flashGroup(id: number) {
  state.copiedGroup = id;
  clearTimeout(groupTimer);
  groupTimer = window.setTimeout(() => {
    state.copiedGroup = null;
    render();
  }, 1500);
  render();
}

const CHEVRON =
  '<svg class="pp-chev" width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 4.5 6 8l3.5-3.5"></path></svg>';

function pill(text: string) {
  return h('span', 'pp-pill', text);
}

function singleRow(key: string): HTMLLIElement {
  const el = getElement(key);
  const win = winnerOf(el);
  const li = h('li');
  const row = h('div', 'pp-single');
  const text = h('div', 'pp-single-text');
  const loc = h('div', 'pp-single-loc', win.locator);
  loc.title = win.locator;
  text.append(loc, h('div', 'pp-single-tag', `<${el.tag}>`));
  row.append(pill(win.tier.pill), text);
  li.append(row);
  return li;
}

function groupRow(entry: Extract<Entry, { kind: 'group' }>): HTMLLIElement {
  const li = h('li');
  const head = h('div', 'pp-group-head');

  const toggle = h('button', 'pp-toggle');
  toggle.type = 'button';
  toggle.dataset.act = 'toggle';
  toggle.dataset.id = String(entry.id);
  toggle.dataset.focus = `toggle-${entry.id}`;
  toggle.setAttribute('aria-expanded', String(entry.open));
  toggle.append(pill('group'), h('span', undefined, plural(entry.keys.length, 'locator')));
  toggle.insertAdjacentHTML('beforeend', CHEVRON);

  const copyAll = h('button', 'pp-copyall', state.copiedGroup === entry.id ? 'Copied' : 'Copy all');
  copyAll.type = 'button';
  copyAll.dataset.act = 'copy-all';
  copyAll.dataset.id = String(entry.id);
  copyAll.dataset.focus = `copyall-${entry.id}`;

  head.append(toggle, copyAll);
  li.append(head);

  const picks = h('ul', 'pp-picks');
  picks.setAttribute('role', 'list');
  picks.hidden = !entry.open;
  for (const key of entry.keys) {
    const item = h('li');
    const loc = h('div', 'pp-pick-loc', locatorOf(key));
    loc.title = locatorOf(key);
    item.append(loc, h('div', 'pp-pick-name', `// ${getElement(key).name}`));
    picks.append(item);
  }
  li.append(picks);
  return li;
}

function renderHistory() {
  const focused = (document.activeElement as HTMLElement | null)?.dataset.focus;
  const rows = state.history.slice(0, SHOWN).map((e) => (e.kind === 'single' ? singleRow(e.key) : groupRow(e)));
  if (rows.length) {
    ppHist.replaceChildren(...rows);
  } else {
    ppHist.replaceChildren(h('li', 'pp-empty', 'No locators yet. Click an element in the page.'));
  }
  ppHistCount.textContent = `${state.history.length}/${MAX_HISTORY}`;
  if (focused) ppHist.querySelector<HTMLElement>(`[data-focus="${focused}"]`)?.focus();
}

function render() {
  const el = getElement(state.selected);
  const win = winnerOf(el);

  pickables.forEach((p) => p.classList.toggle('picked', p.dataset.key === state.selected));

  // Result
  const paren = win.locator.indexOf('(');
  ppPill.textContent = win.tier.pill;
  ppTag.textContent = `<${el.tag}>`;
  ppMethod.textContent = win.locator.slice(0, paren);
  ppArgs.textContent = win.locator.slice(paren);
  ppAlts.replaceChildren(...alternativesOf(el).map((a) => h('li', undefined, a)));
  ppCopy.textContent = state.copied ? 'Copied' : 'Copy';

  // Banner and action
  const multi = state.session !== null;
  ppMulti.hidden = !multi;
  ppNotice.textContent = state.notice ?? '';
  ppActionIcon.toggleAttribute('hidden', multi);
  ppActionLabel.textContent = multi ? 'Stop picking' : 'Pick multiple';
  ppActionCount.hidden = !multi;
  ppActionCount.textContent = `${state.session?.length ?? 0}/${MAX_SESSION}`;

  renderHistory();

  // Ranking
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

  specCode.innerHTML = buildSpec(state.specPicks.map((k) => specLineOf(getElement(k))));
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

// Popup controls
ppCopy.addEventListener('click', () => {
  copy(locatorOf(state.selected));
  flashCopied();
});

ppAction.addEventListener('click', () => (state.session ? stopMulti() : startMulti()));

ppHist.addEventListener('click', (e) => {
  const btn = (e.target as Element).closest<HTMLElement>('[data-act]');
  const entry = state.history.find((x) => String(x.id) === btn?.dataset.id);
  if (!btn || entry?.kind !== 'group') return;
  if (btn.dataset.act === 'toggle') {
    entry.open = !entry.open;
    render();
  } else {
    copy(entry.keys.map((k) => `${locatorOf(k)}; // ${getElement(k).name}`).join('\n'));
    flashGroup(entry.id);
  }
});

render();
