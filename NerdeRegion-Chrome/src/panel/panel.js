(function createChannel () {
	//Create a port with service page for continuous message communication
	const port = chrome.extension.connect({
		name: "nerdeRegionChromeExtension"
	});

	// Listen to messages from the service page
	port.onMessage.addListener(function (message) {
		if (message.sender.tab.id == chrome.devtools.inspectedWindow.tabId) {
			processIncoming (message);
		}
	});
}());

const eventsContainer = document.querySelector('#events');
const eventsList = document.querySelector('#events ol');
const regionsContainer = document.querySelector('#regions');

function padZero (number, length) {
	return ('0'.repeat(length) + number).slice(-length);
}

function processIncoming (message) {
	const regionId = message.content.data[0];
	const regionCSS = message.content.data[1];
	const regionAccName = message.content.data[3];
	const regionHTMLContent = $('<div />').text(message.content.data[2]).html();
	const regionInFrame = message.content.framed;
	const isScrollAble = Math.abs((eventsContainer.scrollTop + eventsContainer.offsetHeight) - eventsContainer.scrollHeight) < 10;

	const currentTime = new Date();
	const timestamp = `${padZero(currentTime.getHours(), 2)}:${padZero(currentTime.getMinutes(), 2)}:${padZero(currentTime.getSeconds(), 2)}:${padZero(currentTime.getMilliseconds(), 3)}`;

	$(eventsList).append(
		`<li class="region-${regionId}">
			<span class="time">${timestamp}</span>
			<span class="role">Alert</span>
			<span class="type">Assertive</span>
			<span class="atomic">Atomic</span>
			<span class="relevant">Additions</span>
			<span class="relevant">In Frame</span>
			<div class="path">${regionCSS}</div>
			<div class="content accname">${regionAccName}</div>
		</li>`);

	if(isScrollAble) {
		eventsContainer.scrollTop = eventsContainer.scrollHeight;
	}
}

$('.check').on('click', function () {
	if ($(this).hasClass('on')) {
		$(this).removeClass('on').attr('aria-label', 'Turn On Focus Indicator');
	} else {
		$(this).addClass('on').attr('aria-label', 'Turn Off Focus Indicator');
	}
});

$('body').addClass(chrome.devtools.panels.themeName);
