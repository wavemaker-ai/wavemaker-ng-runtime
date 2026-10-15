const mockProject: any = { isPreview: true, cdnUrl: 'cdn/' };
let mockChangeFromWatch = false;
const mockUnwatch = jest.fn();
const mockDigest = jest.fn();
const mockReset = jest.fn();

jest.mock('@wm/core', () => ({
    ...jest.requireActual('@wm/core'),
    $appDigest: (...a: any[]) => mockDigest(...a),
    $unwatch: (...a: any[]) => mockUnwatch(...a),
    isChangeFromWatch: () => mockChangeFromWatch,
    resetChangeFromWatch: (...a: any[]) => mockReset(...a),
    _WM_APP_PROJECT: mockProject,
}));

const mockProps = new Map<string, any>();
let mockWidgetProps: any = mockProps;
jest.mock('./widget-props', () => ({
    ...jest.requireActual('./widget-props'),
    getWidgetPropsByType: jest.fn(() => mockWidgetProps),
}));

jest.mock('./styler', () => ({
    ...jest.requireActual('./styler'),
    isStyle: (key: string) => key === 'color',
}));

import { globalPropertyChangeHandler } from './property-change-handler';
import { PROP_TYPE } from './widget-props';

const makeComponent = (over: any = {}, prefabAttr?: string) => {
    const attr = jest.fn(() => prefabAttr);
    const closest = jest.fn(() => ({ attr }));
    const parent = jest.fn(() => ({ closest }));
    return {
        widgetId: 'w1',
        getWidgetSubType: () => 'wm-test',
        $element: { parent },
        viewParent: {},
        notifyStyleChange: jest.fn(),
        notifyPropertyChange: jest.fn(),
        ...over,
    } as any;
};

