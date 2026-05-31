import { useState, useEffect } from 'react';
import { MESSAGE_TYPES, Message } from '../shared/messaging';
import { getHistory, HistoryEntry } from '../shared/storage';
import { getStrategy, highlight } from './locatorUtils';
import {
  CrosshairsIcon,
  StopIcon,
  CopyIcon,
  CheckIcon,
  HistoryIcon,
  GitHubIcon,
} from './icons';

const MAX_HISTORY = 20;

const App = () => {
  const [pickerActive, setPickerActive] = useState(false);
  const [lastLocator, setLastLocator] = useState<string | null>(null);
  const [lastTag, setLastTag] = useState<string>('');
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [copiedTs, setCopiedTs] = useState<number | null>(null);

  useEffect(() => {
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
        <div className="hd-pip" />
        <span className="hd-name">
          Pick<span className="w">w</span>right
        </span>
        <span className="hd-ver">v{chrome.runtime.getManifest().version}</span>
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
      </header>

      <div className="body">
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
                onClick={() =>
                  history[0] &&
                  copyRow(history[0])
                }
                title="Copy locator"
              >
                {history[0] && copiedTs === history[0].timestamp ? (
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

        {history.length > 0 ? (
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
        )}
      </div>
    </div>
  );
};

export default App;
