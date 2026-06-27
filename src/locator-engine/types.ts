// Locator-related type definitions

export type LocatorStrategy =
  | 'getByTestId'
  | 'getByRole'
  | 'getByLabel'
  | 'getByPlaceholder'
  | 'getByText'
  | 'getByAltText'
  | 'getByTitle'
  | 'locator'; // CSS fallback

export interface LocatorReason {
  code: string;
  message: string;
}

export interface LocatorCandidate {
  strategy: LocatorStrategy;
  value: string;
  score: number;
  reason: string;
  unique: boolean;
  /**
   * A CSS selector equivalent usable with querySelectorAll for uniqueness checks.
   * null for strategies that can't be verified via the DOM (role/label/text).
   */
  cssEquivalent: string | null;
  reasons?: LocatorReason[];
}

export interface LocatorResult {
  best: LocatorCandidate;
  alternatives: LocatorCandidate[];
}
