// Pickwright background service worker

import { MESSAGE_TYPES, Message } from '../shared/messaging';

chrome.runtime.onInstalled.addListener(() => {
  console.log('Pickwright extension installed');
});

// Relay messages from popup to active tab content script
chrome.runtime.onMessage.addListener(
  (message: Message, sender, sendResponse) => {
    // Only handle messages from the popup (no sender.tab means it's from extension UI)
    if (sender.tab) return;

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
