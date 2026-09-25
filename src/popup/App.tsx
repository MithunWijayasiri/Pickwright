import { useState, useEffect } from 'react';
import { MESSAGE_TYPES, Message, sendCommand, requestClearHistory } from '../shared/messaging';
import {
  getHistory,
  onHistoryChange,
  isGroupEntry,
  HistoryEntry,
  GroupEntry,
  PickedLocator,
  MAX_HISTORY,
  MAX_GROUP_PICKS,
} from '../shared/storage';
import { locatorNames, toLocatorList } from '../shared/page-object';
import {
  getSettings,
  setSettings,
  Settings,
  HistoryMode,
  DEFAULT_SETTINGS,
} from '../shared/settings';
import { pillFor, highlight, LocatorReason, LocatorStrategy } from '../locator-engine';
import {
  CrosshairsIcon,
  StopIcon,
  CopyIcon,
  CheckIcon,
  HistoryIcon,
  GitHubIcon,
  SettingsIcon,
  BackIcon,
  StackIcon,
  ChevronIcon,
} from './icons';

type Theme = 'dark' | 'light';
type View = 'main' | 'settings';

const getInitialTheme = (): Theme =>
  localStorage.getItem('pw-theme') === 'light' ? 'light' : 'dark';

const IS_FIREFOX = chrome.runtime.getURL('').startsWith('moz-extension:');
const REPO_URL = 'https://github.com/MithunWijayasiri/Pickwright';
const STORE_URL = IS_FIREFOX
  ? 'https://addons.mozilla.org/en-US/firefox/addon/pickwright/'
  : 'https://chromewebstore.google.com/detail/pickwright-playwright-loc/kgikopoehffaodbicnhajokkmhgjofjo';

