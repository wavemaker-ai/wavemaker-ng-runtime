import { AutoLayoutUtils } from './autolayout-utils';

class TestLayout extends AutoLayoutUtils {
    css = jest.fn();
    constructor() {
        super();
        this.$element = { css: this.css, 0: document.createElement('div') };
    }
    spacing(key: string, nv: string) {
        this.applySpacing(key, nv);
    }
    size(key: string, nv: any) {
        (this as any).applySize(key, nv);
    }
}

describe('AutoLayoutUtils cover', () => {
    let layout: TestLayout;

    beforeEach(() => {
        layout = new TestLayout();
    });

    it('applyDirection keeps wrap for row direction and disables it for column', () => {
        layout.hasWrap = true;
        layout.applyDirection('row');
        expect(layout.hasWrap).toBe(true);
        layout.applyDirection('column');
        expect(layout.hasWrap).toBe(false);
    });

    it('applyAlignment reflects wrap and swaps axes in column direction', () => {
        layout.direction = 'column';
        layout.hasWrap = true;
        layout.applyAlignment('top-right');
        expect(layout.css).toHaveBeenCalledWith({
            display: 'flex',
            'flex-wrap': 'wrap',
            justifyContent: 'flex-start',
            alignItems: 'flex-end'
        });
    });

    it('applySpacing without wrap in column direction swaps justify/align values', () => {
        layout.direction = 'column';
        layout.alignment = 'top-right';
        layout.spacing('gap', '8');
        expect(layout.css).toHaveBeenCalledWith({
            'justify-content': 'flex-start',
            'align-items': 'flex-end',
            gap: '8px'
        });
        expect(layout.gap).toBe('8');
    });

    it('applySpacing with wrap in column direction swaps axes for matching gaps', () => {
        layout.direction = 'column';
        layout.hasWrap = true;
        layout.alignment = 'top-right';
        layout.spacing('gap', '4');
        // columngap undefined -> not auto, falsy colVal -> no css call, but values are stored
        expect(layout.css).not.toHaveBeenCalled();
        layout.columngap = '4';
        layout.spacing('gap', '4');
        expect(layout.css).toHaveBeenCalledWith({
            gap: '4px',
            'align-content': 'flex-end',
            'justify-content': 'flex-start'
        });
    });

    it('applySpacing with wrap and no usable gap values applies no gap styles', () => {
        layout.hasWrap = true;
        layout.spacing('gap', '0');
        expect(layout.css).not.toHaveBeenCalled();
        expect(layout.gap).toBe('0');
    });

    it('applyStyleChange ignores unrelated style keys and applies zindex to sticky position', () => {
        layout.applyStyleChange('color', 'red');
        expect(layout.css).not.toHaveBeenCalled();
        layout.position = 'sticky';
        layout.applyStyleChange('zindex', '5');
        expect(layout.css).toHaveBeenCalledWith(expect.objectContaining({ position: 'sticky', 'z-index': '5' }));
    });

    it('hug sizing applies fit-content for height and nothing for other keys', () => {
        layout.size('height', 'hug');
        expect(layout.css).toHaveBeenCalledWith('height', 'fit-content');
        layout.css.mockClear();
        layout.size('width', 'hug');
        expect(layout.css).toHaveBeenCalledWith('width', 'fit-content');
        layout.css.mockClear();
        layout.size('min-width', 'hug');
        expect(layout.css).not.toHaveBeenCalled();
    });
});
