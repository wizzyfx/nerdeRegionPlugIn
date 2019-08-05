/**
 * Helper for NerdeRegion extension, which gets injected to web pages
 *
 * @author Ugurcan (Ugi) Kutluoglu <ugurcank@gmail.com>
 */

const NerdeRegion = (function () {

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

	const regionMutation = (mutationsList)=>{
		for(let mutation of mutationsList) {
			console.log(mutation.target.textContent);
		}
	};

	const pageObserver = new MutationObserver(pageMutation);
	const regionObserver = new MutationObserver(regionMutation);

	const findRegions = () => {
		document.querySelectorAll(regions.join(',')).forEach((element) => {
			if(element.nerderegion === undefined) {
				element.nerderegion = true;
				element.dataset.nerderegion = 'init';
				console.log(element.textContent);
				regionObserver.observe(element, {attributes:true, subtree:true, childList: true});
			}
		});
	};

	const initialize = () => {
		findRegions();
		pageObserver.observe(document.body, {attributeFilter:['role', 'aria-live'], subtree:true, childList: true});
	};

	if (document.readyState != 'loading') {
		initialize();
	} else {
		document.addEventListener('DOMContentLoaded', initialize);
	}
})();
