export interface Tier {
  rank: number;
  name: string;
  pill: string;
}

// Pickwright's real strategy order; lower rank wins.
export const TIERS: Tier[] = [
  { rank: 1, name: 'getByTestId', pill: 'getByTestId' },
  { rank: 2, name: 'test-ID attribute', pill: 'test-id' },
  { rank: 3, name: 'getByRole + name', pill: 'getByRole' },
  { rank: 4, name: 'getByLabel', pill: 'getByLabel' },
  { rank: 5, name: 'getByPlaceholder', pill: 'getByPlaceholder' },
  { rank: 6, name: 'getByAltText', pill: 'getByAltText' },
  { rank: 7, name: 'getByText', pill: 'getByText' },
  { rank: 8, name: 'getByTitle', pill: 'getByTitle' },
  { rank: 9, name: 'formcontrolname', pill: 'formcontrolname' },
  { rank: 10, name: 'CSS #id', pill: 'css id' },
  { rank: 11, name: 'getByRole (no name)', pill: 'getByRole' },
  { rank: 12, name: 'CSS tag / attribute', pill: 'css' },
  { rank: 13, name: 'CSS path', pill: 'css path' },
];

// A string is a unique locator; an object exists but matches several elements.
type TierValue = string | { value: string; matches: number };

export interface DemoElement {
  label: string;
  tag: string;
  name: string;
  // {loc} is replaced with the winning locator.
  spec: string;
  tiers: Partial<Record<number, TierValue>>;
}

export const ELEMENTS = {
  heading: {
    label: 'Sign in heading',
    tag: 'h1',
    name: 'signInHeading',
    spec: 'await expect(page.{loc}).toBeVisible();',
    tiers: {
      3: "getByRole('heading', { name: 'Sign in' })",
      7: { value: "getByText('Sign in')", matches: 2 },
      11: "getByRole('heading')",
      12: "locator('h1')",
      13: "locator('form > h1')",
    },
  },
  email: {
    label: 'Email field',
    tag: 'input',
    name: 'emailInput',
    spec: "await page.{loc}.fill('ada@example.com');",
    tiers: {
      3: "getByRole('textbox', { name: 'Email' })",
      4: "getByLabel('Email')",
      5: "getByPlaceholder('you@company.com')",
      10: "locator('#email')",
      11: "getByRole('textbox')",
      12: 'locator(\'input[name="email"]\')',
      13: "locator('form > div:nth-child(2) > input')",
    },
  },
  password: {
    label: 'Password field',
    tag: 'input',
    name: 'passwordInput',
    spec: "await page.{loc}.fill('hunter2');",
    tiers: {
      4: "getByLabel('Password')",
      10: "locator('#password')",
      12: 'locator(\'input[type="password"]\')',
      13: "locator('form > div:nth-child(3) > input')",
    },
  },
  signin: {
    label: 'Sign in button',
    tag: 'button',
    name: 'signInButton',
    spec: 'await page.{loc}.click();',
    tiers: {
      3: "getByRole('button', { name: 'Sign in' })",
      7: { value: "getByText('Sign in')", matches: 2 },
      11: { value: "getByRole('button')", matches: 2 },
      12: 'locator(\'button[type="submit"]\')',
      13: "locator('form > button:nth-child(4)')",
    },
  },
  sso: {
    label: 'SSO button',
    tag: 'button',
    name: 'ssoBtn',
    spec: 'await page.{loc}.click();',
    tiers: {
      1: "getByTestId('sso-btn')",
      3: "getByRole('button', { name: 'Continue with SSO' })",
      7: "getByText('Continue with SSO')",
      11: { value: "getByRole('button')", matches: 2 },
      12: 'locator(\'button[type="button"]\')',
      13: "locator('form > button:nth-child(5)')",
    },
  },
  forgot: {
    label: 'Forgot password link',
    tag: 'a',
    name: 'forgotYourPasswordLink',
    spec: 'await page.{loc}.click();',
    tiers: {
      3: "getByRole('link', { name: 'Forgot your password?' })",
      7: "getByText('Forgot your password?')",
      11: "getByRole('link')",
      12: 'locator(\'a[href="/reset"]\')',
      13: "locator('form > a')",
    },
  },
} satisfies Record<string, DemoElement>;

export function getElement(key: string): DemoElement {
  const el = (ELEMENTS as Record<string, DemoElement>)[key];
  if (!el) throw new Error(`Unknown demo element: ${key}`);
  return el;
}

interface UniqueLocator {
  tier: Tier;
  locator: string;
}

function uniqueLocators(el: DemoElement): UniqueLocator[] {
  return TIERS.flatMap((tier) => {
    const v = el.tiers[tier.rank];
    return typeof v === 'string' ? [{ tier, locator: v }] : [];
  });
}

export function winnerOf(el: DemoElement): UniqueLocator {
  const [winner] = uniqueLocators(el);
  if (!winner) throw new Error(`No unique locator for ${el.label}`);
  return winner;
}

export function alternativesOf(el: DemoElement): string[] {
  return uniqueLocators(el)
    .slice(1, 3)
    .map((u) => u.locator);
}

export function specLineOf(el: DemoElement): string {
  return el.spec.replace('{loc}', winnerOf(el).locator);
}

export interface TierResult {
  tier: Tier;
  state: 'winner' | 'unique' | 'multi' | 'absent';
  value: string;
  status: string;
}

export function rankTiers(el: DemoElement): TierResult[] {
  const winner = winnerOf(el);
  return TIERS.map((tier) => {
    const v = el.tiers[tier.rank];
    if (v === undefined) {
      return { tier, state: 'absent', value: 'nothing to use', status: '' };
    }
    if (typeof v !== 'string') {
      return { tier, state: 'multi', value: v.value, status: `matches ${v.matches}` };
    }
    return tier.rank === winner.tier.rank
      ? { tier, state: 'winner', value: v, status: 'used' }
      : { tier, state: 'unique', value: v, status: 'also unique' };
  });
}
