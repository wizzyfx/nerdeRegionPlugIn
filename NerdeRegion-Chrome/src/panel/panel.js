(function createChannel () {
	//Create a port with service page for continuous message communication
	const port = chrome.extension.connect({
		name: "nerdeRegionChromeExtension"
	});

	// Listen to messages from the service page
	port.onMessage.addListener(function (message) {
		if (message.sender.tab.id == chrome.devtools.inspectedWindow.tabId) {
			console.log(message);
			$('#events ol').append(`<li>${message.content.framed} ${message.content.data[0]} ${message.content.data[1]} ${message.content.data[2]}<li>`);
			$('#events').scrollTop($('#events')[0].scrollHeight);
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
