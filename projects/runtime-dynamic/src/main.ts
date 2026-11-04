import { ApplicationRef, enableProdMode } from '@angular/core';

import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from '@wm/runtime/base';
import { appConfig } from './app/app.config';

const DEBUG_MODE = 'debugMode';

if (sessionStorage.getItem(DEBUG_MODE) !== 'true') {
    enableProdMode();
}
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

// debugMode() or debugMode(true) switches debug mode on, debugMode(false) switches it off
(window as any).debugMode = function (on = true) {
    const value = on ? 'true' : 'false';
    if (sessionStorage.getItem(DEBUG_MODE) !== value) {
        sessionStorage.setItem(DEBUG_MODE, value);
        window.location.reload();
    }
};

export default () => { };
