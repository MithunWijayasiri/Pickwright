import { useState, useEffect } from 'react';
import { MESSAGE_TYPES, Message } from '../shared/messaging';
import { getHistory, clearHistory, HistoryEntry } from '../shared/storage';
import {
  getSettings,
  setSettings,
  Settings,
  HistoryMode,
  DEFAULT_SETTINGS,
} from '../shared/settings';
import { getStrategy, highlight } from './locatorUtils';
import {
  CrosshairsIcon,
  StopIcon,
  CopyIcon,
  CheckIcon,
  HistoryIcon,
  GitHubIcon,
  SettingsIcon,
  BackIcon,
} from './icons';

const MAX_HISTORY = 20;

type Theme = 'dark' | 'light';
type View = 'main' | 'settings';

const getInitialTheme = (): Theme =>
  localStorage.getItem('pw-theme') === 'light' ? 'light' : 'dark';

const Segmented = <T extends string>({
  value,
  options,
  onChange,
  label,
  desc,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (next: T) => void;
  label: string;
  desc: string;
}) => (
  <div className="set-row">
    <div className="set-text">
      <div className="set-label">{label}</div>
      <div className="set-desc">{desc}</div>
    </div>
    <div className="seg" role="radiogroup" aria-label={label}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="radio"
          aria-checked={value === opt.value}
          className={`seg-btn${value === opt.value ? ' on' : ''}`}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  </div>
);

