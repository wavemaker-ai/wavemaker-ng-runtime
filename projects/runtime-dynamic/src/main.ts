import { ApplicationRef, enableProdMode } from '@angular/core';

import { isEmpty } from "lodash-es";
import { bootstrapApplication } from '@angular/platform-browser';
import {setPreviewProperties} from '@wm/core';
import { AppComponent } from '@wm/runtime/base';
import { appConfig } from './app/app.config';
import {CustomIconsLoaderService} from '@wm/core'

const DEBUG_MODE = 'debugMode';

if (sessionStorage.getItem(DEBUG_MODE) !== 'true') {
    enableProdMode();
}
fetch('./font.config.js')
    .then(response => response.text())
    .then((fontConfig) => {
        setPreviewProperties({ fontConfig });
        const iconLoader = new CustomIconsLoaderService();
        iconLoader.load();
    })
console.time('bootstrap');

// MEMORY LEAK FIX: Store event handler references for cleanup
let domContentLoadedHandler: (() => void) | null = null;
let unloadHandler: ((event: Event) => void) | null = null;

domContentLoadedHandler = () => {
  new Promise<Event | void>(resolve => {
      resolve();
  }).then(() => bootstrapApplication(AppComponent, appConfig))
    .then((appRef: ApplicationRef) => { 
      // MEMORY LEAK FIX: Store unload handler reference for potential cleanup
      unloadHandler = (event: Event) => {
        appRef.components.map(c => c?.destroy());
        // MEMORY LEAK FIX: Remove event listener after use
        if (unloadHandler) {
          window.removeEventListener('unload', unloadHandler);
          unloadHandler = null;
        }
      };
      window.addEventListener('unload', unloadHandler);
    })
    .catch(err => console.error('Error bootstrapping app:', err));
    
  // MEMORY LEAK FIX: Remove DOMContentLoaded listener after use
  if (domContentLoadedHandler) {
    document.removeEventListener('DOMContentLoaded', domContentLoadedHandler);
    domContentLoadedHandler = null;
  }
};

document.addEventListener('DOMContentLoaded', domContentLoadedHandler);

(window as any).debugMode = function (on) {
    if (isEmpty(on)) {
        on = true;
    }
    const value = on ? 'true' : 'false';
    if (sessionStorage.getItem(DEBUG_MODE) !== value) {
        sessionStorage.setItem(DEBUG_MODE, value);
        window.location.reload();
    }
};

export default () => { };
