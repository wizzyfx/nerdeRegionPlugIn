(function createChannel() {
  //Create a port with service page for continuous message communication
  const port = chrome.extension.connect({
    name: "nerdeRegionChromeExtension"
  });

  // Listen to messages from the service page
  port.onMessage.addListener(function(message) {
    if (message.sender.tab.id == chrome.devtools.inspectedWindow.tabId) {
      processIncoming(message);
    }
  });
})();

Rainbow.defer = true;
const eventsContainer = document.querySelector("#events");
const eventsList = document.querySelector("#events ol");
const regionsContainer = document.querySelector("#regions");

function padZero(number, length) {
  return ("0".repeat(length) + number).slice(-length);
}

function processIncoming(message) {
  const regionId = "";
  const regionCSS = message.content.data[1];
  const regionAccName = message.content.data[3];
  //let regionHTMLContent = $('<div />').text(message.content.data[2]).html();
  const regionInFrame = message.content.framed;
  const isScrollAble =
    Math.abs(
      eventsContainer.scrollTop +
        eventsContainer.offsetHeight -
        eventsContainer.scrollHeight
    ) < 10;

  const currentTime = new Date();
  const timestamp = `${padZero(currentTime.getHours(), 2)}:${padZero(
    currentTime.getMinutes(),
    2
  )}:${padZero(currentTime.getSeconds(), 2)}:${padZero(
    currentTime.getMilliseconds(),
    3
  )}`;

  let regionCode = `<li class="region-${encodeURIComponent(
    message.content.data.regionNum
  )}">`;

  regionCode += message.content.data.regionNum
    ? `<span class="role meta"><strong>Role:</strong>${encodeURIComponent(
        message.content.data.regionRole
      )}</span>`
    : "";


  Rainbow.color(message.content.data[2], "html", function(highlightedCode) {
    $(eventsList).append(
      `<li class="region-${regionId}">
			
			<span class="type meta"><strong>Politeness:</strong> Assertive</span>
			<span class="atomic meta"><strong>Atomic:</strong> True</span>
			<span class="relevant meta"><strong>Relevant:</strong> Additions Text</span>
			<span class="frame meta"><strong>In Frame:</strong> Yes</span>
			<div class="path"><em class="id">${regionId}</em><a href="#">${regionCSS}</a></div>
			<div class="content accname">${regionAccName}</div>
			<div class="content html" data-language="html"><pre>${highlightedCode}</pre></div>
			<div class="time">${timestamp}</div>
        </li>`
    );
    if (isScrollAble) {
      eventsContainer.scrollTop = eventsContainer.scrollHeight;
    }
  });

  if (!regionsContainer.querySelector(`.region-${regionId}`)) {
    $(regionsContainer).append(
      `<li role="none" class="region region-${regionId}">
				<button role="tab" aria-selected="false" aria-controls="events" class="tab">
					<em class="id">${regionId}</em>${regionCSS}
				</button>
			</li>`
    );
  }
}

$(".check").on("click", function() {
  if ($(this).hasClass("on")) {
    $(this)
      .removeClass("on")
      .attr("aria-label", "Turn On Focus Indicator");
  } else {
    $(this)
      .addClass("on")
      .attr("aria-label", "Turn Off Focus Indicator");
  }
});

$("#clearButton").on("click", function() {
  $(eventsList).empty();
  $(regionsContainer).html(
    '<li role="none"><button role="tab" aria-selected="false" aria-controls="events" class="tab all active">All Regions</button></li>'
  );
});

$("body").addClass(chrome.devtools.panels.themeName);
