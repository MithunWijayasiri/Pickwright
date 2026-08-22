// Message types for communication between popup, background, and content scripts

import { LocatorReason, LocatorStrategy } from '../locator-engine/types';

export const MESSAGE_TYPES = {
  TOGGLE_PICKER: 'TOGGLE_PICKER',
  GET_PICKER_STATE: 'GET_PICKER_STATE',
  MULTI_PICK_START: 'MULTI_PICK_START',
  MULTI_PICK_STOP: 'MULTI_PICK_STOP',
  PICKER_DEACTIVATED: 'PICKER_DEACTIVATED',
  ELEMENT_SELECTED: 'ELEMENT_SELECTED',
} as const;

export interface TogglePickerMessage {
  type: typeof MESSAGE_TYPES.TOGGLE_PICKER;
}

export interface GetPickerStateMessage {
  type: typeof MESSAGE_TYPES.GET_PICKER_STATE;
}

export interface MultiPickStartMessage {
  type: typeof MESSAGE_TYPES.MULTI_PICK_START;
}

export interface MultiPickStopMessage {
  type: typeof MESSAGE_TYPES.MULTI_PICK_STOP;
}

// Popup -> content, relayed by background to the active tab (see COMMAND_TYPES).
export type CommandMessage =
  | TogglePickerMessage
  | GetPickerStateMessage
  | MultiPickStartMessage
  | MultiPickStopMessage;

// Single source of truth for which types the background relays; the content
// script's listener switch must handle exactly this set (enforced by its
// exhaustive switch, see picker.ts).
export const COMMAND_TYPES: ReadonlySet<string> = new Set<CommandMessage['type']>([
  MESSAGE_TYPES.TOGGLE_PICKER,
  MESSAGE_TYPES.GET_PICKER_STATE,
  MESSAGE_TYPES.MULTI_PICK_START,
  MESSAGE_TYPES.MULTI_PICK_STOP,
]);

export interface CommandResponseMap {
  [MESSAGE_TYPES.TOGGLE_PICKER]: { active: boolean };
  [MESSAGE_TYPES.GET_PICKER_STATE]: { active: boolean; multi: boolean };
  [MESSAGE_TYPES.MULTI_PICK_START]: { active: boolean; multi: boolean };
  [MESSAGE_TYPES.MULTI_PICK_STOP]: { active: boolean };
}

// Content -> broadcast. Received by background and popup, no direct response.
export interface PickerDeactivatedMessage {
  type: typeof MESSAGE_TYPES.PICKER_DEACTIVATED;
}

export interface ElementSelectedMessage {
  type: typeof MESSAGE_TYPES.ELEMENT_SELECTED;
  payload: {
    locator: string;
    strategy: LocatorStrategy;
    alternatives: string[];
    reasons: LocatorReason[];
    tag: string;
    textSnippet: string;
    multiPick?: boolean;
  };
}

export type BroadcastMessage = PickerDeactivatedMessage | ElementSelectedMessage;

export type Message = CommandMessage | BroadcastMessage;

/** Send a broadcast; the payload is checked against the Message union. */
export function broadcast(message: BroadcastMessage): void {
  chrome.runtime.sendMessage(message);
}

/** Send a popup->content command and resolve its typed response. */
export function sendCommand<T extends CommandMessage['type']>(
  type: T,
): Promise<CommandResponseMap[T] | undefined> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type }, (response: CommandResponseMap[T] | undefined) => {
      resolve(response);
    });
  });
}