describe('globalPropertyChangeHandler', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockChangeFromWatch = false;
        mockWidgetProps = mockProps;
        mockProps.clear();
        mockProject.isPreview = true;
        mockProject.cdnUrl = 'cdn/';
    });

    describe('watch handling', () => {
        it('removes the watch for changes that do not come from a watch', () => {
            const c = makeComponent();
            globalPropertyChangeHandler(c, 'caption', 'x');
            expect(mockUnwatch).toHaveBeenCalledWith('w1_caption');
            expect(mockReset).toHaveBeenCalled();
        });

        it('keeps the watch for changes that come from a watch', () => {
            mockChangeFromWatch = true;
            globalPropertyChangeHandler(makeComponent(), 'caption', 'x');
            expect(mockUnwatch).not.toHaveBeenCalled();
            expect(mockReset).toHaveBeenCalled();
        });
    });

    describe('value parsing', () => {
        it('parses boolean props, honouring boolean attributes whose value equals the key', () => {
            mockProps.set('disabled', { type: PROP_TYPE.BOOLEAN });
            mockProps.set('flag', { type: PROP_TYPE.BOOLEAN });
            const c = makeComponent({ disabled: false, flag: true });
            globalPropertyChangeHandler(c, 'disabled', 'disabled');
            expect(c.disabled).toBe(true);
            globalPropertyChangeHandler(c, 'flag', 'false');
            expect(c.flag).toBe(false);
        });

        it('parses number props and defaults an undefined tabindex to 0', () => {
            mockProps.set('tabindex', { type: PROP_TYPE.NUMBER });
            mockProps.set('size', { type: PROP_TYPE.NUMBER });
            const c = makeComponent({ tabindex: 5, size: 1 });
            globalPropertyChangeHandler(c, 'tabindex', undefined);
            expect(c.tabindex).toBe(0);
            globalPropertyChangeHandler(c, 'tabindex', 'abc');
            expect(c.tabindex).toBeNaN();
            globalPropertyChangeHandler(c, 'tabindex', '7');
            expect(c.tabindex).toBe(7);
            globalPropertyChangeHandler(c, 'size', '3');
            expect(c.size).toBe(3);
        });

        it('keeps string typed values as they are', () => {
            mockProps.set('title', { type: PROP_TYPE.STRING });
            const c = makeComponent({ title: 'a' });
            globalPropertyChangeHandler(c, 'title', 5);
            expect(c.title).toBe(5);
        });

        it('leaves values untouched for props without a type, or for unknown props', () => {
            mockProps.set('caption', { value: '' });
            const c = makeComponent({ caption: 'a' });
            globalPropertyChangeHandler(c, 'caption', 'b');
            expect(c.caption).toBe('b');
            expect(c.notifyPropertyChange).toHaveBeenCalledWith('caption', 'b', 'a');
            mockWidgetProps = undefined;
            globalPropertyChangeHandler(c, 'other', 'v');
            expect(c.other).toBe('v');
            expect(c.notifyPropertyChange).toHaveBeenCalledTimes(1);
        });
    });

    describe('change detection', () => {
        it('ignores unchanged primitives but not objects', () => {
            const c = makeComponent({ caption: 'a' });
            globalPropertyChangeHandler(c, 'caption', 'a');
            expect(mockDigest).not.toHaveBeenCalled();
            const obj = { x: 1 };
            c.data = obj;
            globalPropertyChangeHandler(c, 'data', obj);
            expect(mockDigest).toHaveBeenCalledTimes(1);
            c.data2 = 'prim';
            globalPropertyChangeHandler(c, 'data2', { y: 1 });
            expect(mockDigest).toHaveBeenCalledTimes(2);
        });

        it('converts dimension props', () => {
            const c = makeComponent({ width: '' });
            globalPropertyChangeHandler(c, 'width', 100);
            expect(c.width).toBe('100px');
        });
    });

    describe('notifications', () => {
        it('notifies style changes for style keys instead of property changes', () => {
            mockProps.set('color', {});
            const c = makeComponent({ color: 'red' });
            globalPropertyChangeHandler(c, 'color', 'blue');
            expect(c.notifyStyleChange).toHaveBeenCalledWith('color', 'blue', 'red');
            expect(c.notifyPropertyChange).not.toHaveBeenCalled();
        });

        it('converts conditionalclass into add/remove lists', () => {
            mockProps.set('conditionalclass', {});
            const c = makeComponent({ conditionalclass: 'old' });
            globalPropertyChangeHandler(c, 'conditionalclass', 'new');
            expect(c.notifyPropertyChange).toHaveBeenCalledWith('conditionalclass', { toAdd: ['new'], toRemove: ['old'] }, 'old');
        });
    });

    describe('resource paths', () => {
        it('prefixes resources with the prefab path found in the DOM and strips "./"', () => {
            const c = makeComponent({}, 'myPrefab');
            globalPropertyChangeHandler(c, 'picturesource', './resources/a.png');
            expect(c.picturesource).toBe('./app/prefabs/myPrefab/resources/a.png');
            expect(c._parentPrefab_).toBe('myPrefab');
        });

        it('uses the cdn resources path for prefabs outside preview and reuses the cached prefab name', () => {
            mockProject.isPreview = false;
            const c = makeComponent({ _parentPrefab_: 'cached' });
            globalPropertyChangeHandler(c, 'picturesource', 'resources/b.png');
            expect(c.picturesource).toBe('cdn/resources/cached/resources/b.png');
        });

        it('falls back to the view parent prefab name when the DOM has none', () => {
            const c = makeComponent({ viewParent: { prefabName: 'fromView' } }, undefined);
            globalPropertyChangeHandler(c, 'picturesource', 'resources/c.png');
            expect(c._parentPrefab_).toBe('fromView');
            expect(c.picturesource).toBe('./app/prefabs/fromView/resources/c.png');
        });

        it('treats a missing prefab as an empty name and prefixes app resources for a non-default value', () => {
            mockProps.set('picturesource', { value: 'resources/default.png' });
            const c = makeComponent({ viewParent: {} });
            globalPropertyChangeHandler(c, 'picturesource', 'resources/d.png');
            expect(c._parentPrefab_).toBe('');
            expect(c.picturesource).toBe('resources/d.png');
            mockProject.isPreview = false;
            const c2 = makeComponent({ viewParent: {} });
            globalPropertyChangeHandler(c2, 'picturesource', 'resources/e.png');
            expect(c2.picturesource).toBe('cdn/resources/e.png');
        });

        it('keeps the default resource value and self prefab values untouched', () => {
            mockProps.set('picturesource', { value: 'resources/default.png' });
            const c = makeComponent({ viewParent: {} });
            globalPropertyChangeHandler(c, 'picturesource', 'resources/default.png');
            expect(c.picturesource).toBe('resources/default.png');
            const self = makeComponent({ _parentPrefab_: '__self__' });
            globalPropertyChangeHandler(self, 'picturesource', 'resources/f.png');
            expect(self.picturesource).toBe('resources/f.png');
        });
    });
});
