/**
 * Helper for NerdeRegion extension, which gets injected to web pages
 *
 * @author Ugurcan (Ugi) Kutluoglu <ugurcank@gmail.com>
 */

const NerdeFocus = (function () {

    const sendObjectToDevTools = (message) => {
        chrome.extension.sendMessage(message);
    };

    const initialize = () => {

    };

    if (document.readyState != 'loading'){
        initialize();
    } else {
        document.addEventListener('DOMContentLoaded', initialize);
    }
})();
