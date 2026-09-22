import { AutoLayoutUtils } from './autolayout-utils';

describe('AutoLayoutUtils', () => {
    let utils: any;
    let cssCalls: any[];

    beforeEach(() => {
        utils = new AutoLayoutUtils();
        cssCalls = [];
        utils.$element = { css: jest.fn((...args) => cssCalls.push(args)) };
    });

    describe('applyDirection', () => {
        it('should set the direction, apply flex display and reapply alignment', () => {
            utils.applyDirection('column');
            expect(utils.direction).toBe('column');
            expect(utils.hasWrap).toBe(false);
            expect(utils.$element.css).toHaveBeenCalledWith({ display: 'flex', flexDirection: 'column' });
        });
    });

    describe('applyWrap', () => {
        it('should toggle flex-wrap based on the given value', () => {
            utils.applyWrap(true);
            expect(utils.hasWrap).toBe(true);
            expect(utils.$element.css).toHaveBeenCalledWith('flex-wrap', 'wrap');
            utils.applyWrap(false);
            expect(utils.$element.css).toHaveBeenCalledWith('flex-wrap', 'nowrap');
        });
    });

    describe('applyAlignment', () => {
        it('should do nothing for a falsy or unknown alignment key', () => {
            utils.applyAlignment('');
            utils.applyAlignment('not-a-real-key');
            expect(utils.$element.css).not.toHaveBeenCalled();
        });

        it('should map justify/align content directly for the row direction', () => {
            utils.direction = 'row';
            utils.applyAlignment('top-left');
            expect(utils.$element.css).toHaveBeenCalledWith(expect.objectContaining({
                justifyContent: 'flex-start', alignItems: 'flex-start',
            }));
        });

        it('should swap justify/align content for the column direction', () => {
            utils.direction = 'column';
            utils.applyAlignment('top-right');
            // top-right => { justifyContent: 'flex-end', alignItems: 'flex-start' }; swapped for column
            expect(utils.$element.css).toHaveBeenCalledWith(expect.objectContaining({
                justifyContent: 'flex-start', alignItems: 'flex-end',
            }));
        });
    });

    describe('applySpacing', () => {
        beforeEach(() => {
            utils.alignment = 'top-left';
            utils.direction = 'row';
        });

        it('should apply the default justify/align content when gap is auto (no wrap)', () => {
            utils.applySpacing('gap', 'auto');
            expect(utils.$element.css).toHaveBeenCalledWith({ 'justify-content': 'flex-start', 'align-items': 'flex-start' });
        });

        it('should apply an explicit gap in px when not auto (no wrap)', () => {
            utils.applySpacing('gap', '10');
            expect(utils.$element.css).toHaveBeenCalledWith(expect.objectContaining({ gap: '10px' }));
            expect(utils.gap).toBe('10');
        });

        it('should apply align-content/justify-content only when both gap and columngap are auto (wrap)', () => {
            // gapValue for a 'columngap' call is read from this.gap (not the nv argument) - it
            // must be pre-set to 'auto' for the "both auto" branch to actually trigger.
            utils.hasWrap = true;
            utils.gap = 'auto';
            utils.applySpacing('columngap', 'auto');
            expect(utils.$element.css).toHaveBeenCalledWith({ 'justify-content': 'flex-start', 'align-content': 'flex-start' });
        });

        it('should apply row-gap when gap is set and columngap is auto (wrap)', () => {
            // colValue for a 'gap' call is read from this.columngap - pre-set it to 'auto'.
            utils.hasWrap = true;
            utils.columngap = 'auto';
            utils.applySpacing('gap', '8');
            expect(utils.$element.css).toHaveBeenCalledWith(expect.objectContaining({ 'row-gap': '8px' }));
        });

        it('should apply column-gap when columngap is set and gap is auto (wrap)', () => {
            utils.hasWrap = true;
            utils.gap = 'auto';
            utils.applySpacing('columngap', '6');
            expect(utils.$element.css).toHaveBeenCalledWith(expect.objectContaining({ 'column-gap': '6px' }));
        });

        it('should apply a single combined gap when row and column gaps are equal (wrap)', () => {
            utils.hasWrap = true;
            utils.gap = '10';
            utils.applySpacing('columngap', '10');
            expect(utils.$element.css).toHaveBeenCalledWith(expect.objectContaining({ gap: '10px' }));
        });

        it('should apply a "row col" shorthand gap when they differ (wrap)', () => {
            utils.hasWrap = true;
            utils.gap = '10';
            utils.applySpacing('columngap', '5');
            expect(utils.$element.css).toHaveBeenCalledWith(expect.objectContaining({ gap: '10px 5px' }));
        });

        it('should do nothing when the current alignment is not in the alignment matrix', () => {
            utils.alignment = 'unknown';
            utils.applySpacing('gap', '10');
            expect(utils.$element.css).not.toHaveBeenCalled();
        });
    });

    describe('onPropertyChange', () => {
        it('should dispatch direction changes to applyDirection', () => {
            const spy = jest.spyOn(utils, 'applyDirection');
            utils.onPropertyChange('direction', 'column');
            expect(spy).toHaveBeenCalledWith('column');
        });

        it('should dispatch wrap changes to applyWrap', () => {
            const spy = jest.spyOn(utils, 'applyWrap');
            utils.onPropertyChange('wrap', true);
            expect(spy).toHaveBeenCalledWith(true);
        });

        it('should store and dispatch alignment changes', () => {
            const spy = jest.spyOn(utils, 'applyAlignment');
            utils.onPropertyChange('alignment', 'middle-center');
            expect(utils.alignment).toBe('middle-center');
            expect(spy).toHaveBeenCalledWith('middle-center');
        });

        it('should defer gap/columngap changes to applySpacing via setTimeout', () => {
            jest.useFakeTimers();
            const spy = jest.spyOn(utils, 'applySpacing').mockImplementation(() => {});
            utils.onPropertyChange('gap', '10');
            expect(spy).not.toHaveBeenCalled();
            jest.runAllTimers();
            expect(spy).toHaveBeenCalledWith('gap', '10');
            jest.useRealTimers();
        });

        it('should store position and call handlePosition', () => {
            const spy = jest.spyOn(utils, 'handlePosition').mockImplementation(() => {});
            utils.onPropertyChange('position', 'sticky');
            expect(utils.position).toBe('sticky');
            expect(spy).toHaveBeenCalled();
        });

        it('should store clipcontent and call handleClipBehaviour', () => {
            const spy = jest.spyOn(utils, 'handleClipBehaviour').mockImplementation(() => {});
            utils.onPropertyChange('clipcontent', true);
            expect(utils.clipContent).toBe(true);
            expect(spy).toHaveBeenCalled();
        });
    });

    describe('applyStyleChange', () => {
        it('should dispatch width/height to applySize', () => {
            const spy = jest.spyOn(utils, 'applySize').mockImplementation(() => {});
            utils.applyStyleChange('width', 'fill');
            expect(spy).toHaveBeenCalledWith('width', 'fill');
        });

        it('should set padding directly', () => {
            utils.applyStyleChange('padding', '10px');
            expect(utils.$element.css).toHaveBeenCalledWith('padding', '10px');
        });

        it('should store overflow and call handleClipBehaviour', () => {
            const spy = jest.spyOn(utils, 'handleClipBehaviour').mockImplementation(() => {});
            utils.applyStyleChange('overflow', 'Vertical');
            expect(utils.overflowtype).toBe('Vertical');
            expect(spy).toHaveBeenCalled();
        });

        it('should store zindex and call handlePosition', () => {
            const spy = jest.spyOn(utils, 'handlePosition').mockImplementation(() => {});
            utils.applyStyleChange('zindex', '5');
            expect(utils.zIndex).toBe('5');
            expect(spy).toHaveBeenCalled();
        });
    });

    describe('applySize (private, via applyStyleChange)', () => {
        it('should fall back to 100% when there is no parent element', () => {
            utils.$element = { 0: undefined, css: jest.fn() };
            utils.applyStyleChange('width', 'fill');
            expect(utils.$element.css).toHaveBeenCalledWith('width', '100%');
        });

        it('should fall back to 100% when the parent is not a flex container', () => {
            const parent = document.createElement('div');
            parent.style.display = 'block';
            const child = document.createElement('div');
            parent.appendChild(child);
            utils.$element = { 0: child, css: jest.fn() };
            utils.applyStyleChange('width', 'fill');
            expect(utils.$element.css).toHaveBeenCalledWith('width', '100%');
        });

        it('should grow on the main axis when the flex parent direction matches (row + width)', () => {
            const parent = document.createElement('div');
            parent.style.display = 'flex';
            parent.style.flexDirection = 'row';
            const child = document.createElement('div');
            parent.appendChild(child);
            utils.$element = { 0: child, css: jest.fn() };
            utils.applyStyleChange('width', 'fill');
            expect(utils.$element.css).toHaveBeenCalledWith('flex-grow', '1');
        });

        it('should stretch on the cross axis when the flex parent direction does not match (row + height)', () => {
            const parent = document.createElement('div');
            parent.style.display = 'flex';
            parent.style.flexDirection = 'row';
            const child = document.createElement('div');
            parent.appendChild(child);
            utils.$element = { 0: child, css: jest.fn() };
            utils.applyStyleChange('height', 'fill');
            expect(utils.$element.css).toHaveBeenCalledWith('align-self', 'stretch');
        });

        it('should use fit-content for the hug size', () => {
            utils.applyStyleChange('width', 'hug');
            expect(utils.$element.css).toHaveBeenCalledWith('width', 'fit-content');
        });

        it('should disable shrink for a fixed size value', () => {
            utils.applyStyleChange('width', '200px');
            expect(utils.$element.css).toHaveBeenCalledWith('flex-shrink', '0');
        });
    });

    describe('handleClipBehaviour (private, via applyStyleChange overflow)', () => {
        it('should set vertical scroll only', () => {
            utils.applyStyleChange('overflow', 'vertical');
            expect(utils.$element.css).toHaveBeenCalledWith({ 'overflow-x': 'hidden', 'overflow-y': 'scroll' });
        });

        it('should set horizontal scroll only', () => {
            utils.applyStyleChange('overflow', 'horizontal');
            expect(utils.$element.css).toHaveBeenCalledWith({ 'overflow-x': 'scroll', 'overflow-y': 'hidden' });
        });

        it('should set scroll on both directions', () => {
            utils.applyStyleChange('overflow', 'both directions');
            expect(utils.$element.css).toHaveBeenCalledWith({ overflow: 'scroll' });
        });

        it('should hide overflow for "no scrolling" when clipContent is set', () => {
            utils.clipContent = true;
            utils.applyStyleChange('overflow', 'no scrolling');
            expect(utils.$element.css).toHaveBeenCalledWith({ overflow: 'hidden' });
        });

        it('should reset overflow for "no scrolling" when clipContent is not set', () => {
            utils.applyStyleChange('overflow', 'no scrolling');
            expect(utils.$element.css).toHaveBeenCalledWith({ overflow: '' });
        });

        it('should do nothing for an unrecognized overflow type', () => {
            utils.applyStyleChange('overflow', 'weird-type');
            expect(utils.$element.css).not.toHaveBeenCalled();
        });
    });

    describe('handlePosition (private, via onPropertyChange position)', () => {
        it('should apply sticky positioning styles', () => {
            utils.zIndex = '3';
            utils.onPropertyChange('position', 'sticky');
            expect(utils.$element.css).toHaveBeenCalledWith({ position: 'sticky', top: '0', left: '0', 'z-index': '3' });
        });

        it('should reset to static/relative for any non-sticky position', () => {
            utils.onPropertyChange('position', 'relative');
            expect(utils.$element.css).toHaveBeenCalledWith({ position: '', top: '', left: '', 'z-index': '' });
        });
    });
});
