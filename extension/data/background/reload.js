import browser from 'webextension-polyfill';

import {messageHandlers} from '../messageHandling';

messageHandlers.set('ah-reload', () => {
    browser.runtime.reload();
});
