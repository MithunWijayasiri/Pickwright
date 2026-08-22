// Shared type definitions

export interface ElementMetadata {
  tagName: string;
  id: string | null;
  classes: string[];
  textContent: string;
  placeholder: string | null;
  title: string | null;
  alt: string | null;
  name: string | null;
  formControlName: string | null;
  dataAttributes: Record<string, string>;
  // Ordered outer-to-inner frame selector chain; empty when el is in the top document.
  frameSelectors: string[];
}
