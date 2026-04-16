import { Injectable } from '@angular/core';
import { HttpEvent, HttpHandler, HttpInterceptor, HttpRequest, HttpResponse } from '@angular/common/http';

import {from, Observable, Subject, switchMap} from 'rxjs';
import { tap } from 'rxjs/operators';

import { httpService, appManager } from '@wm/variables';
import { WmHttpRequest, WmHttpResponse } from '@wm/http';
import {extend} from "lodash-es";
import {_WM_APP_PROJECT} from "@wm/core";

/**
 * This Interceptor intercepts all network calls and if a network call fails
 * due to session timeout, then it calls a function to handle session timeout.
 */
@Injectable()
export class HttpCallInterceptor implements HttpInterceptor {

    wmHttpRequest: any;
    wmHttpResponse: any;

    constructor() {
        this.wmHttpRequest = new WmHttpRequest();
        this.wmHttpResponse = new WmHttpResponse();
    }

    createSubject() {
        return new Subject();
    }

    isAbsoluteUrl(url: string) {
        return /^[a-z][a-z0-9+.-]*:\/\//i.test(url);
    }

    intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
        let modifiedReq;
        let modifiedResp;
        let isRelativeAPIUrl = false;
        if(!this.isAbsoluteUrl(request.url)) {
            isRelativeAPIUrl = request.url.indexOf("services/") !== -1 || request.url.indexOf("j_spring_security_check") !== -1 || request.url.indexOf("j_spring_security_logout") !== -1 || request.url.indexOf("oAuthCallback.html") !== -1 || request.url.startsWith("resources/") || request.url.startsWith("prefabs/");
        }
        if(isRelativeAPIUrl) {
            let apiUrl= _WM_APP_PROJECT.apiUrl + request.url;
            request = request.clone({ url: apiUrl });
        }

        return from(
            Promise.resolve().then(() => {
                if (appManager && appManager.appOnBeforeServiceCall) {
                    const wmReq = this.wmHttpRequest.angularToWmRequest(request);
                    return appManager.appOnBeforeServiceCall(wmReq);
                }
                return null;
            }))
            .pipe(
                switchMap((receivedModifiedReq) => {
                    if (receivedModifiedReq) {
                        request = this.wmHttpRequest.wmToAngularRequest(receivedModifiedReq);
                    }
                    return next.handle(request);
                 }),
                tap((response: any) => {
                        if (response && response.type === 4 && appManager &&  appManager.appOnServiceSuccess) {
                            // Convert the angular HttpResponse to wm HttpResponse
                            const resp = this.wmHttpResponse.angularToWmResponse(response);
                            // trigger the common success handler present in app.js
                            modifiedResp = appManager.appOnServiceSuccess(resp.body, resp);
                            if (modifiedResp) {
                                // Convert the wm HttpResponse to angular HttpResponse
                                modifiedResp = this.wmHttpResponse.wmToAngularResponse(modifiedResp);
                                extend(response, modifiedResp);
                            }
                        }
                    },
                    error => {
                        error._401Subscriber = this.createSubject();
                        if (httpService.isPlatformSessionTimeout(error)) {
                            httpService.handleSessionTimeout(request, error._401Subscriber);
                        }
                        if (appManager && appManager.appOnServiceError) {
                            // Convert the angular HttpResponse to wm HttpResponse
                            const err = this.wmHttpResponse.angularToWmResponse(error);
                            // trigger the common error handler present in app.js
                            modifiedResp = appManager.appOnServiceError(err.message, err);
                            if (modifiedResp) {
                                // Convert the wm HttpResponse to angular HttpResponse
                                modifiedResp = this.wmHttpResponse.wmToAngularResponse(modifiedResp);
                                extend(error, modifiedResp);
                            }
                        }
                    }
                )
        );
    }
}
