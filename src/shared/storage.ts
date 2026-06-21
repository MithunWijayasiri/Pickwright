// Chrome storage helpers for recent locator history

const STORAGE_KEY = 'pickwright_history';
const MAX_HISTORY = 20;

export interface HistoryEntry {
  url: string;
  timestamp: number;
  locator: string;
  score: number;
  tag: string;
  textSnippet: string;
}

export async function getHistory(): Promise<HistoryEntry[]> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  return result[STORAGE_KEY] ?? [];
}

export async function addToHistory(entry: HistoryEntry): Promise<void> {
  const history = await getHistory();
  history.unshift(entry);
  if (history.length > MAX_HISTORY) {
    history.length = MAX_HISTORY;
  }
  await chrome.storage.local.set({ [STORAGE_KEY]: history });
}

export async function removeFromHistory(timestamp: number): Promise<void> {
  const history = await getHistory();
  const filtered = history.filter((entry) => entry.timestamp !== timestamp);
  await chrome.storage.local.set({ [STORAGE_KEY]: filtered });
}

export async function clearHistory(): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: [] });
}
