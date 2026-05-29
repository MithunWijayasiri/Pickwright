// Pickwright background service worker

import { MESSAGE_TYPES, Message } from '../shared/messaging';
import { addToHistory, HistoryEntry } from '../shared/storage';

chrome.runtime.onInstalled.addListener(() => {
  console.log('Pickwright extension installed');
});

chrome.runtime.onMessage.addListener(
  (message: Message, sender, sendResponse) => {
    // Messages from a content script carry sender.tab.
    if (sender.tab) {
      // Persist picked elements here — the popup is usually closed by the time
      // the user clicks the page, so it can't reliably write history itself.
      if (message.type === MESSAGE_TYPES.ELEMENT_SELECTED) {
        const entry: HistoryEntry = {
          url: sender.tab.url ?? '',
          timestamp: Date.now(),
          locator: message.payload.locator,
          score: message.payload.score,
          tag: message.payload.tag,
          textSnippet: message.payload.textSnippet,
        };
        addToHistory(entry);
      }
      return;
    }

    // Relay popup commands to the active tab's content script.
    if (
      message.type === MESSAGE_TYPES.TOGGLE_PICKER ||
      message.type === MESSAGE_TYPES.GET_PICKER_STATE
    ) {
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
  },
);
