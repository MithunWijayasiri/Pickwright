// Chrome storage helpers for recent locator history. Owns the historyMode
// write-guard and write serialisation so background/popup never touch
// chrome.storage.local for history directly.

import { LocatorReason, LocatorStrategy } from '../locator-engine/types';
import { getSettings } from './settings';

const STORAGE_KEY = 'pickwright_history';
export const MAX_HISTORY = 20;

export interface HistoryEntry {
  url: string;
  timestamp: number;
  locator: string;
  tag: string;
  textSnippet: string;
  // Absent on entries stored before alternatives/reasons/strategy were captured.
  strategy?: LocatorStrategy;
  alternatives?: string[];
  reasons?: LocatorReason[];
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

// No-ops when historyMode is 'off' — the only place that invariant is enforced.
export function addToHistory(entry: HistoryEntry): Promise<void> {
  return enqueueWrite(async () => {
    const { historyMode } = await getSettings();
    if (historyMode === 'off') return;
    const history = await getHistory();
    history.unshift(entry);
    if (history.length > MAX_HISTORY) {
      history.length = MAX_HISTORY;
    }
    await chrome.storage.local.set({ [STORAGE_KEY]: history });
  });
}

export function removeFromHistory(timestamp: number): Promise<void> {
  return enqueueWrite(async () => {
    const history = await getHistory();
    const filtered = history.filter((entry) => entry.timestamp !== timestamp);
    await chrome.storage.local.set({ [STORAGE_KEY]: filtered });
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
