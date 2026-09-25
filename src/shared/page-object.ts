// Builds a named locator list from a multi-pick group.

import { PickedLocator } from './storage';

const MAX_NAME_WORDS = 4;

// Last getBy*/locator call and its first string arg (plus getByRole's name),
// skipping any frameLocator(...) prefix.
const CALL_RE =
  /(?:^|\.)(getBy\w+|locator)\('((?:\\.|[^'\\])*)'(?:, \{ name: '((?:\\.|[^'\\])*)' \})?/g;

const TAG_SUFFIX: Record<string, string> = {
  input: 'Input',
  textarea: 'Input',
  select: 'Select',
  button: 'Button',
  a: 'Link',
  img: 'Image',
};

const ROLE_SUFFIX: Record<string, string> = {
  textbox: 'Input',
  searchbox: 'Input',
};

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function words(text: string): string[] {
  return text
    .replace(/\\(.)/g, '$1')
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
    .slice(0, MAX_NAME_WORDS);
}

function camel(parts: string[], suffix: string): string {
  const all =
    parts[parts.length - 1] === suffix.toLowerCase() ? parts : [...parts, suffix.toLowerCase()];
  const name = all
    .filter(Boolean)
    .map((w, i) => (i === 0 ? w : capitalize(w)))
    .join('');
  return /^\p{N}/u.test(name) ? `_${name}` : name;
}

function baseName(pick: PickedLocator): string {
  const tag = pick.tag.toLowerCase();
  const tagSuffix = TAG_SUFFIX[tag] ?? '';
  const match = [...pick.locator.matchAll(CALL_RE)].pop();
  const [, method = 'locator', arg = '', roleName] = match ?? [];

  let name = '';
  if (method === 'getByRole') {
    name = roleName
      ? camel(words(roleName), ROLE_SUFFIX[arg] ?? capitalize(arg))
      : camel(words(arg), '');
  } else if (method === 'getByTestId') {
    name = camel(words(arg), '');
  } else if (method !== 'locator') {
    name = camel(words(arg), tagSuffix);
  } else if (pick.textSnippet.trim()) {
    name = camel(words(pick.textSnippet), tagSuffix);
  }
  return name || `${tag}Element`;
}

// One name per pick, in pick order, deduped with a numeric suffix.
export function locatorNames(picks: PickedLocator[]): string[] {
  const used = new Set<string>();
  return picks.map((pick) => {
    const base = baseName(pick);
    let name = base;
    for (let n = 2; used.has(name); n++) name = `${base}${n}`;
    used.add(name);
    return name;
  });
}

// `<locator>; // <name>` per pick.
export function toLocatorList(picks: PickedLocator[]): string {
  const names = locatorNames(picks);
  return picks.map((pick, i) => `${pick.locator}; // ${names[i]}`).join('\n');
}
