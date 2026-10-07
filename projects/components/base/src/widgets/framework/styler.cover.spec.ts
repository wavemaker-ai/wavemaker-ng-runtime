import { APPLY_STYLES_TYPE, styler } from './styler';

jest.mock('@wm/core', () => ({
    ...jest.requireActual('@wm/core'),
    setCSS: jest.fn(),
}));

import { setCSS } from '@wm/core';

describe('styler (non-height branches)', () => {
    let listener: (key: string, nv: any) => void;
    const node = document.createElement('div');
    const apply = (type: APPLY_STYLES_TYPE) => {
        styler(node, { fontsize: '', fontunit: '', picturesource: '', registerStyleChangeListener: (fn: any) => (listener = fn) } as any, type);
    };
    beforeEach(() => jest.clearAllMocks());

    it('inner shell: other ignore-list keys do not toggle overflow', () => {
        apply(APPLY_STYLES_TYPE.INNER_SHELL);
        listener('padding', '4px');
        expect(setCSS).toHaveBeenCalledWith(node, 'padding', '4px');
        expect(setCSS).not.toHaveBeenCalledWith(node, 'overflow', expect.anything());
    });

    it('scrollable container: non-height keys do not toggle overflow', () => {
        apply(APPLY_STYLES_TYPE.SCROLLABLE_CONTAINER);
        listener('color', 'red');
        expect(setCSS).toHaveBeenCalledWith(node, 'color', 'red');
        expect(setCSS).not.toHaveBeenCalledWith(node, 'overflow', expect.anything());
    });
});
