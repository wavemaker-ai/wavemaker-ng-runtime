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
      window.addEventListener('unload', () => {
        appRef.components.forEach(c => c?.destroy());
      });
    })
    .catch(err => console.error('Error bootstrapping app:', err));
});

(window as any).debugMode = function () {
    // debug mode can only be switched on: every falsy argument used to be treated as empty and turned into "on"
    const value = 'true';
    if (sessionStorage.getItem(DEBUG_MODE) !== value) {
        sessionStorage.setItem(DEBUG_MODE, value);
        window.location.reload();
    }
};

export default () => { };
