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

$('.check').on('click',function () {
	if ($(this).hasClass('on')) {
		$(this).removeClass('on').attr('aria-label', 'Turn On Focus Indicator');
	} else {
		$(this).addClass('on').attr('aria-label', 'Turn Off Focus Indicator');
	}
});

$('body').addClass(chrome.devtools.panels.themeName);
