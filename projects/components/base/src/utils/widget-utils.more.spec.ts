import { $parseExpr } from '@wm/core';
import {
    getBackGroundImageUrl,
    getEvaluatedData,
    getImageUrl,
    getMatchModeMsgs,
    prepareFieldDefs
} from './widget-utils';

jest.mock('@wm/core', () => ({
    ...jest.requireActual('@wm/core'),
    $parseExpr: jest.fn(),
}));

describe('widget-utils - more', () => {
    const win: any = window;
    let originalProject: any;

    beforeEach(() => {
        originalProject = win._WM_APP_PROJECT;
        win._WM_APP_PROJECT = { isPreview: true, cdnUrl: '' };
        (global as any)._WM_APP_PROJECT = win._WM_APP_PROJECT;
    });

    afterEach(() => {
        win._WM_APP_PROJECT = originalProject;
        (global as any)._WM_APP_PROJECT = originalProject;
        jest.clearAllMocks();
    });

    describe('getEvaluatedData bind expressions', () => {
        const parsed = (expr: string) => {
            const fn = jest.fn().mockReturnValue('v');
            ($parseExpr as jest.Mock).mockReturnValue(fn);
            getEvaluatedData({ a: [1] }, { bindExpression: 'bind:' + expr });
            return ($parseExpr as jest.Mock).mock.calls[0][0];
        };

        it('keeps nested brackets inside an unquoted $[...] reference', () => {
            expect(parsed('$[a[0]] + 1')).toBe('a[0] + 1');
        });

        it('skips the white space between the brackets and a quoted key', () => {
            expect(parsed("$[ 'my key' ]")).toBe("__1[ 'my key' ]");
        });
    });

    describe('getImageUrl defaults', () => {
        it('uses the default url when it is a valid web url and no image is given', () => {
            expect(getImageUrl('', false, 'https://cdn.example.com/default.png')).toBe('https://cdn.example.com/default.png');
        });

        it('uses a custom relative default when no image is given', () => {
            expect(getImageUrl(undefined, false, 'resources/custom.png')).toBe('resources/custom.png');
        });

        it('falls back to the built in default image', () => {
            expect(getImageUrl(undefined)).toBe('resources/images/imagelists/default-image.png');
        });
    });

    describe('getBackGroundImageUrl', () => {
        it('wraps the resolved image url in url()', () => {
            expect(getBackGroundImageUrl('images/a.png')).toBe('url(images/a.png)');
        });
    });

    describe('getMatchModeMsgs', () => {
        it('maps every match mode to its locale label', () => {
            const locale = new Proxy({}, { get: (_t, key) => String(key) });
            const msgs: any = getMatchModeMsgs(locale);
            expect(msgs.start).toBe('LABEL_STARTS_WITH');
            expect(msgs.anywhereignorecase).toBe('LABEL_CONTAINS_IGNORECASE');
            expect(msgs.nullorempty).toBe('LABEL_IS_NULL_OR_EMPTY');
            expect(msgs.between).toBe('LABEL_BETWEEN');
            expect(Object.keys(msgs)).toHaveLength(22);
        });
    });

    describe('prepareFieldDefs', () => {
        it('keeps non-string titles as they are', () => {
            const defs: any[] = prepareFieldDefs([['x', 'y']]) as any;
            expect(defs.map(d => d.field)).toEqual([0, 1]);
            expect(defs.map(d => d.displayName)).toEqual([0, 1]);
        });

        it('only looks at the first ten rows when filling null values of the first row', () => {
            const rows: any[] = [{ name: null, city: null }];
            for (let i = 1; i < 12; i++) {
                rows.push(i === 11 ? { late: 'x' } : i === 3 ? { name: 'n', city: 'c' } : {});
            }
            const defs: any[] = prepareFieldDefs(rows) as any;
            expect(defs.map(d => d.field)).toEqual(['name', 'city']);
        });
    });
});
