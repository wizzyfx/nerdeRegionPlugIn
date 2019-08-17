const getAccessibleName = function (node) {
	// https://www.w3.org/TR/accname-1.1/

	const isHidden = function (node) {
		const nodeStyle = window.getComputedStyle(node);
		return (['none', 'hidden'].includes(nodeStyle.display) || node.matches('[aria-hidden=true]'));
	};

	const isAriaReferenced = function (node) {
		if (node.id && /^[A-Za-z][\da-zA-Z_:.-]/.test(node.id)) {
			return document.querySelectorAll(`[aria-labelledby~='${node.id}'],[aria-describedby~='${node.id}']`).length > 0;
		}
		return false;
	};

	const isLabelable = function (node) {
		const labelables = [
			'button',
			'input:not([type="hidden"])',
			'keygen',
			'meter',
			'output',
			'progress',
			'select',
			'textarea',
		];
		return node.matches(labelables.join(','));
	};

	const getLabelingDescendant = function (node) {
		const labelables = {
			'figure': 'figcaption',
			'table': 'caption',
			'fieldset': 'legend',
		};
		if(node.matches(Object.keys(labelables).join(','))) {
			const tag = node.tagName.toLowerCase();
			const labelNode = node.querySelector(labelables[tag]);
			if (labelNode) {
				return labelNode;
			}
		}
		return false;
	};

	const getLabelNodes = function (node) {
		const nodeId = node.id;
		if (nodeId && /^[A-Za-z][\da-zA-Z_:.-]/.test(nodeId)) {
			const labelNodes = document.querySelectorAll(`label[for=${nodeId}]`);
			if (labelNodes.length) {
				return labelNodes;
			}
		}
		return false;
	};

	const getLabelParentNode = function (node) {
		const labelNode = node.parentNode.closest('label');
		if (labelNode) {return labelNode;}
		return false;
	};

	const getAriaLabel = function (node) {
		if(node.matches('[aria-label]')) {
			const nodeLabel = node.getAttribute('aria-label').trim();
			return nodeLabel !== '' ? nodeLabel : false;
		}
		return false;
	};

	const getAriaLabelNodes = function (node) {
		let refNodes = [];
		if(node.matches('[aria-labelledby]')) {
			const refIds = node.getAttribute('aria-labelledby').split(/\s+/);
			refIds.forEach((id)=>{
				let refNode = document.querySelector(`#${id}`);
				if(refNode) {
					refNodes.push(refNode);
				}
			});
		}
		return refNodes;
	};

	const appendPseudoContent = function (node, text) {
		const pattern = /^"(.*)"$/m;
		let before = pattern.exec(window.getComputedStyle(node, ':before').getPropertyValue('content'));
		let after = pattern.exec(window.getComputedStyle(node, ':after').getPropertyValue('content'));
		before = before != null ? before[1] : '';
		after = after != null ? after[1] : '';
		return before + text + after;
	};

	let visited = [];
	const calculateNode = function (currentNode, traversalType = 'normal', ignoreHidden = false, parentNode = {}) {
		console.log(currentNode);

		if (visited.includes(currentNode)) {
			return '';
		} else {
			visited.push(currentNode);
		}

		// A) If the current node is hidden and is not directly referenced by aria-labelledby or
		// aria-describedby return the empty string.
		if (!ignoreHidden) {
			if(isHidden(currentNode)) {
				console.log('A');
				return '';
			}
		}

		// B) If the current node has an aria-labelledby attribute that contains at least one
		// valid IDREF, and the current node is not already part of an aria-labelledby traversal,
		// process its IDREFs in the order they occur
		if(traversalType !== 'aria-labelledby') {
			const ariaLabelNodes = getAriaLabelNodes(currentNode);
			if(ariaLabelNodes.length) {
				console.log('B');
				return ariaLabelNodes.map(function (node) {
					return calculateNode(node, 'aria-labelledby', true);
				}).join(' ');
			}
		}

		// C) If the current node has an aria-label attribute whose value is not the empty string, nor, when trimmed
		// of white space, is not the empty string.
		// TODO If traversal of the current node is due to recursion and the current node is an embedded control
		//  as defined in step 2E, ignore aria-label and skip to rule 2E.
		const ariaLabel = getAriaLabel(currentNode);
		if(ariaLabel) {
			console.log('C');
			return ariaLabel;
		}

		// D) f the current node's native markup provides an attribute (e.g. title) or element (e.g. HTML label)
		// that defines a text alternative, return that alternative in the form of a flat string as defined by the
		// host language, unless the element is marked as presentational (role="presentation" or role="none").
		// TODO: Return flat string
		if(!currentNode.matches('[role=none],[role=presentation]')) {
			if(isLabelable(currentNode)) {
				const labelNodes = getLabelNodes(currentNode);
				if (labelNodes) {
					let labels = [];
					labelNodes.forEach(function (node) {
						console.log('DR');
						labels.push(calculateNode(node, 'labeling-nodes'));
					});
					console.log('D1');
					return labels.join(' ');
				}
			}

			if(currentNode.placeholder) {
				console.log('D2');
				return currentNode.placeholder;
			}

			if(currentNode.alt) {
				console.log('D3');
				return currentNode.alt;
			}

			if(currentNode.title && currentNode.matches('abbr,acronym')) {
				console.log('D4');
				return currentNode.title;
			}

			const labelingDescendant = getLabelingDescendant(currentNode);
			if(labelingDescendant) {
				console.log('D5');
				return calculateNode(labelingDescendant, 'labeling-descendant');
			}
		}

		// E) If the current node is a control embedded within the label (e.g. the label element in HTML or any element
		// directly referenced by aria-labelledby) for another widget, where the user can adjust the embedded control's
		// value, then include the embedded control

		const labelParentNode = getLabelParentNode(currentNode);
		if(labelParentNode) {
			console.log('E');
			return calculateNode(labelParentNode, 'labeling-parent');
		}

		// F) Otherwise, if the current node's role allows name from content, or if the current node is referenced by
		// aria-labelledby, aria-describedby, or is a native host language text alternative element (e.g. label in
		// HTML), or is a descendant of a native host language text alternative



		//if(labelParentNode) {
		//if (currentNode.matches('textarea,button')) {
		// return currentNode.value.trim() || currentNode.textContent.trim();
		//}
		//}

		if(currentNode.childNodes.length) {
			let final = '';
			currentNode.childNodes.forEach((childNode)=>{
				if(childNode.nodeType === 3) {
					final += childNode.nodeValue.trim();
				} else if(childNode.nodeType === 1) {
					console.log('FR');
					final += calculateNode(childNode, 'recursion');
				}
			});
			console.log('F');
			return appendPseudoContent(currentNode, final);
		}

		if(currentNode.nodeType === 3) {
			console.log('G');
			return currentNode.nodeValue.trim();
		}

		console.log('Z');

	};

	return calculateNode(node);
};

document.querySelectorAll('.accname-test').forEach(function (el) {
	let acname = getAccessibleName(document.querySelector('#' + el.dataset.test));
	el.textContent = acname;
	if (acname === el.dataset.name) {el.classList.add('pass');}

});
