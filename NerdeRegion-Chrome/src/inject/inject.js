/**
 * Helper for NerdeRegion extension, which gets injected to web pages
 *
 * @author Ugurcan (Ugi) Kutluoglu <ugurcank@gmail.com>
 */

const NerdeRegion = (function () {
	let watchList = [];
	const regions = [
		'[aria-live="polite"]',
		'[aria-live="assertive"]',
		'[role="alert"]',
		'[role="log"]',
		'[role="status"]'
	];

	const sendObjectToDevTools = (message) => {
		chrome.extension.sendMessage(message);
	};

	const getPath = function (node) {
		const commonNames = ['selected', 'active', 'focus', 'hover', 'enable', 'hidden', 'visible', 'valid', 'disable', 'col-'];
		let path, allSiblings;
		while (node) {
			let realNode = node;
			let name = realNode.tagName;
			if (!name) {
				break;
			}
			name = name.toLowerCase();
			if (realNode.id && /^[A-Za-z][\da-zA-Z_:.-]/.test(realNode.id) && document.querySelectorAll('[id=' + realNode.id + ']').length === 1) {
				name = '#' + realNode.id;
				path = name + (path ? '>' + path : '');
				break;
			}
			let className = '';
			let classList = realNode.className.split(/\s+/);
			for (let i = 0; i < classList.length; i++) {
				if (/^[\da-zA-Z_-]/.test(classList[i]) && commonNames.findIndex(function (str) {return classList[i].indexOf(str) !== -1;}) === -1 && document.querySelectorAll('.' + classList[i]).length === 1) {
					className = '.' + classList[i];
					break;
				}
			}
			if (className != '') {
				path = className + (path ? '>' + path : '');
				break;
			}
			let parent = node.parentNode;
			if (parent) {
				let sameTagSiblings = parent.querySelectorAll(name);
				if (sameTagSiblings.length > 1) {
					allSiblings = parent.childNodes;
					let index = -1;
					let num = 0;
					for (let i = 0; i < allSiblings.length; i++) {
						if (allSiblings[i] == node) {index = num;}
						if (allSiblings[i].nodeType == 1) num++;
					}
					if (index > 1) {
						name += ':nth-child(' + index + ')';
					}
				}
			}
			path = name + (path ? '>' + path : '');
			node = parent;
		}
		return path;
	};

	const checkAttribute = (node, attribute, values) => {
		if(node.attributes !== undefined &&
			attribute in node.attributes &&
			values.includes(node.attributes[attribute].nodeValue.toLowerCase())) {
			return true;
		}
		return false;
	};

	const checkRegion = (mutation) => {
		if (mutation.type === 'childList' && mutation.addedNodes !== undefined) {
			for(let node of mutation.addedNodes) {
				if(checkAttribute(node, 'aria-live', ['polite', 'assertive'])) {
					return true;
				}
			}
		}
		return false;
	};

	const checkRole = (mutation) => {
		if (mutation.type === 'childList' && mutation.addedNodes !== undefined) {
			for(let node of mutation.addedNodes) {
				if(checkAttribute(node, 'role', ['alert', 'log', 'status'])) {
					if(checkAttribute(node, 'aria-live', ['off'])) {
						return false;
					}
					return true;
				}
			}
		}
		return false;
	};

	const pageMutation = (mutationsList)=>{
		for(let mutation of mutationsList) {
			if(checkRegion(mutation) || checkRole(mutation)) {
				findRegions();
			}
		}
	};

	const regionMutation = ()=>{
		dumpRegions();
	};

	const pageObserver = new MutationObserver(pageMutation);
	const regionObserver = new MutationObserver(regionMutation);

	const findRegions = () => {
		document.querySelectorAll(regions.join(',')).forEach((element) => {
			if(element.nerderegion === undefined) {
				element.nerderegion = true;
				element.dataset.nerderegion = 'init';
			}
		});
		document.querySelectorAll('[data-nerderegion=init]').forEach((element) => {
			watchList.push(element);
			element.dataset.nerderegion = 'track';
			element.dataset.nerderegionid = watchList.length.toString();
			regionObserver.observe(element, {attributes:true, subtree:true, childList: true, characterData:true});
		});
	};

	const dumpRegions = () => {
		watchList.forEach((node)=>{
			console.log(node.dataset.nerderegionid + ') ' + getPath(node) + ' | ' + node.textContent);
		});
	};

	const initialize = () => {
		findRegions();
		dumpRegions();
		pageObserver.observe(document.body, {attributeFilter:['role', 'aria-live'], subtree:true, childList: true});
	};

	if (document.readyState != 'loading') {
		initialize();
	} else {
		document.addEventListener('DOMContentLoaded', initialize);
	}
})();
