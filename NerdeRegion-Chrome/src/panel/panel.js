(function createChannel() {
  const port = chrome.extension.connect({
    name: "nerdeRegionChromeExtension"
  });

  port.onMessage.addListener(function(message) {
    if (message.sender.tab.id == chrome.devtools.inspectedWindow.tabId) {
      route(message);
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

function route(message) {
  switch (message.content.action) {
    case "change":
      processIncoming(message.content);
      break;
    case "watch":
      addTab(message.content);
      processIncoming(message.content);
      break;
    case "unwatch":
      removeTab(message.content.data);
      break;
    case "ready":
      processPageLoad(message.content);
      break;
  }
}

function sendToInspectedPage(message) {
  message.tabId = chrome.devtools.inspectedWindow.tabId;
  chrome.extension.sendMessage(message);
}

function sendCommandToPage(command, data = false) {
  sendToInspectedPage({ action: "command", content: command, data });
}

const openInspector = (path) => {
  chrome.devtools.inspectedWindow.eval(
    `inspect(document.querySelector('${path}'));`
  );
};

function addTab(message) {
  $(regionsContainer).append(
    `<li role="none" class="region region-${message.data.regionNum}">
				<button role="tab" aria-selected="false" aria-controls="events" class="tab">
					<em class="id">${message.data.regionNum}</em>${message.data.regionPath}
				</button>
			</li>`
  );
}

function removeTab(tabId) {
  $(`#regions li.region-${tabId} button`).addClass("gone");
  const isScrollAble =
    Math.abs(
      eventsContainer.scrollTop +
        eventsContainer.offsetHeight -
        eventsContainer.scrollHeight
    ) < 10;

  $(eventsList).append(
    `<li class="removal">Region #${tabId} was removed from DOM, or is no longer a live region</li>`
  );

  if (isScrollAble) {
    eventsContainer.scrollTop = eventsContainer.scrollHeight;
  }
};

function processPageLoad(message) {
  if ($("#captureButton").hasClass("pause")) {
    sendCommandToPage("startTrack");
  }
  const isScrollAble =
    Math.abs(
      eventsContainer.scrollTop +
        eventsContainer.offsetHeight -
        eventsContainer.scrollHeight
    ) < 10;

  if (!message.framed) {
    $(eventsList).append(
      '<li class="url">Page Loaded [' + message.data + "]</li>"
    );
  }

  if (isScrollAble) {
    eventsContainer.scrollTop = eventsContainer.scrollHeight;
  }
}

function processIncoming(message) {
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

  Rainbow.color(message.data.regionHTML, "html", function(highlightedCode) {
    let regionCode = `<li class="region region-${encodeURI(
      message.data.regionNum
    )}">`;

    regionCode += message.data.regionRole
      ? `<span class="role meta"><strong>Role:</strong> ${encodeURI(
          message.data.regionRole
        )}</span>`
      : "";

    regionCode += message.data.regionPoliteness
      ? `<span class="type meta"><strong>Politeness:</strong> ${encodeURI(
          message.data.regionPoliteness
        )}</span>`
      : "";

    regionCode += message.data.regionAtomic
      ? `<span class="atomic meta"><strong>Atomic:</strong> ${encodeURI(
          message.data.regionAtomic
        )}</span>`
      : "";

    regionCode += message.data.regionRelevant
      ? `<span class="relevant meta"><strong>Relevant:</strong> ${encodeURI(
          message.data.regionRelevant
        )}</span>`
      : "";

    regionCode += message.data.framed
      ? `<span class="frame meta"><strong>Frame:</strong> ${message.data.frameURL}</span>`
      : "";

    regionCode += `<div class="path"><em class="id">${message.data.regionNum}</em><a href="#">${message.data.regionPath}</a></div>`;

    regionCode += `<div class="content accname">${message.data.regionAccName}</div>`;

    regionCode += `<div class="content html" data-language="html"><pre>${highlightedCode}</pre></div>`;

    regionCode += `<div class="time">${timestamp}</div>`;

    regionCode += "</li>";

    $(eventsList).append(regionCode);

    if (isScrollAble) {
      eventsContainer.scrollTop = eventsContainer.scrollHeight;
    }
  });
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

$("#captureButton").on("click", function() {
  if ($(this).hasClass("pause")) {
    $(this)
      .removeClass("pause")
      .html("Record");
    sendCommandToPage("stopTrack");
  } else {
    $(this)
      .addClass("pause")
      .html("Pause");
    sendCommandToPage("startTrack");
  }
});

$("#clearButton").on("click", function() {
  $(eventsList).empty();
  $(regionsContainer).html(
    '<li role="none"><button role="tab" aria-selected="false" aria-controls="events" class="tab all active">All Regions</button></li>'
  );
});

$(eventsList).on("click", ".path a", function(event) {
  openInspector(event.target.text);
});

$("body").addClass(chrome.devtools.panels.themeName);
