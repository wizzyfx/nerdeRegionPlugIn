/**
 * Helper for NerdeRegion extension, which gets injected to web pages
 *
 * @author Ugurcan (Ugi) Kutluoglu <ugurcank@gmail.com>
 */

const NerdeFocus = (function () {

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

	const findRegions = () => {
		document.querySelectorAll(regions.join(',')).forEach((element) => {
			if(element.nerderegion === undefined) {
				element.nerderegion = true;
				element.dataset.nerderegion = 'init';
				console.log(element);
			}
		});
	};

	const checkRegion = (mutation) => {
		if (mutation.type === 'childList' && mutation.addedNodes !== undefined) {
			for(let node of mutation.addedNodes) {
				if(node.attributes !== undefined && 'aria-live' in node.attributes && ['polite', 'assertive'].includes(node.attributes['aria-live'].nodeValue.toLowerCase())) {
					return true;
				}
			}
		}
		return false;
	};

	const checkRole = (mutation) => {
		if (mutation.type === 'childList' && mutation.addedNodes !== undefined) {
			for(let node of mutation.addedNodes) {
				if(node.attributes !== undefined && 'role' in node.attributes && ['alert', 'log', 'status'].includes(node.attributes['role'].nodeValue.toLowerCase())) {
					if('aria-live' in node.attributes && node.attributes['aria-live'].nodeValue.toLowerCase() === 'off') {
						return false;
					}
					return true;
				}
			}
		}
		return false;
	};

	const callback = (mutationsList)=>{
		for(let mutation of mutationsList) {
			if(checkRegion(mutation) || checkRole(mutation)) {
				findRegions();
			}
		}
	};

	const initialize = () => {
		findRegions();
		const observer = new MutationObserver(callback);
		observer.observe(document.body, { attributes: true, childList: true, subtree: true });
	};

	if (document.readyState != 'loading') {
		initialize();
	} else {
		document.addEventListener('DOMContentLoaded', initialize);
	}
})();
