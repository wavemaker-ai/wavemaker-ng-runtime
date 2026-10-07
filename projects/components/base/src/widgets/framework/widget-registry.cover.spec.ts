import { getById, register, renameWidget } from './widget-registry';

describe('widget-registry remaining branches', () => {
    it('unregister of a widget registered without a name only removes it from the id registry', () => {
        const viewParent: any = { Widgets: { other: 1 } };
        const widget = {};
        const unregister = register(widget, viewParent, 'cov-id-1');
        expect(getById('cov-id-1')).toBe(widget);
        unregister();
        expect(getById('cov-id-1')).toBeUndefined();
        expect(viewParent.Widgets).toEqual({ other: 1 });
    });

    it('does not attach to viewParent when it has no Widgets, and unregister does not touch it', () => {
        const viewParent: any = {};
        const unregister = register({}, viewParent, 'cov-id-2', 'w');
        expect(viewParent.Widgets).toBeUndefined();
        expect(() => unregister()).not.toThrow();
        expect(getById('cov-id-2')).toBeUndefined();
    });

    it('renameWidget without an old name just adds the new name', () => {
        const widget = {};
        const viewParent: any = { Widgets: { keep: 1 } };
        renameWidget(viewParent, widget, 'fresh');
        expect(viewParent.Widgets).toEqual({ keep: 1, fresh: widget });
    });
});
