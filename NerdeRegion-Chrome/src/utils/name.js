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

	const getLabelNode = function (node) {
		const nodeId = node.id;
		if (nodeId && /^[A-Za-z][\da-zA-Z_:.-]/.test(nodeId)) {
			const labelNode = document.querySelector(`label[for=${nodeId}]`);
			if (labelNode) {
				return labelNode;
			}
		}
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

	const calculateName = function (currentNode, ignoreHidden = false, ignoreLabelledBy = false) {
		// A) If the current node is hidden and is not directly referenced by aria-labelledby or
		// aria-describedby return the empty string.
		if (!ignoreHidden) {
			if(isHidden(currentNode)) {
				return '';
			}
		}

		// B) If the current node has an aria-labelledby attribute that contains at least one
		// valid IDREF, and the current node is not already part of an aria-labelledby traversal,
		// process its IDREFs in the order they occur
		if(!ignoreLabelledBy) {
			const ariaLabelNodes = getAriaLabelNodes(currentNode);
			if(ariaLabelNodes.length) {
				return ariaLabelNodes.map(function (node) {
					return calculateName(node, true, node === currentNode);
				}).join(' ');
			}
		}

		// C) If the current node has an aria-label attribute whose value is not the empty string, nor, when trimmed
		// of white space, is not the empty string.
		// TODO If traversal of the current node is due to recursion and the current node is an embedded control
		//  as defined in step 2E, ignore aria-label and skip to rule 2E.
		const ariaLabel = getAriaLabel(currentNode);
		if(ariaLabel) {
			return ariaLabel;
		}

		// D) f the current node's native markup provides an attribute (e.g. title) or element (e.g. HTML label)
		// that defines a text alternative, return that alternative in the form of a flat string as defined by the
		// host language, unless the element is marked as presentational (role="presentation" or role="none").

		if(!currentNode.matches('[role=none],[role=presentation]')) {
			if(isLabelable(currentNode)) {
				const labelNode = getLabelNode(currentNode);
				if (labelNode) {
					return calculateName(labelNode);
				}
			}

			if(currentNode.placeholder) {
				return currentNode.placeholder;
			}

			if(currentNode.alt) {
				return currentNode.alt;
			}

			if(currentNode.title && currentNode.matches('abbr,acronym')) {
				return currentNode.title;
			}

			const labelingDescendant = getLabelingDescendant(currentNode);
			if(labelingDescendant) {
				return calculateName(labelingDescendant);
			}
		}

		// E) If the current node is a control embedded within the label (e.g. the label element in HTML or any element
		// directly referenced by aria-labelledby) for another widget, where the user can adjust the embedded control's
		// value, then include the embedded control


		return currentNode.textContent;
	};

	return calculateName(node);
};

document.querySelectorAll('.accname-test').forEach(function (el) {
	let acname = getAccessibleName(document.querySelector('#' + el.dataset.test));
	el.textContent = acname;
	if (acname === el.dataset.name) {el.classList.add('pass');}

});
