// Pickwright background service worker

import { COMMAND_TYPES, MESSAGE_TYPES, Message } from '../shared/messaging';
import { addToHistory, clearHistory, HistoryEntry } from '../shared/storage';
import { getSettings } from '../shared/settings';

chrome.runtime.onInstalled.addListener(() => {
  console.log('Pickwright extension installed');
});

// Auto-clear history on browser restart when historyMode is 'autoClear'.
chrome.runtime.onStartup.addListener(async () => {
  try {
    const { historyMode } = await getSettings();
    if (historyMode === 'autoClear') {
      await clearHistory();
    }
  } catch (error) {
    console.error('Failed to process startup history mode', error);
  }
});

// Keyboard shortcut → toggle the picker in the active tab (same relay as popup toggle).
chrome.commands?.onCommand.addListener((command) => {
  if (command !== 'toggle-picker') return;
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tabId = tabs[0]?.id;
    if (!tabId) return;
    // Reading lastError silences "Unchecked runtime.lastError" when no content script.
    chrome.tabs.sendMessage(
      tabId,
      { type: MESSAGE_TYPES.TOGGLE_PICKER },
      () => chrome.runtime.lastError,
    );
  });
});

chrome.runtime.onMessage.addListener((message: Message, sender, sendResponse) => {
  // Dispatch on message type, not on sender.tab: a genuine default_popup view
  // has no tab, but Playwright can only drive it by opening popup.html as a
  // real tab, which does carry sender.tab. Typing the dispatch keeps both cases
  // correct instead of relying on that transport detail.
  if (message.type === MESSAGE_TYPES.ELEMENT_SELECTED) {
    // Persist picked elements here — the popup is usually closed by the time
    // the user clicks the page, so it can't reliably write history itself.
    const tabUrl = sender.tab?.url ?? '';
    const payload = message.payload;
    getSettings()
      .then(({ historyMode }) => {
        if (historyMode === 'off') return;
        const entry: HistoryEntry = {
          url: tabUrl,
          timestamp: Date.now(),
          locator: payload.locator,
          score: payload.score,
          tag: payload.tag,
          textSnippet: payload.textSnippet,
          alternatives: payload.alternatives,
          reasons: payload.reasons,
        };
        addToHistory(entry);
      })
      .catch((error) => {
        console.error('Failed to persist element selection history', error);
      });
    return;
  }

  // Relay popup commands to the active tab's content script.
  if (COMMAND_TYPES.has(message.type)) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tabId = tabs[0]?.id;
      if (!tabId) {
        sendResponse({ active: false });
        return;
      }
      chrome.tabs.sendMessage(tabId, message, (response) => {
        // Handle case where content script isn't ready
        if (chrome.runtime.lastError) {
          sendResponse({ active: false });
          return;
        }
        sendResponse(response);
      });
    });
    return true; // async sendResponse
  }
});
