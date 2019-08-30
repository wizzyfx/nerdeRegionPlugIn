/**
 * Helper for NerdeRegion extension, which gets injected to web pages
 *
 * @author Ugurcan (Ugi) Kutluoglu <ugurcank@gmail.com>
 */

const NerdeRegion = (function() {
  const inFrame = window.self !== window.top;
  let watchNum = 0;
  let captureRegion = false;

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
    chrome.extension.sendMessage(message);
  };

  const getPath = function(node) {
    const commonNames = [
      "selected",
      "active",
      "focus",
      "hover",
      "enable",
      "hidden",
      "visible",
      "valid",
      "disable",
      "col-"
    ];
    let path, allSiblings;
    while (node) {
      let realNode = node;
      let name = realNode.tagName;
      if (!name) {
        break;
      }
      name = name.toLowerCase();
      if (
        realNode.id &&
        /^[A-Za-z][\da-zA-Z_:.-]/.test(realNode.id) &&
        document.querySelectorAll("[id=" + realNode.id + "]").length === 1
      ) {
        name = "#" + realNode.id;
        path = name + (path ? ">" + path : "");
        break;
      }
      let className = "";
      let nodeClass = realNode.getAttribute("class");
      if (!nodeClass) {
        nodeClass = "";
      }
      let classList = nodeClass.split(/\s+/);
      for (let i = 0; i < classList.length; i++) {
        if (
          /^[\da-zA-Z_-]/.test(classList[i]) &&
          commonNames.findIndex(function(str) {
            return classList[i].indexOf(str) !== -1;
          }) === -1 &&
          document.querySelectorAll("." + classList[i]).length === 1
        ) {
          className = "." + classList[i];
          break;
        }
      }
      if (className != "") {
        path = className + (path ? ">" + path : "");
        break;
      }
      let parent = node.parentNode;
      if (parent) {
        let sameTagSiblings = parent.querySelectorAll(name);
        if (sameTagSiblings.length > 1) {
          allSiblings = parent.childNodes;
          let index = -1;
          let num = 1;
          for (let i = 0; i < allSiblings.length; i++) {
            if (allSiblings[i] == node) {
              index = num;
            }
            if (allSiblings[i].nodeType == 1) num++;
          }
          if (index > 1) {
            name += ":nth-child(" + index + ")";
          }
        }
      }
      path = name + (path ? ">" + path : "");
      node = parent;
    }
    return path;
  };

  const getAccessibleName = function(node) {
    // https://www.w3.org/TR/accname-1.1/
    // https://www.w3.org/TR/html-aam-1.0/#accessible-name-and-description-computation

    const isHidden = function(node) {
      const nodeStyle = window.getComputedStyle(node);
      return (
        ["none", "hidden"].includes(nodeStyle.display) ||
        node.matches("[aria-hidden=true]")
      );
    };

    const isLabelable = function(node) {
      const labelables = [
        "button",
        'input:not([type="hidden"])',
        "keygen",
        "meter",
        "output",
        "progress",
        "select",
        "textarea"
      ];
      return node.matches(labelables.join(","));
    };

    const getLabelNodes = function(node) {
      const nodeId = node.id;
      if (nodeId && /^[A-Za-z][\da-zA-Z_:.-]/.test(nodeId)) {
        const labelNodes = document.querySelectorAll(`label[for=${nodeId}]`);
        if (labelNodes.length) {
          return labelNodes;
        }
      }
      return false;
    };

    const getLabelParentNode = function(node) {
      const labelNode = node.parentNode
        ? node.parentNode.closest("label")
        : false;
      if (labelNode) {
        return labelNode;
      }
      return false;
    };

    const getAriaLabel = function(node) {
      if (node.nodeType === 1 && node.matches("[aria-label]")) {
        const nodeLabel = node.getAttribute("aria-label").trim();
        return nodeLabel !== "" ? nodeLabel : false;
      }
      return false;
    };

    const getAriaLabelNodes = function(node) {
      let refNodes = [];
      if (node.matches("[aria-labelledby]")) {
        const refIds = node.getAttribute("aria-labelledby").split(/\s+/);
        refIds.forEach((id) => {
          let refNode = document.querySelector(`#${id}`);
          if (refNode) {
            refNodes.push(refNode);
          }
        });
      }
      return refNodes;
    };

    const appendPseudoContent = function(node, text) {
      const pattern = /^"(.*)"$/m;
      let before = pattern.exec(
        window.getComputedStyle(node, ":before").getPropertyValue("content")
      );
      let after = pattern.exec(
        window.getComputedStyle(node, ":after").getPropertyValue("content")
      );
      before = before != null ? before[1] : "";
      after = after != null ? after[1] : "";
      return before + text + after;
    };

    let visited = [];
    const calculateNode = function(
      currentNode,
      traversalType = "normal",
      ignoreHidden = false,
      parentNode = {}
    ) {
      if (
        !(parentNode === currentNode && traversalType === "aria-labelledby")
      ) {
        if (visited.includes(currentNode)) {
          return "";
        } else {
          visited.push(currentNode);
        }
      }

      // A) If the current node is hidden and is not directly referenced by aria-labelledby or aria-describedby, nor
      // directly referenced by a native host language text alternative element (e.g. label in HTML) or attribute,
      // return the empty string.
      if (!ignoreHidden) {
        if (isHidden(currentNode)) {
          return "";
        }
      }

      // B) If the current node has an aria-labelledby attribute that contains at least one
      // valid IDREF, and the current node is not already part of an aria-labelledby traversal,
      // process its IDREFs in the order they occur
      if (traversalType !== "aria-labelledby") {
        const ariaLabelNodes = getAriaLabelNodes(currentNode);
        if (ariaLabelNodes.length) {
          return ariaLabelNodes
            .map(function(node) {
              return calculateNode(node, "aria-labelledby", true, currentNode);
            })
            .join(" ");
        }
      }

      // C) If the current node has an aria-label attribute whose value is not the empty string, nor, when trimmed
      // of white space, is not the empty string.
      // TODO If traversal of the current node is due to recursion and the current node is an embedded control
      //  as defined in step 2E, ignore aria-label and skip to rule 2E.
      const ariaLabel = getAriaLabel(currentNode);
      if (ariaLabel) {
        return ariaLabel;
      }

      // D) f the current node's native markup provides an attribute (e.g. title) or element (e.g. HTML label)
      // that defines a text alternative, return that alternative in the form of a flat string as defined by the
      // host language, unless the element is marked as presentational (role="presentation" or role="none").
      // TODO: Return flat string
      if (!currentNode.matches("[role=none],[role=presentation]")) {
        if (isLabelable(currentNode)) {
          const labelNodes = getLabelNodes(currentNode);
          if (labelNodes) {
            let labels = [];
            labelNodes.forEach(function(node) {
              labels.push(calculateNode(node, "labeling-nodes"));
            });
            return appendPseudoContent(currentNode, labels.join(" "));
          }
        }

        /*const labelingDescendant = getLabelingDescendant(currentNode);
				if(labelingDescendant) {
					return calculateNode(labelingDescendant, 'labeling-descendant');
				}

				if (currentNode.value && currentNode.value.trim() !== '') {
					return currentNode.value.trim();
				}*/
      }

      // E) If the current node is a control embedded within the label (e.g. the label element in HTML or any element
      // directly referenced by aria-labelledby) for another widget, where the user can adjust the embedded control's
      // value, then include the embedded control

      const labelParentNode = getLabelParentNode(currentNode);
      if (labelParentNode) {
        if (currentNode.matches("input[type=text]")) {
          if (currentNode.value && currentNode.value.trim() !== "") {
            return currentNode.value.trim();
          }
        }
        return calculateNode(labelParentNode, "labeling-parent");
      }

      // F) Otherwise, if the current node's role allows name from content, or if the current node is referenced by
      // aria-labelledby, aria-describedby, or is a native host language text alternative element (e.g. label in
      // HTML), or is a descendant of a native host language text alternative

      //if(labelParentNode) {
      //if (currentNode.matches('textarea,button')) {
      // return currentNode.value.trim() || currentNode.textContent.trim();
      //}
      //}

      if (currentNode.childNodes.length) {
        let final = [];
        currentNode.childNodes.forEach((childNode) => {
          if (childNode.nodeType === 3) {
            final.push(childNode.nodeValue.trim());
          } else if (childNode.nodeType === 1) {
            final.push(calculateNode(childNode, "recursion"));
          }
        });
        return appendPseudoContent(currentNode, final.join(" ").trim());
      }

      if (currentNode.nodeType === 3) {
        return currentNode.nodeValue.trim();
      }

      if (currentNode.placeholder) {
        return currentNode.placeholder;
      }

      if (currentNode.alt) {
        return currentNode.alt;
      }

      if (currentNode.title) {
        return currentNode.title;
      }

      if (currentNode.value && currentNode.value.trim() !== "") {
        return currentNode.value.trim();
      }

      if (node.matches("[aria-valuenow]")) {
        const nodeLabel = node.getAttribute("aria-valuenow").trim();
        return nodeLabel !== "" ? nodeLabel : false;
      }

      return "";
    };

    return calculateNode(node);
  };

  const isLiveRegion = (node) => {
    return (
      node.nodeType === 1 &&
      node.matches(positiveLookUp.join(",")) &&
      !node.matches(negativeLookUp.join(","))
    );
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

  const pageObserver = (mutationsList, observer) => {
    for (let mutation of mutationsList) {
      if (mutation.type === "childList" && mutation.addedNodes !== undefined) {
        for (let node of mutation.addedNodes) {
          if (isLiveRegion(node)) {
            if (node.nerderegion === undefined) {
              watchRegion(node, false);
            }
          }
        }
      }
      if (
        mutation.type === "childList" &&
        mutation.removedNodes !== undefined
      ) {
        for (let node of mutation.removedNodes) {
          if (node.nerderegion === true) {
            unwatchRegion(node);
          }
        }
      }
      if (mutation.type === "attributes") {
        if (
          isLiveRegion(mutation.target) &&
          mutation.target.nerderegion === undefined
        ) {
          watchRegion(mutation.target, false);
        } else if (
          !isLiveRegion(mutation.target) &&
          mutation.target.nerderegion
        ) {
          unwatchRegion(mutation.target);
        }
      }
    }
  };
  const pageMutation = new MutationObserver(pageObserver);

  const regionObserver = (mutationsList) => {
    let mutatedParents = [];
    for (let mutation of mutationsList) {
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

  const watchRegion = (node, inDOM) => {
    watchNum += 1;
    node.nerderegion = true;
    node.dataset.nerderegionid = watchNum.toString();
    sendToDevTools({
      action: "watch",
      data: getRegionProps(node),
      inDOM: inDOM
    });
    regionMutation.observe(node, {
      attributes: true,
      subtree: true,
      childList: true,
      characterData: true
    });
  };

  const unwatchRegion = (node) => {
    sendToDevTools({
      action: "unwatch",
      data: node.dataset.nerderegionid
    });
    delete node.nerderegion;
  };

  const initRegions = () => {
    document.querySelectorAll(positiveLookUp.join(",")).forEach((node) => {
      if (!node.matches(negativeLookUp.join(","))) {
        watchRegion(node, true);
      }
    });
    pageMutation.observe(document.body, {
      attributeFilter: ["role", "aria-live"],
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
          captureRegion = true;
          initRegions();
          break;
        case "stopTrack":
          captureRegion = false;
          pageMutation.disconnect();
          regionMutation.disconnect();
          break;
        case "reset":
          captureRegion = false;
          pageMutation.disconnect();
          regionMutation.disconnect();
          resetRegions();
          captureRegion = true;
          initRegions();
          break;
      }
    }
  };

  const initialize = () => {
    chrome.runtime.onMessage.addListener((message) => {
      route(message);
    });
    if (captureRegion){
      sendToDevTools({
        action: "ready",
        data: window.location.hostname
      });
    }
  };

  if (document.readyState != "loading") {
    initialize();
  } else {
    document.addEventListener("DOMContentLoaded", initialize);
  }
})();
