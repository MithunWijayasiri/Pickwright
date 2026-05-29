// Message types for communication between popup, background, and content scripts

export const MESSAGE_TYPES = {
  TOGGLE_PICKER: 'TOGGLE_PICKER',
  PICKER_STATE_CHANGED: 'PICKER_STATE_CHANGED',
  ELEMENT_SELECTED: 'ELEMENT_SELECTED',
  GET_PICKER_STATE: 'GET_PICKER_STATE',
} as const;

export interface TogglePickerMessage {
  type: typeof MESSAGE_TYPES.TOGGLE_PICKER;
}

export interface PickerStateChangedMessage {
  type: typeof MESSAGE_TYPES.PICKER_STATE_CHANGED;
  payload: { active: boolean };
}

export interface GetPickerStateMessage {
  type: typeof MESSAGE_TYPES.GET_PICKER_STATE;
}

export interface ElementSelectedMessage {
  type: typeof MESSAGE_TYPES.ELEMENT_SELECTED;
  payload: {
    locator: string;
    alternatives: string[];
    tag: string;
    textSnippet: string;
    score: number;
  };
}

export type Message =
  | TogglePickerMessage
  | PickerStateChangedMessage
  | GetPickerStateMessage
  | ElementSelectedMessage;