// Firefox-only API, missing from @types/chrome; Chrome has no equivalent, so it opens the page directly.
const openShortcutSettings = () => {
  const commands = chrome.commands as typeof chrome.commands & {
    openShortcutSettings?: () => Promise<void>;
  };
  if (commands.openShortcutSettings) {
    commands.openShortcutSettings();
  } else {
    chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
  }
};

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
  const [multiPickerActive, setMultiPickerActive] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [lastLocator, setLastLocator] = useState<string | null>(null);
  const [lastStrategy, setLastStrategy] = useState<LocatorStrategy | null>(null);
  const [lastTag, setLastTag] = useState<string>('');
  const [lastAlternatives, setLastAlternatives] = useState<string[]>([]);
  const [lastReasons, setLastReasons] = useState<LocatorReason[]>([]);
  const [copiedAltIdx, setCopiedAltIdx] = useState<number | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [copiedTs, setCopiedTs] = useState<number | null>(null);
  const [copiedGroup, setCopiedGroup] = useState<string | null>(null);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [copiedLocator, setCopiedLocator] = useState(false);
  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  const [view, setView] = useState<View>('main');
  const [settings, setSettingsState] = useState<Settings>(DEFAULT_SETTINGS);
  const [shortcut, setShortcut] = useState('');

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
    // Routed through background (see ClearHistoryMessage) so the write shares
    // its writeQueue with addToHistory; onHistoryChange picks up the result.
    if (patch.historyMode === 'off') {
      // Multi-pick needs history; stopping copies the session before the clear.
      if (multiPickerActive) {
        await stopMultiPick();
      }
      requestClearHistory();
    }
  };

  useEffect(() => {
    getSettings()
      .then(setSettingsState)
      .catch(() => setSettingsState(DEFAULT_SETTINGS));
    // Empty string when the user has unbound the shortcut.
    chrome.commands.getAll((commands) => {
      setShortcut(commands.find((c) => c.name === 'toggle-picker')?.shortcut ?? '');
    });
    sendCommand(MESSAGE_TYPES.GET_PICKER_STATE).then((response) => {
      if (response?.active) {
        setPickerActive(true);
        if (response.multi) {
          setMultiPickerActive(true);
          setActiveSessionId(response.sessionId ?? null);
          setExpandedGroup(response.sessionId ?? null);
        }
      }
    });
    // Restore history and the most-recent pick as the result card (the popup is
    // usually closed when the pick happens, so this rebuilds the result state).
    getHistory().then((h) => {
      setHistory(h);
      const last = h[0] && (isGroupEntry(h[0]) ? h[0].picks[h[0].picks.length - 1] : h[0]);
      if (last) {
        setLastLocator(last.locator);
        setLastStrategy(last.strategy ?? 'locator');
        setLastTag(last.tag);
        setLastAlternatives(last.alternatives ?? []);
        setLastReasons(last.reasons ?? []);
      }
    });

    const listener = (message: Message) => {
      if (message.type === MESSAGE_TYPES.PICKER_DEACTIVATED) {
        setPickerActive(false);
        setMultiPickerActive(false);
        setActiveSessionId(null);
      }
      if (message.type === MESSAGE_TYPES.ELEMENT_SELECTED) {
        setLastLocator(message.payload.locator);
        setLastStrategy(message.payload.strategy);
        setLastTag(message.payload.tag);
        setLastAlternatives(message.payload.alternatives);
        setLastReasons(message.payload.reasons ?? []);
        // History list itself updates via the onHistoryChange subscription below.
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    const unsubscribeHistory = onHistoryChange(setHistory);
    return () => {
      chrome.runtime.onMessage.removeListener(listener);
      unsubscribeHistory();
    };
  }, []);

  // Deactivation-path state resets come from the PICKER_DEACTIVATED broadcast
  // (see the listener above), not from these commands' responses.
  const togglePicker = () => {
    sendCommand(MESSAGE_TYPES.TOGGLE_PICKER).then((response) => {
      if (response?.active) {
        setPickerActive(true);
        window.close();
      }
    });
  };

  const startMultiPick = () => {
    sendCommand(MESSAGE_TYPES.MULTI_PICK_START).then((response) => {
      if (response) {
        setPickerActive(response.active);
        setMultiPickerActive(response.multi);
        setActiveSessionId(response.sessionId ?? null);
        // The session's group appears expanded on its first pick.
        setExpandedGroup(response.sessionId ?? null);
        // Don't close popup — show stop button + count
      }
    });
  };

  const stopMultiPick = async () => {
    const copyText = (await sendCommand(MESSAGE_TYPES.MULTI_PICK_STOP))?.copyText;
    if (!copyText) return;
    try {
      await navigator.clipboard.writeText(copyText);
    } catch {
      // Clipboard may be unavailable; ignore.
      return;
    }
    const count = copyText.split('\n').length;
    setNotice(`Copied ${count} locator${count === 1 ? '' : 's'}`);
    setTimeout(() => setNotice(null), 2500);
  };

  const activePickCount =
    history.find((e): e is GroupEntry => isGroupEntry(e) && e.sessionId === activeSessionId)?.picks
      .length ?? 0;

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

  const copyAlt = async (locator: string, idx: number) => {
    try {
      await navigator.clipboard.writeText(locator);
      setCopiedAltIdx(idx);
      setTimeout(() => setCopiedAltIdx((cur) => (cur === idx ? null : cur)), 1000);
    } catch {
      // Clipboard may be unavailable; ignore.
    }
  };

  const copyRow = async (entry: PickedLocator) => {
    try {
      await navigator.clipboard.writeText(entry.locator);
      setCopiedTs(entry.timestamp);
      setTimeout(() => setCopiedTs((cur) => (cur === entry.timestamp ? null : cur)), 1000);
    } catch {
      // Clipboard may be unavailable; ignore.
    }
  };

  const copyGroup = async (group: GroupEntry) => {
    try {
      await navigator.clipboard.writeText(toLocatorList(group.picks));
      setCopiedGroup(group.sessionId);
      setTimeout(() => setCopiedGroup((cur) => (cur === group.sessionId ? null : cur)), 1000);
    } catch {
      // Clipboard may be unavailable; ignore.
    }
  };

  const renderRow = (entry: PickedLocator, className = 'row', name?: string) => {
    const pill = entry.strategy ? pillFor(entry.strategy) : 'css';
    return (
      <div
        key={entry.timestamp}
        className={className}
        role="button"
        tabIndex={0}
        onClick={() => copyRow(entry)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            // Space would scroll the popup.
            e.preventDefault();
            copyRow(entry);
          }
        }}
      >
        <span className={`pill pill-${pill}`}>{pill}</span>
        <div className="row-main">
          <div
            className="row-locator"
            dangerouslySetInnerHTML={{ __html: highlight(entry.locator) }}
          />
          <div className="row-tag">
            &lt;{entry.tag}&gt;
            {name && <span className="row-name">{` // ${name}`}</span>}
          </div>
        </div>
        {copiedTs === entry.timestamp ? (
          <CheckIcon className="row-copy copied" />
        ) : (
          <CopyIcon className="row-copy" />
        )}
      </div>
    );
  };

  const renderGroup = (group: GroupEntry) => {
    const expanded = expandedGroup === group.sessionId;
    const names = locatorNames(group.picks);
    return (
      <div key={group.sessionId} className="group">
        <div className="group-head">
          <button
            type="button"
            className="group-toggle"
            aria-expanded={expanded}
            onClick={() => setExpandedGroup(expanded ? null : group.sessionId)}
          >
            <span className="pill pill-group">group</span>
            <span className="group-title">{group.picks.length} locators</span>
            <ChevronIcon className={`group-chevron${expanded ? ' open' : ''}`} />
          </button>
          <button
            type="button"
            className="btn-copy-result"
            onClick={() => copyGroup(group)}
            title="Copy all locators"
          >
            {copiedGroup === group.sessionId ? (
              <>
                <CheckIcon />
                Copied
              </>
            ) : (
              <>
                <CopyIcon />
                Copy all
              </>
            )}
          </button>
        </div>
        {expanded && group.picks.map((pick, i) => renderRow(pick, 'row row-sub', names[i]))}
      </div>
    );
  };

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
              <a
                className="hd-gh"
                href={REPO_URL}
                target="_blank"
                rel="noopener noreferrer"
                title="View on GitHub"
                aria-label="View on GitHub"
              >
                <GitHubIcon />
              </a>
              <button
                className="hd-btn"
                onClick={() => setView('settings')}
                title="Settings"
                aria-label="Settings"
              >
                <SettingsIcon />
              </button>
            </div>
          </>
        )}
      </header>

      <div className="body">
        {view === 'settings' ? (
          <div className="settings">
            <div className="set-list">
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
              <Segmented<'on' | 'off'>
                value={settings.copyOnPick ? 'on' : 'off'}
                options={[
                  { value: 'on', label: 'On' },
                  { value: 'off', label: 'Off' },
                ]}
                onChange={(next) => updateSetting({ copyOnPick: next === 'on' })}
                label="Copy on pick"
                desc="Copy the locator to the clipboard as soon as you click an element."
              />
              <div className="set-row">
                <div className="set-text">
                  <div className="set-label">Keyboard shortcut</div>
                  <div className="set-desc">Toggle the picker without opening this popup.</div>
                </div>
                <div className="set-inline">
                  <kbd className="set-kbd">{shortcut || 'Not set'}</kbd>
                  <button type="button" className="set-link" onClick={openShortcutSettings}>
                    Change
                  </button>
                </div>
              </div>
            </div>
            <footer className="set-foot">
              <a className="set-link" href={STORE_URL} target="_blank" rel="noopener noreferrer">
                Rate Pickwright
              </a>
              <span className="set-foot-sep">·</span>
              <a
                className="set-link"
                href={`${REPO_URL}/issues/new`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Report an issue
              </a>
            </footer>
          </div>
        ) : (
          <>
            {lastLocator && lastStrategy && (
              <div className="result">
                <div className="result-top">
                  <span className="badge" title={lastReasons.map((r) => r.message).join(' • ')}>
                    {lastStrategy}
                  </span>
                  <span className="result-sep">·</span>
                  <span className="result-tag">&lt;{lastTag}&gt;</span>
                </div>
                <div
                  className="result-code"
                  dangerouslySetInnerHTML={{ __html: highlight(lastLocator) }}
                />
                {lastAlternatives.length > 0 && (
                  <div className="alt-list">
                    <div className="alt-head">Alternatives</div>
                    {lastAlternatives.map((alt, i) => (
                      <div
                        key={i}
                        className="alt-row"
                        role="button"
                        tabIndex={0}
                        onClick={() => copyAlt(alt, i)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            copyAlt(alt, i);
                          }
                        }}
                        title="Copy alternative"
                      >
                        <span
                          className="alt-code"
                          dangerouslySetInnerHTML={{ __html: highlight(alt) }}
                        />
                        {copiedAltIdx === i ? (
                          <CheckIcon className="row-copy copied" />
                        ) : (
                          <CopyIcon className="row-copy" />
                        )}
                      </div>
                    ))}
                  </div>
                )}
                <div className="result-footer">
                  <span className="result-hint">last picked</span>
                  <button
                    className="btn-copy-result"
                    onClick={() => copyLocator(lastLocator)}
                    title="Copy locator"
                  >
                    {copiedLocator ? (
                      <>
                        <CheckIcon />
                        Copied
                      </>
                    ) : (
                      <>
                        <CopyIcon />
                        Copy
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {!pickerActive && notice && (
              <div className="banner" role="status">
                <CheckIcon className="banner-icon" />
                <div className="banner-title">{notice}</div>
              </div>
            )}
            {pickerActive && multiPickerActive && (
              <div className="banner">
                <span className="banner-dot" />
                <div>
                  <div className="banner-title">Multi-pick active</div>
                  <div className="banner-hint">
                    Click elements to collect locators. Press Stop when done.
                  </div>
                </div>
              </div>
            )}
            {pickerActive && !multiPickerActive && (
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
              {pickerActive && multiPickerActive ? (
                <button className="btn btn-stop btn-full" onClick={stopMultiPick}>
                  <StopIcon />
                  Stop picking
                  <span className="btn-count">
                    {activePickCount}/{MAX_GROUP_PICKS}
                  </span>
                </button>
              ) : pickerActive && !multiPickerActive ? (
                <button className="btn btn-stop btn-full" onClick={togglePicker}>
                  <StopIcon />
                  Stop picking
                </button>
              ) : (
                <>
                  <button className="btn btn-primary" onClick={togglePicker}>
                    <CrosshairsIcon />
                    Pick element
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={startMultiPick}
                    disabled={settings.historyMode === 'off'}
                    title={
                      settings.historyMode === 'off'
                        ? 'Enable history in Settings to use multi-pick'
                        : ''
                    }
                  >
                    <StackIcon />
                    Pick multiple
                  </button>
                </>
              )}
            </div>

            {(multiPickerActive || settings.historyMode !== 'off') &&
              (history.length > 0 ? (
                <div>
                  <div className="history-head">
                    <span className="history-label">History</span>
                    <span className="history-count">
                      {history.length} / {MAX_HISTORY}
                    </span>
                  </div>
                  <div className="history-list">
                    {history.map((entry) =>
                      isGroupEntry(entry) ? renderGroup(entry) : renderRow(entry),
                    )}
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
