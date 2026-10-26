import { Injectable, Injector } from '@angular/core';


import { App, UtilsService } from '@wm/core';

import { AppJSProvider } from '../types/types';
import { AppManagerService } from '../services/app.manager.service';

let appJsLoaded = false;

@Injectable()
export class AppJSResolve {
    private readonly appManager;

    // AppManagerService: To be make sure this instance available for locale(en.json) calls request to track inside intercepter
    constructor(
        private readonly inj: Injector,
        private readonly app: App,
        private readonly utilService: UtilsService,
        private readonly appJsProvider: AppJSProvider
    ) {
        this.appManager = this.inj.get(AppManagerService);
    }

    async resolve() {
        if (appJsLoaded) {
            return true;
        }

        try {
            // execute app.js
            const appScriptFn = await this.appJsProvider.getAppScriptFn();
            appScriptFn(this.app, this.utilService, this.inj);
        } catch (e) {
            console.warn('Error in executing app.js', e);
        }

        appJsLoaded = true;

        return true;
    }
}
