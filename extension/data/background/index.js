import browser from 'webextension-polyfill';

function handleMessage (request, sender) {
    return Promise.response(makeRequest(request, sender));
}

browser.runtime.onMessage.addListener(handleMessage);
