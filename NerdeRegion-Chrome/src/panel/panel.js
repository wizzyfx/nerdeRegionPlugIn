(function createChannel () {
	//Create a port with service page for continuous message communication
	var port = chrome.extension.connect({
		name: "nerdeRegionChromeExtension"
	});

	// Listen to messages from the service page
	port.onMessage.addListener(function (message) {
		if (message.sender.tab.id == chrome.devtools.inspectedWindow.tabId) {
			console.log(message);
		}
	});
}());

$('body').addClass(chrome.devtools.panels.themeName)
