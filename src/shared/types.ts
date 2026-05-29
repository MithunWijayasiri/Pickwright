// Shared type definitions

export interface ElementMetadata {
  tagName: string;
  id: string | null;
  classes: string[];
  textContent: string;
  ariaAttributes: Record<string, string>;
  role: string | null;
  placeholder: string | null;
  title: string | null;
  name: string | null;
  formControlName: string | null;
  dataAttributes: Record<string, string>;
  frameSelector: string | null;
}
