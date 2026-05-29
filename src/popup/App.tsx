import { useState, useEffect } from 'react';
import { MESSAGE_TYPES, Message } from '../shared/messaging';
import { getHistory, addToHistory, removeFromHistory, HistoryEntry } from '../shared/storage';

const App = () => {
  const [pickerActive, setPickerActive] = useState(false);
  const [lastLocator, setLastLocator] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    // Get current picker state
    chrome.runtime.sendMessage({ type: MESSAGE_TYPES.GET_PICKER_STATE }, (response) => {
      if (response?.active) setPickerActive(true);
    });
    // Load history
    getHistory().then(setHistory);

    // Listen for messages from content script
    const listener = (message: Message) => {
      if (message.type === MESSAGE_TYPES.PICKER_STATE_CHANGED) {
        setPickerActive(message.payload.active);
      }
      if (message.type === MESSAGE_TYPES.ELEMENT_SELECTED) {
        setLastLocator(message.payload.locator);
        setPickerActive(false);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        // Add to history
        const entry: HistoryEntry = {
          url: '', // will be filled below
          timestamp: Date.now(),
          locator: message.payload.locator,
          score: message.payload.score,
          tag: message.payload.tag,
          textSnippet: message.payload.textSnippet,
        };
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          entry.url = tabs[0]?.url ?? '';
          addToHistory(entry).then(() => getHistory().then(setHistory));
        });
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

  const togglePicker = () => {
    chrome.runtime.sendMessage({ type: MESSAGE_TYPES.TOGGLE_PICKER }, (response) => {
      if (response) setPickerActive(response.active);
    });
  };

  const copyLocator = async (locator: string) => {
    try {
      await navigator.clipboard.writeText(locator);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard might be unavailable; ignore.
    }
  };

  const handleRemoveHistory = (timestamp: number) => {
    removeFromHistory(timestamp).then(() => getHistory().then(setHistory));
  };

  return (
    <div style={{ width: 340, padding: 16, fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ fontSize: 18, margin: '0 0 12px' }}>Pickwright</h1>

      <button
        onClick={togglePicker}
        style={{
          width: '100%',
          padding: '10px 16px',
          fontSize: 14,
          fontWeight: 600,
          border: 'none',
          borderRadius: 6,
          cursor: 'pointer',
          background: pickerActive ? '#ef4444' : '#2563eb',
          color: '#fff',
        }}
      >
        {pickerActive ? 'Stop Picking' : 'Start Picking'}
      </button>

      {lastLocator && (
        <div style={{ marginTop: 12, padding: 10, background: '#f0fdf4', borderRadius: 6 }}>
          <div style={{ fontSize: 11, color: '#16a34a', fontWeight: 600 }}>
            {copied ? '✓ Copied!' : 'Last locator:'}
          </div>
          <code
            onClick={() => copyLocator(lastLocator)}
            style={{
              display: 'block',
              marginTop: 4,
              fontSize: 12,
              wordBreak: 'break-all',
              cursor: 'pointer',
            }}
          >
            {lastLocator}
          </code>
        </div>
      )}

      {history.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <h2 style={{ fontSize: 13, margin: '0 0 8px', color: '#666' }}>Recent</h2>
          <div style={{ maxHeight: 200, overflowY: 'auto' }}>
            {history.map((entry) => (
              <div
                key={entry.timestamp}
                style={{
                  padding: '6px 8px',
                  marginBottom: 4,
                  background: '#f8fafc',
                  borderRadius: 4,
                  fontSize: 11,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <code
                  onClick={() => copyLocator(entry.locator)}
                  style={{ flex: 1, cursor: 'pointer', wordBreak: 'break-all' }}
                  title={`${entry.tag} — ${entry.textSnippet}`}
                >
                  {entry.locator}
                </code>
                <button
                  onClick={() => handleRemoveHistory(entry.timestamp)}
                  style={{
                    border: 'none',
                    background: 'none',
                    cursor: 'pointer',
                    color: '#999',
                    fontSize: 14,
                    padding: '0 4px',
                  }}
                  title="Remove"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
