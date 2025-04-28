chrome.runtime.onConnect.addListener(function(port) {
  const extensionListener = function(message, sender) {
    if (message.tabId && message.content) {
      if (message.action === "code") {
        // Instead of executing arbitrary code, we'll use a registered script
        chrome.scripting.executeScript({
          target: { tabId: message.tabId },
          files: ['src/inject/inject.js']
        }).catch(error => {
          console.error('Error injecting script:', error);
        });
      } else if (message.action === "script") {
        // Use the registered script path
        const scriptPath = chrome.runtime.getURL(message.content);
        chrome.scripting.executeScript({
          target: { tabId: message.tabId },
          files: [scriptPath]
        }).catch(error => {
          console.error('Error injecting script:', error);
        });
      } else {
        chrome.tabs.sendMessage(message.tabId, message);
      }
    } else {
      port.postMessage({ content: message, sender: sender });
    }
  };

  // Add the listener
  chrome.runtime.onMessage.addListener(extensionListener);

  port.onDisconnect.addListener(function(port) {
    chrome.runtime.onMessage.removeListener(extensionListener);
  });
});
