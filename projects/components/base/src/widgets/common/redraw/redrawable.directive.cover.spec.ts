import { RedrawableDirective } from './redrawable.directive';

describe('RedrawableDirective (cover)', () => {
    const makeEl = () => {
        const el: any = { closest: jest.fn().mockReturnThis(), find: jest.fn().mockReturnThis(), hasClass: jest.fn(), length: 0 };
        return el;
    };

    it('should redraw only inner widgets exposing a redraw function for a prefab', () => {
        const inner = { redraw: jest.fn() };
        const widget: any = { $element: makeEl(), widgetType: 'wm-prefab-x', Widgets: { a: inner, b: {}, c: { redraw: 'nope' } } };
        const d = new RedrawableDirective(widget);
        expect(d.redraw()).toBeUndefined();
        expect(inner.redraw).toHaveBeenCalledTimes(1);
    });

    it('should not throw for a prefab without a Widgets collection', () => {
        const widget: any = { $element: makeEl(), widgetType: 'wm-prefab-x' };
        const d = new RedrawableDirective(widget);
        expect(() => d.redraw()).not.toThrow();
    });
});
