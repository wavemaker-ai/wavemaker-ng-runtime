import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { getFontConfig, loadStyleSheets } from "../utils/utils";

@Injectable({providedIn: 'root'})
export class CustomIconsLoaderService {
    // private http = inject(HttpClient);
    load() {
        const existing = getFontConfig();
        const fontConfig = existing?.default ?? existing;

        // Deployed/codegen apps already have fontConfig on _WM_APP_PROPERTIES.
        if (fontConfig?.fonts) {
            this.loadCss(fontConfig);
            return;
        }

        // Studio preview does not embed fontConfig; load font.config.js as a module.
        if (!_WM_APP_PROJECT?.isPreview) {
            this.loadCss(undefined);
            return;
        }

        void loadPreviewFontConfig()
            .then(props => this.loadCss(props?.default))
            .catch(() => this.loadCss(undefined));
    }
     /*
     * Deployed Angular builds copy resources/ into the deploy folder (ng-bundle/<hash>/), not next to index.html,
     * so a bare "resources/..." path 404s when only the UI artifact is deployed. Prefix it with cdnUrl, as getImageUrl
     * and the i18n service do. Preview, absolute URLs and paths outside resources/ are left unchanged.
     */
    private resolveCssPath(csspath: string): string {
        const cdnUrl = _WM_APP_PROJECT?.cdnUrl;
        if (_WM_APP_PROJECT?.isPreview || !cdnUrl || csspath.startsWith(cdnUrl)) {
            return csspath;
        }
        const relativePath = csspath.startsWith('./') ? csspath.substring(2) : csspath;
        return relativePath.startsWith('resources/') ? cdnUrl + relativePath : csspath;
    }

    private loadCss(fontConfig: any) {
        const cssPaths = (fontConfig?.fonts ?? [])
            .filter(font => !!font.csspath)
            .map(font => this.resolveCssPath(font.csspath));

        loadStyleSheets(cssPaths);
    }
}

