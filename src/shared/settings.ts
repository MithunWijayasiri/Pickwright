// User settings in chrome.storage.local (background reads them; localStorage is popup-only).

const SETTINGS_KEY = 'pickwright_settings';

// keep: persist across restarts. autoClear: wipe on browser startup. off: never record.
export type HistoryMode = 'keep' | 'autoClear' | 'off';

export interface Settings {
  historyMode: HistoryMode;
}

export const DEFAULT_SETTINGS: Settings = {
  historyMode: 'keep',
};

const isHistoryMode = (value: unknown): value is HistoryMode =>
  value === 'keep' || value === 'autoClear' || value === 'off';

export async function getSettings(): Promise<Settings> {
  const result = await chrome.storage.local.get(SETTINGS_KEY);
  const raw = result[SETTINGS_KEY] ?? {};
  return {
    ...DEFAULT_SETTINGS,
    historyMode: isHistoryMode(raw.historyMode) ? raw.historyMode : DEFAULT_SETTINGS.historyMode,
  };
}

export async function setSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = { ...(await getSettings()), ...patch };
  await chrome.storage.local.set({ [SETTINGS_KEY]: next });
  return next;
}
