import { Injectable } from '@angular/core';
import { getFontConfig, loadStyleSheets, _WM_APP_PROJECT } from "../utils/utils";
import { loadPreviewFontConfig } from "../utils/wm-project-properties";

@Injectable({providedIn: 'root'})
export class CustomIconsLoaderService {
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

    private loadCss(fontConfig: any) {
        const cssPaths = (fontConfig?.fonts ?? [])
            .filter(font => !!font.csspath)
            .map(font => font.csspath);

        loadStyleSheets(cssPaths);
    }
}
