(function createChannel() {
  const port = chrome.runtime.connect({
    name: "nerdeRegionChromeExtension"
  });

  port.onMessage.addListener(function(message) {
    if (message?.sender?.tab?.id === chrome.devtools.inspectedWindow.tabId) {
      route(message);
    }
  });
})();

const eventsContainer = document.querySelector("#events");
const eventsList = document.querySelector("#events ol");
const regionsContainer = document.querySelector("#regions");

let pageInitialized = false;
let useCSSGroups = false;
let usePersistentLog = false;
let useAccName = false;
let watchNum = 0;

const htmlEncode = (str) => {
  return str
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
};

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
    case "initialized":
      pageInitialized = true;
      break;
    case "ready":
      processPageLoad(message.content);
      break;
  }
}

function sendToInspectedPage(message) {
  message.tabId = chrome.devtools.inspectedWindow.tabId;
  chrome.runtime.sendMessage(message);
}

function sendCommandToPage(command, data = false) {
  sendToInspectedPage({ action: "command", content: command, data: data });
}

function openInspector(path) {
  chrome.devtools.inspectedWindow.eval(
    `inspect(document.querySelector('${path}'));`
  );
}

function getTimeStamp() {
  const currentTime = new Date();
  return `${padZero(currentTime.getHours(), 2)}:${padZero(
    currentTime.getMinutes(),
    2
  )}:${padZero(currentTime.getSeconds(), 2)}:${padZero(
    currentTime.getMilliseconds(),
    3
  )}`;
}

function addTab(message) {
  const timestamp = getTimeStamp();
  watchNum = message.data.regionNum;
  addToEventList(
    `<li class="new region-${message.data.regionNum}">Region #${
      message.data.regionNum
    } is ${
      message.inDom ? "found in" : "added to"
    } DOM <div class="time">${timestamp}</div></li>`
  );
  $(regionsContainer).append(
    `<li role="none" class="region region-${message.data.regionNum}">
				<button role="tab" aria-selected="false" aria-controls="events" class="tab" data-region="${message.data.regionNum}">
					<em class="id">${message.data.regionNum}</em>${message.data.regionPath}
				</button>
			</li>`
  );
}

function addToEventList(html, timestamp = false) {
  const isScrollAble =
    Math.abs(
      eventsContainer.scrollTop +
        eventsContainer.offsetHeight -
        eventsContainer.scrollHeight
    ) < 10;
  $(eventsList).append(html);
  if (isScrollAble) {
    eventsContainer.scrollTop = eventsContainer.scrollHeight;
  }
}

function panelShown() {
  if (!pageInitialized) {
    sendCommandToPage("startTrack");
  }
}

function removeTab(tabId) {
  const timestamp = getTimeStamp();
  $(regionsContainer)
    .find(`li.region-${tabId} > button`)
    .addClass("gone");
  addToEventList(
    `<li class="removal region-${tabId}">Region #${tabId} was removed from DOM, or is no longer a live region <div class="time">${timestamp}</div></li>`
  );
}

function processPageLoad(message) {
  if (!message.framed) {
    const timestamp = getTimeStamp();
    if (!usePersistentLog) {
      $(eventsList).empty();
      $(regionsContainer)
        .children("li.region")
        .remove();
    } else {
      $(regionsContainer)
        .find("li.region > button")
        .addClass("gone");
    }
    addToEventList(
      `<li class="url"><div class="ellipsis">Page Loaded [${message.data}]<div><div class="time">${timestamp}</div></li>`
    );
  }
  sendCommandToPage("startTrack", usePersistentLog ? watchNum : false);
}

function processIncoming(message) {
  const currentTime = new Date();
  const timestamp = getTimeStamp();

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

  regionCode += `<div class="content html"><pre>${htmlEncode(
    message.data.regionHTML
  )}</pre></div>`;

  regionCode += `<div class="time">${timestamp}</div>`;

  regionCode += "</li>";

  addToEventList(regionCode);
}

$("#persistButton").on("click", function() {
  if ($(this).hasClass("on")) {
    $(this).removeClass("on");
    usePersistentLog = false;
  } else {
    $(this).addClass("on");
    usePersistentLog = true;
  }
});

$("#accNameButton").on("click", function() {
  if ($(this).hasClass("on")) {
    $(this).removeClass("on");
    $(eventsList).removeClass("show-accname");
    useAccName = false;
  } else {
    $(this).addClass("on");
    useAccName = true;
    $(eventsList).addClass("show-accname");
  }
});

$("#resetButton").on("click", function() {
  $(eventsList).empty();
  $(regionsContainer)
    .children("li.region")
    .remove();
  $(regionsContainer)
    .find("button.all")
    .click();
  sendCommandToPage("reset");
});

$(eventsList).on("click", ".path a", function(event) {
  openInspector(event.target.text);
});

$(regionsContainer).on("click", "li > button", function(event) {
  const region = event.target.dataset.region;
  if (region === "all") {
    $(eventsList).removeClass("filtered");
    $(regionsContainer)
      .find("li > button.active")
      .removeClass("active")
      .attr("aria-selected", "false");
    $(event.target)
      .addClass("active")
      .attr("aria-selected", "true");
    $("#filterStyle").empty();
  } else if (parseInt(region) > 0) {
    $(eventsList).addClass("filtered");
    $(regionsContainer)
      .find("li > button.active")
      .removeClass("active")
      .attr("aria-selected", "false");
    $(event.target)
      .addClass("active")
      .attr("aria-selected", "true");
    $("#filterStyle").text(
      `.region-${parseInt(region)}{display:block!important}`
    );
  }
});

$("body").addClass(chrome.devtools.panels.themeName);
