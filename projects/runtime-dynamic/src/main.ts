import { ApplicationRef, enableProdMode, NgModuleRef, Injector } from '@angular/core';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';

import { AppModule } from './app/app.module';
import { isIos, isSpotcues } from '@wm/core';
import { initSpotCues } from '@wm/runtime/base';

declare const _;

const DEBUG_MODE = 'debugMode';

if (sessionStorage.getItem(DEBUG_MODE) !== 'true') {
    enableProdMode();
}

console.time('bootstrap');


document.addEventListener('DOMContentLoaded', () => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', './extensions/customRoutes.json');
    xhr.responseType = 'json';
    xhr.onload = function (e) {
        if (this.status == 200) {
            console.log('response', this.response); // JSON response  
            window['WM_CUSTOM_ROUTES'] =  this.response;
            new Promise(resolve => {
                if (isSpotcues) {
                    initSpotCues().then(resolve);
                } else if (window['cordova']) {
                    document.addEventListener('deviceready', resolve);
                } else {
                    resolve(null);
                }
            }).then(() => platformBrowserDynamic().bootstrapModule(AppModule))
                .then((appModuleRef: NgModuleRef<AppModule>) => {
                    const applicationRef = appModuleRef.injector.get(ApplicationRef);
                    window.addEventListener('unload', () => {
                        applicationRef.components.map(c => c && c.destroy());
                    });
                    console.timeEnd('bootstrap');
                }, err => console.log(err));
        }
    };
    xhr.send();
});

(window as any).debugMode = function (on) {
    if (_.isEmpty(on)) {
        on = true;
    }
    const value = on ? 'true' : 'false';
    if (sessionStorage.getItem(DEBUG_MODE) !== value) {
        sessionStorage.setItem(DEBUG_MODE, value);
        window.location.reload();
    }
};

export default () => { };
