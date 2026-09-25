// Chrome storage helpers for recent locator history. Owns the historyMode
// write-guard and write serialisation so background/popup never touch
// chrome.storage.local for history directly.

import { LocatorReason, LocatorStrategy } from '../locator-engine/types';
import { getSettings } from './settings';

const STORAGE_KEY = 'pickwright_history';
export const MAX_HISTORY = 20;
export const MAX_GROUP_PICKS = 25;

export interface PickedLocator {
  timestamp: number;
  locator: string;
  tag: string;
  textSnippet: string;
  // Absent on entries stored before alternatives/reasons/strategy were captured.
  strategy?: LocatorStrategy;
  alternatives?: string[];
  reasons?: LocatorReason[];
}

export interface SingleEntry extends PickedLocator {
  url: string;
}

// One multi-pick session; timestamp is the first pick's.
export interface GroupEntry {
  url: string;
  timestamp: number;
  sessionId: string;
  picks: PickedLocator[];
}

export type HistoryEntry = SingleEntry | GroupEntry;

export function isGroupEntry(entry: HistoryEntry): entry is GroupEntry {
  return 'picks' in entry;
}

export async function getHistory(): Promise<HistoryEntry[]> {
  const result = await chrome.storage.local.get<Record<string, HistoryEntry[]>>(STORAGE_KEY);
  return result[STORAGE_KEY] ?? [];
}

// Serialises read-modify-write calls below so concurrent multi-pick
// selections can't interleave and drop an entry.
let writeQueue: Promise<void> = Promise.resolve();
function enqueueWrite(write: () => Promise<void>): Promise<void> {
  const result = writeQueue.then(write, write);
  writeQueue = result.catch(() => {});
  return result;
}

// Prepends entry and trims to MAX_HISTORY.
function writeToFront(entry: HistoryEntry, history: HistoryEntry[]): Promise<void> {
  history.unshift(entry);
  if (history.length > MAX_HISTORY) {
    history.length = MAX_HISTORY;
  }
  return chrome.storage.local.set({ [STORAGE_KEY]: history });
}

// addToHistory/addToGroup no-op when historyMode is 'off' — the only place
// that invariant is enforced.
export function addToHistory(entry: SingleEntry): Promise<void> {
  return enqueueWrite(async () => {
    const { historyMode } = await getSettings();
    if (historyMode === 'off') return;
    await writeToFront(entry, await getHistory());
  });
}

// Appends pick to the session's group (created on its first pick) and moves
// the group to the front.
export function addToGroup(sessionId: string, url: string, pick: PickedLocator): Promise<void> {
  return enqueueWrite(async () => {
    const { historyMode } = await getSettings();
    if (historyMode === 'off') return;
    const history = await getHistory();
    const idx = history.findIndex((e) => isGroupEntry(e) && e.sessionId === sessionId);
    const group: GroupEntry =
      idx === -1
        ? { url, timestamp: pick.timestamp, sessionId, picks: [] }
        : (history.splice(idx, 1)[0] as GroupEntry);
    if (group.picks.length >= MAX_GROUP_PICKS) {
      throw new Error(`Multi-pick session ${sessionId} exceeded ${MAX_GROUP_PICKS} picks`);
    }
    group.picks.push(pick);
    await writeToFront(group, history);
  });
}

export function clearHistory(): Promise<void> {
  return enqueueWrite(async () => {
    await chrome.storage.local.set({ [STORAGE_KEY]: [] });
  });
}

// Fires with the new list whenever history changes in chrome.storage.local,
// from this context or another. Replaces polling for post-write freshness.
export function onHistoryChange(callback: (history: HistoryEntry[]) => void): () => void {
  const listener = (changes: Record<string, chrome.storage.StorageChange>, areaName: string) => {
    if (areaName !== 'local') return;
    const change = changes[STORAGE_KEY];
    if (!change) return;
    callback(Array.isArray(change.newValue) ? (change.newValue as HistoryEntry[]) : []);
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}
