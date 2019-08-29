chrome.runtime.onConnect.addListener(function(port) {
  const extensionListener = function(message, sender) {
    if (message.tabId && message.content) {
      if (message.action === "code") {
        chrome.tabs.executeScript(message.tabId, { code: message.content });
      } else if (message.action === "script") {
        chrome.tabs.executeScript(message.tabId, { file: message.content });
      } else {
        chrome.tabs.sendMessage(message.tabId, message);
      }
    } else {
      port.postMessage({ content: message, sender: sender });
    }
  };
  chrome.extension.onMessage.addListener(extensionListener);

  port.onDisconnect.addListener(function(port) {
    chrome.extension.onMessage.removeListener(extensionListener);
  });
});

chrome.runtime.onMessage.addListener(function(request, sender) {
  return true;
});
