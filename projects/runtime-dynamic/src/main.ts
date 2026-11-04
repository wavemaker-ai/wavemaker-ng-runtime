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


document.addEventListener('DOMContentLoaded', () => {
  new Promise<Event | void>(resolve => {
      resolve();
  }).then(() => bootstrapApplication(AppComponent, appConfig))
    .then((appRef: ApplicationRef) => {
      const onPageHide = (event: PageTransitionEvent) => {
        if (event.persisted) {
          return;
        }
        appRef.components.forEach(c => c?.destroy());
        window.removeEventListener('pagehide', onPageHide);
      };
      window.addEventListener('pagehide', onPageHide);
    })
    .catch(err => console.error('Error bootstrapping app:', err));
});

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
