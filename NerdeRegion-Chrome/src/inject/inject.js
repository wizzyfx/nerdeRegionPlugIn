/**
 * Helper for NerdeRegion extension, which gets injected to web pages
 *
 * @author Ugurcan (Ugi) Kutluoglu <ugurcank@gmail.com>
 */

const NerdeFocus = (function () {
	const regions = [
		'[aria-live="polite"]',
		'[aria-live="assertive"]',
		'alert',
		'log',
		'status',
		'[role="alert"]',
		'[role="log"]',
		'[role="status"]'
	];

	const sendObjectToDevTools = (message) => {
		chrome.extension.sendMessage(message);
	};

	const findRegions = () => {
		return document.querySelectorAll(regions.join(','));
	};

	const callback = (mutationsList)=>{
		for(let mutation of mutationsList) {
			if (mutation.type === 'childList' && mutation.addedNodes !== undefined) {
				for(let addedNode of mutation.addedNodes) {
					if(addedNode.attributes !== undefined && 'aria-live' in addedNode.attributes){
						console.log(findRegions());
					}
				}
			}
		}
	};

	const initialize = () => {
		console.log(findRegions());
		const observer = new MutationObserver(callback);
		observer.observe(document.body, { attributes: true, childList: true, subtree: true });
	};

	if (document.readyState != 'loading'){
		initialize();
	} else {
		document.addEventListener('DOMContentLoaded', initialize);
	}
})();
