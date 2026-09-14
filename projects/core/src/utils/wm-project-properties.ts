const properties: any = {};
const previewProp: any = {};
declare const window;
declare const _WM_APP_PROPERTIES;

const EMPTY_FONT_CONFIG = { baseFont: '', fonts: [] as any[] };

export function getWmProjectProperties() {
    if (window._WM_APP_PROPERTIES) {
        return window._WM_APP_PROPERTIES;
    } else if(typeof _WM_APP_PROPERTIES !== "undefined") {
        return _WM_APP_PROPERTIES;
    } else {
        return properties;
    }
}

export function setWmProjectProperties(props: any) {
    Object.setPrototypeOf(properties, props);
}
export function setPreviewProperties(props: any) {
    Object.assign(previewProp, props);
}

function toFontConfigObject(fontConfig: any) {
    if (!fontConfig || typeof fontConfig !== 'object') {
        return EMPTY_FONT_CONFIG;
    }
    const config = fontConfig.default && typeof fontConfig.default === 'object'
        ? fontConfig.default
        : fontConfig;
    return {
        baseFont: config.baseFont || '',
        fonts: Array.isArray(config.fonts) ? config.fonts : []
    };
}

export function getPreviewProperties() {
    if (!previewProp.fontConfig) {
        return undefined;
    }
    return { default: toFontConfigObject(previewProp.fontConfig) };
}

export async function loadPreviewFontConfig(): Promise<any> {
    const url = new URL('./font.config.js', document.baseURI).href;
    const mod = await import(/* webpackIgnore: true */ url);
    setPreviewProperties({ fontConfig: mod });
    return getPreviewProperties();
}
