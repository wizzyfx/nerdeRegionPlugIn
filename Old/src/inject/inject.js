/**
 * Helper for NerdeRegion extension, which gets injected to web pages
 *
 * @author Ugurcan (Ugi) Kutluoglu <ugurcank@gmail.com>
 */

const NerdeRegion = (function() {
  const debug = false;
  const inFrame = window.self !== window.top;
  let watchNum = 0;

  const positiveLookUp = [
    '[aria-live="polite"]',
    '[aria-live="assertive"]',
    '[role="alert"]',
    '[role="log"]',
    '[role="status"]'
  ];

  const negativeLookUp = ['[aria-live="off"]'];

  const sendToDevTools = (message) => {
    message.framed = inFrame;
    message.frameURL = inFrame ? window.location.href : "";
    chrome.runtime.sendMessage(message);
  };

  const consoleLog = function(things) {
    if (debug) {
      console.log(things);
    }
  };



  const getRegionProps = (node) => {
    return {
      regionNum: node.dataset.nerderegionid,
      regionPath: getPath(node),
      regionHTML: node.innerHTML,
      regionAccName: getAccessibleName(node),
      regionRole: node.getAttribute("role") || false,
      regionPoliteness: node.getAttribute("aria-live") || false,
      regionAtomic: node.getAttribute("aria-atomic") || false,
      regionRelevant: node.getAttribute("aria-relevant") || false
    };
  };

  const isLiveRegion = (node) => {
    return (
      node.nodeType === 1 &&
      node.matches(positiveLookUp.join(",")) &&
      !node.matches(negativeLookUp.join(","))
    );
  };

  const walkTheDOM = (node, handler) => {
    if (node.nodeType === 1) {
      handler(node);
      if (node.children.length) {
        for (let childNode of node.children) {
          walkTheDOM(childNode, handler);
        }
      }
    }
  };

  const pageObserver = (mutationsList) => {
    for (let mutation of mutationsList) {
      consoleLog(["page", mutation]);
      if (
        mutation.type === "childList" &&
        mutation.removedNodes !== undefined
      ) {
        for (let removedNode of mutation.removedNodes) {
          walkTheDOM(removedNode, (node) => {
            unwatchRegion(node);
          });
        }
      }

      if (mutation.type === "childList" && mutation.addedNodes !== undefined) {
        for (let addedNode of mutation.addedNodes) {
          walkTheDOM(addedNode, (node) => {
            if (isLiveRegion(node)) {
              watchRegion(node, false);
            }
          });
        }
      }

      if (mutation.type === "attributes") {
        if (isLiveRegion(mutation.target)) {
          watchRegion(mutation.target, false);
        } else {
          unwatchRegion(mutation.target);
        }
      }
    }
  };
  const pageMutation = new MutationObserver(pageObserver);

  const regionObserver = (mutationsList) => {
    let mutatedParents = [];
    for (let mutation of mutationsList) {
      consoleLog(["region", mutation]);
      if (mutation.type !== "attributes") {
        let regionNode = mutation.target;
        while (regionNode.parentNode) {
          if (
            regionNode.nerderegion === true &&
            !mutatedParents.includes(regionNode)
          ) {
            mutatedParents.push(regionNode);
          }
          regionNode = regionNode.parentNode;
        }
      }
    }
    mutatedParents.forEach((node) => {
      sendToDevTools({
        action: "change",
        data: getRegionProps(node)
      });
    });
  };
  const regionMutation = new MutationObserver(regionObserver);

  const watchRegion = (node, inDom) => {
    if (node.nodeType === 1 && node.nerderegion === undefined) {
      watchNum += 1;
      consoleLog(["watching", watchNum]);
      node.nerderegion = true;
      node.dataset.nerderegionid = watchNum.toString();
      sendToDevTools({
        action: "watch",
        data: getRegionProps(node),
        inDom: inDom
      });
      regionMutation.observe(node, {
        attributes: true,
        subtree: true,
        childList: true,
        characterData: true
      });
    }
  };

  const unwatchRegion = (node) => {
    if (node.nodeType === 1 && node.nerderegion === true) {
      consoleLog(["unwatching", node.dataset.nerderegionid]);
      sendToDevTools({
        action: "unwatch",
        data: node.dataset.nerderegionid
      });
      delete node.nerderegion;
    }
  };

  const initRegions = () => {
    document.querySelectorAll(positiveLookUp.join(",")).forEach((node) => {
      if (!node.matches(negativeLookUp.join(","))) {
        watchRegion(node, true);
      }
    });
    sendToDevTools({
      action: "initialized",
      data: window.location.hostname
    });
    pageMutation.observe(document.body, {
      subtree: true,
      childList: true
    });
  };

  const resetRegions = () => {
    document.querySelectorAll("[data-nerderegionid]").forEach((node) => {
      delete node.nerderegion;
      delete node.dataset.nerderegionid;
    });
    watchNum = 0;
  };

  const route = (message) => {
    if (message.action === "command") {
      switch (message.content) {
        case "startTrack":
          watchNum = message.data ? parseInt(message.data) : 0;
          initRegions();
          break;
        case "reset":
          pageMutation.disconnect();
          regionMutation.disconnect();
          resetRegions();
          initRegions();
          break;
      }
    }
  };

  const initialize = () => {
    chrome.runtime.onMessage.addListener((message) => {
      route(message);
    });
    sendToDevTools({
      action: "ready",
      data: window.location.href.toString()
    });
  };

  if (document.readyState !== "loading") {
    initialize();
  } else {
    document.addEventListener("DOMContentLoaded", initialize);
  }
})();