const App = () => {
  const [pickerActive, setPickerActive] = useState(false);
  const [lastLocator, setLastLocator] = useState<string | null>(null);
  const [lastTag, setLastTag] = useState<string>('');
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [copiedTs, setCopiedTs] = useState<number | null>(null);
  const [copiedLocator, setCopiedLocator] = useState(false);
  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  const [view, setView] = useState<View>('main');
  const [settings, setSettingsState] = useState<Settings>(DEFAULT_SETTINGS);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const applyTheme = (next: Theme) => {
    localStorage.setItem('pw-theme', next);
    setTheme(next);
  };

  const updateSetting = async (patch: Partial<Settings>) => {
    const prev = settings;
    const optimistic = { ...prev, ...patch };
    setSettingsState(optimistic);
    try {
      await setSettings(patch);
    } catch {
      setSettingsState(prev);
      return;
    }
    // Turning history off wipes existing entries and hides the section.
    if (patch.historyMode === 'off') {
      clearHistory();
      setHistory([]);
    }
  };

  useEffect(() => {
    getSettings()
      .then(setSettingsState)
      .catch(() => setSettingsState(DEFAULT_SETTINGS));
    chrome.runtime.sendMessage({ type: MESSAGE_TYPES.GET_PICKER_STATE }, (response) => {
      if (response?.active) setPickerActive(true);
    });
    // Restore history and the most-recent pick as the result card (the popup is
    // usually closed when the pick happens, so this rebuilds the result state).
    getHistory().then((h) => {
      setHistory(h);
      if (h[0]) {
        setLastLocator(h[0].locator);
        setLastTag(h[0].tag);
      }
    });

    const listener = (message: Message) => {
      if (message.type === MESSAGE_TYPES.PICKER_STATE_CHANGED) {
        setPickerActive(message.payload.active);
      }
      if (message.type === MESSAGE_TYPES.ELEMENT_SELECTED) {
        // Live update if the popup happens to be open. The background worker
        // owns persistence — re-read storage to stay in sync.
        setLastLocator(message.payload.locator);
        setLastTag(message.payload.tag);
        setPickerActive(false);
        // Delay to let the background worker finish writing to storage before reading.
        setTimeout(() => getHistory().then(setHistory), 200);
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

  const togglePicker = () => {
    chrome.runtime.sendMessage({ type: MESSAGE_TYPES.TOGGLE_PICKER }, (response) => {
      if (response) {
        setPickerActive(response.active);
        if (response.active) {
          window.close();
        }
      }
    });
  };

  // Copy the locator shown in the result card. Uses lastLocator directly so it
  // stays correct during the ~200ms window before history catches up after a pick.
  const copyLocator = async (locator: string) => {
    try {
      await navigator.clipboard.writeText(locator);
      setCopiedLocator(true);
      setTimeout(() => setCopiedLocator(false), 1000);
    } catch {
      // Clipboard may be unavailable; ignore.
    }
  };

  const copyRow = async (entry: HistoryEntry) => {
    try {
      await navigator.clipboard.writeText(entry.locator);
      setCopiedTs(entry.timestamp);
      setTimeout(() => setCopiedTs((cur) => (cur === entry.timestamp ? null : cur)), 1000);
    } catch {
      // Clipboard may be unavailable; ignore.
    }
  };

  const result = lastLocator ? getStrategy(lastLocator) : null;

  return (
    <div className="pw">
      <header className="hd">
        {view === 'settings' ? (
          <>
            <button
              className="hd-btn"
              onClick={() => setView('main')}
              title="Back"
              aria-label="Back"
            >
              <BackIcon />
            </button>
            <span className="hd-name">Settings</span>
          </>
        ) : (
          <>
            <span className="hd-name">
              <span className="n1">Pick</span>
              <span className="n2">wright</span>
            </span>
            <span className="hd-ver">v{chrome.runtime.getManifest().version}</span>
            <div className="hd-actions">
              <button
                className="hd-btn"
                onClick={() => setView('settings')}
                title="Settings"
                aria-label="Settings"
              >
                <SettingsIcon />
              </button>
              <a
                className="hd-gh"
                href="https://github.com/MithunWijayasiri/Pickwright"
                target="_blank"
                rel="noopener noreferrer"
                title="View on GitHub"
                aria-label="View on GitHub"
              >
                <GitHubIcon />
              </a>
            </div>
          </>
        )}
      </header>

      <div className="body">
        {view === 'settings' ? (
          <div className="settings">
            <Segmented<Theme>
              value={theme}
              options={[
                { value: 'light', label: 'Light' },
                { value: 'dark', label: 'Dark' },
              ]}
              onChange={applyTheme}
              label="Theme"
              desc="Switch between the light and dark color scheme."
            />
            <Segmented<HistoryMode>
              value={settings.historyMode}
              options={[
                { value: 'keep', label: 'Keep' },
                { value: 'autoClear', label: 'Auto-clear' },
                { value: 'off', label: 'Off' },
              ]}
              onChange={(next) => updateSetting({ historyMode: next })}
              label="History"
              desc="Keep saves locators across restarts, Auto-clear wipes them on browser startup, Off stops recording."
            />
          </div>
        ) : (
          <>
        {lastLocator && result && (
          <div className="result">
            <div className="result-top">
              <span className="badge">{result.badge}</span>
              <span className="result-sep">·</span>
              <span className="result-tag">&lt;{lastTag}&gt;</span>
            </div>
            <div
              className="result-code"
              dangerouslySetInnerHTML={{ __html: highlight(lastLocator) }}
            />
            <div className="result-footer">
              <span className="result-hint">last picked</span>
              <button
                className="btn-copy-result"
                onClick={() => copyLocator(lastLocator)}
                title="Copy locator"
              >
                {copiedLocator ? (
                  <><CheckIcon />Copied</>
                ) : (
                  <><CopyIcon />Copy</>
                )}
              </button>
            </div>
          </div>
        )}

        {pickerActive && (
          <div className="banner">
            <span className="banner-dot" />
            <div>
              <div className="banner-title">Pick mode active</div>
              <div className="banner-hint">
                Hover any element on the page, then click to capture.
              </div>
            </div>
          </div>
        )}

        <div className="btn-pick-row">
          {pickerActive ? (
            <button className="btn btn-stop" onClick={togglePicker}>
              <StopIcon />
              Stop picking
            </button>
          ) : (
            <button className="btn btn-primary" onClick={togglePicker}>
              <CrosshairsIcon />
              Pick element
            </button>
          )}
        </div>

        {settings.historyMode !== 'off' &&
          (history.length > 0 ? (
          <div>
            <div className="history-head">
              <span className="history-label">History</span>
              <span className="history-count">
                {history.length} / {MAX_HISTORY}
              </span>
            </div>
            <div className="history-list">
              {history.map((entry) => {
                const strat = getStrategy(entry.locator);
                const isCopied = copiedTs === entry.timestamp;
                return (
                  <div
                    key={entry.timestamp}
                    className="row"
                    role="button"
                    tabIndex={0}
                    onClick={() => copyRow(entry)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') copyRow(entry);
                    }}
                  >
                    <span className={`pill pill-${strat.pill}`}>{strat.pill}</span>
                    <div className="row-main">
                      <div
                        className="row-locator"
                        dangerouslySetInnerHTML={{ __html: highlight(entry.locator) }}
                      />
                      <div className="row-tag">&lt;{entry.tag}&gt;</div>
                    </div>
                    {isCopied ? (
                      <CheckIcon className="row-copy copied" />
                    ) : (
                      <CopyIcon className="row-copy" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="empty">
            <HistoryIcon />
            <p>No locators yet — pick an element to capture its Playwright locator.</p>
          </div>
          ))}
          </>
        )}
      </div>
    </div>
  );
};

export default App;
