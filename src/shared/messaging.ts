// Message types for communication between popup, background, and content scripts

export const MESSAGE_TYPES = {
  TOGGLE_PICKER: 'TOGGLE_PICKER',
  PICKER_STATE_CHANGED: 'PICKER_STATE_CHANGED',
  ELEMENT_SELECTED: 'ELEMENT_SELECTED',
  GET_PICKER_STATE: 'GET_PICKER_STATE',
  MULTI_PICK_TOGGLE: 'MULTI_PICK_TOGGLE',
  MULTI_PICK_STOP: 'MULTI_PICK_STOP',
  MULTI_PICK_STATE_CHANGED: 'MULTI_PICK_STATE_CHANGED',
} as const;

export interface TogglePickerMessage {
  type: typeof MESSAGE_TYPES.TOGGLE_PICKER;
}

export interface PickerStateChangedMessage {
  type: typeof MESSAGE_TYPES.PICKER_STATE_CHANGED;
  payload: { active: boolean; multi?: boolean };
}

export interface GetPickerStateMessage {
  type: typeof MESSAGE_TYPES.GET_PICKER_STATE;
}

export interface ElementSelectedMessage {
  type: typeof MESSAGE_TYPES.ELEMENT_SELECTED;
  payload: {
    locator: string;
    alternatives: string[];
    reasons: string[];
    tag: string;
    textSnippet: string;
    score: number;
    multiPick?: boolean;
  };
}

export interface MultiPickToggleMessage {
  type: typeof MESSAGE_TYPES.MULTI_PICK_TOGGLE;
}

export interface MultiPickStopMessage {
  type: typeof MESSAGE_TYPES.MULTI_PICK_STOP;
}

export interface MultiPickStateChangedMessage {
  type: typeof MESSAGE_TYPES.MULTI_PICK_STATE_CHANGED;
  payload: { active: boolean };
}

export type Message =
  | TogglePickerMessage
  | PickerStateChangedMessage
  | GetPickerStateMessage
  | ElementSelectedMessage
  | MultiPickToggleMessage
  | MultiPickStopMessage
  | MultiPickStateChangedMessage;
