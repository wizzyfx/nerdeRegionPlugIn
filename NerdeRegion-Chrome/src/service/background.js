// Store active ports and listeners
const ports = new Set();
const messageListeners = new Set();

chrome.runtime.onConnect.addListener(function(port) {
  const extensionListener = function(message, sender) {
    if (message.tabId && message.content) {
      if (message.action === "code") {
        chrome.scripting.executeScript({
          target: { tabId: message.tabId },
          func: (code) => {
            // Execute the code in the context of the page
            return eval(code);
          },
          args: [message.content]
        });
      } else if (message.action === "script") {
        // In Manifest V3, we need to use a different approach for script injection
        // This would require registering the script in the manifest and using chrome.scripting.executeScript
        console.warn('Script file injection is not supported in Manifest V3. Please use code injection instead.');
      } else {
        chrome.tabs.sendMessage(message.tabId, message);
      }
    } else {
      port.postMessage({ content: message, sender: sender });
    }
  };

  // Add the listener
  chrome.runtime.onMessage.addListener(extensionListener);
  messageListeners.add(extensionListener);
  ports.add(port);

  port.onDisconnect.addListener(function(port) {
    // Clean up listeners and ports
    messageListeners.delete(extensionListener);
    ports.delete(port);
    chrome.runtime.onMessage.removeListener(extensionListener);
  });
});

// Basic message listener
chrome.runtime.onMessage.addListener(function(request, sender) {
  return true;
});

// Clean up when service worker is terminated
self.addEventListener('unload', () => {
  // Clean up all listeners and ports
  messageListeners.forEach(listener => {
    chrome.runtime.onMessage.removeListener(listener);
  });
  messageListeners.clear();
  ports.clear();
});
