import { APPLY_STYLES_TYPE, isStyle, propNameCSSKeyMap, styler } from './styler';

jest.mock('@wm/core', () => ({
    ...jest.requireActual('@wm/core'),
    setCSS: jest.fn(),
}));

jest.mock('../../utils/widget-utils', () => ({
    ...jest.requireActual('../../utils/widget-utils'),
    getBackGroundImageUrl: jest.fn((v: string) => `url(${v})`),
}));

import { setCSS } from '@wm/core';

describe('styler', () => {
    let listener: (key: string, nv: any) => void;
    let component: any;
    const node = document.createElement('div');

    const apply = (type?: APPLY_STYLES_TYPE, skipList?: string[]) => {
        component = {
            fontsize: '',
            fontunit: '',
            picturesource: '',
            registerStyleChangeListener: jest.fn((fn: any) => (listener = fn)),
        };
        styler(node, component, type, skipList);
    };

    beforeEach(() => jest.clearAllMocks());

    it('knows which property names are styles', () => {
        expect(isStyle('backgroundcolor')).toBe(true);
        expect(isStyle('caption')).toBe(false);
        expect(propNameCSSKeyMap.horizontalalign).toBe('textAlign');
    });

    it('maps property changes to css properties', () => {
        apply();
        listener('backgroundcolor', 'red');
        expect(setCSS).toHaveBeenCalledWith(node, 'backgroundColor', 'red');
        listener('unknownprop', 'x');
        expect(setCSS).toHaveBeenCalledTimes(1);
    });

    it('skips listed keys', () => {
        apply(undefined, ['color']);
        listener('color', 'red');
        expect(setCSS).not.toHaveBeenCalled();
    });

    it('combines font size and unit', () => {
        apply();
        component.fontsize = '12';
        listener('fontsize', '12');
        expect(setCSS).toHaveBeenLastCalledWith(node, 'fontSize', '12px');
        component.fontunit = 'em';
        listener('fontunit', 'em');
        expect(setCSS).toHaveBeenLastCalledWith(node, 'fontSize', '12em');
        component.fontsize = '';
        listener('fontsize', '');
        expect(setCSS).toHaveBeenLastCalledWith(node, 'fontSize', '');
    });

    it('prefers the picture source for background images', () => {
        apply();
        listener('backgroundimage', 'a.png');
        expect(setCSS).toHaveBeenLastCalledWith(node, 'backgroundImage', 'url(a.png)');
        component.picturesource = 'url(pic.png)';
        listener('backgroundimage', 'a.png');
        expect(setCSS).toHaveBeenLastCalledWith(node, 'backgroundImage', 'url(pic.png)');
    });

    it('ignores layout properties for shells', () => {
        apply(APPLY_STYLES_TYPE.SHELL);
        listener('height', '10px');
        listener('padding', '1px');
        expect(setCSS).not.toHaveBeenCalled();
        listener('color', 'red');
        expect(setCSS).toHaveBeenCalledWith(node, 'color', 'red');
    });

    it('only applies layout properties to inner shells and toggles the overflow', () => {
        apply(APPLY_STYLES_TYPE.INNER_SHELL);
        listener('color', 'red');
        expect(setCSS).not.toHaveBeenCalled();
        listener('height', '100px');
        expect(setCSS).toHaveBeenCalledWith(node, 'overflow', 'auto');
        expect(setCSS).toHaveBeenCalledWith(node, 'height', '100px');
        listener('height', '');
        expect(setCSS).toHaveBeenCalledWith(node, 'overflow', '');
    });

    it('ignores text alignment for containers', () => {
        apply(APPLY_STYLES_TYPE.CONTAINER);
        listener('textalign', 'center');
        expect(setCSS).not.toHaveBeenCalled();
        listener('width', '10px');
        expect(setCSS).toHaveBeenCalledWith(node, 'width', '10px');
    });

    it('ignores text alignment and width for scrollable containers and toggles the overflow', () => {
        apply(APPLY_STYLES_TYPE.SCROLLABLE_CONTAINER);
        listener('textalign', 'center');
        listener('width', '10px');
        expect(setCSS).not.toHaveBeenCalled();
        listener('height', '50px');
        expect(setCSS).toHaveBeenCalledWith(node, 'overflow', 'auto');
        listener('height', '');
        expect(setCSS).toHaveBeenCalledWith(node, 'overflow', '');
    });
});
