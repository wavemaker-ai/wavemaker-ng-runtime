/**
 * Rollup bridge for @angular/common HTTP UMD build.
 *
 * `http.mjs` side-effect-imports `./xhr.mjs`, which otherwise gets inlined into
 * `common-http.umd.js` as a *second* `XhrFactory` class. `HttpXhrBackend` then
 * injects that local token, while `platform-browser` registers `ng.common.XhrFactory`
 * — different tokens → NG0201 at runtime.
 *
 * Re-export `XhrFactory` from `@angular/common` so HttpXhrBackend and BrowserXhr
 * share the same DI token. `parseCookieValue` stays a local copy (same as xhr.mjs).
 */
export { XhrFactory } from '@angular/common';

export function parseCookieValue(cookieStr, name) {
    name = encodeURIComponent(name);
    for (const cookie of cookieStr.split(';')) {
        const eqIndex = cookie.indexOf('=');
        const [cookieName, cookieValue] = eqIndex == -1 ? [cookie, ''] : [cookie.slice(0, eqIndex), cookie.slice(eqIndex + 1)];
        if (cookieName.trim() === name) {
            return decodeURIComponent(cookieValue);
        }
    }
    return null;
}
