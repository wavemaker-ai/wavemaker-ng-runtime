const mockWatch = jest.fn();
const mockDigest = jest.fn();
const mockSuperDestroy = jest.fn();

jest.mock('ngx-toastr', () => ({
    Toast: class Toast {
        message = jest.fn();
        options = jest.fn();
        ngOnDestroy() { mockSuperDestroy(); }
    }
}));
jest.mock('@wm/core', () => ({
    ...jest.requireActual('@wm/core'),
    $watch: (...a) => mockWatch(...a),
    $appDigest: (...a) => mockDigest(...a)
}));
jest.mock('@wm/components/base', () => ({
    ContainerDirective: class ContainerDirective {},
    PartialContainerDirective: class PartialContainerDirective {},
    PartialParamDirective: class PartialParamDirective {},
    PartialParamHandlerDirective: class PartialParamHandlerDirective {}
}));

import { CustomToasterComponent } from './custom-toaster.component';

declare const $;

describe('CustomToasterComponent', () => {
    let comp: any;

    beforeEach(() => {
        jest.clearAllMocks();
        comp = new (CustomToasterComponent as any)();
        comp.message.mockReturnValue('PageName');
        comp.options.mockReturnValue({ partialParams: [], context: { c: 1 } });
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    describe('ngOnInit / generateParams', () => {
        it('uses the message as the page name and generates static params', () => {
            comp.options.mockReturnValue({ partialParams: [{ name: 'a', value: 1 }, { name: 'b', value: 'plain' }] });
            comp.ngOnInit();
            expect(comp.pagename).toBe('PageName');
            expect(comp.params).toEqual({ a: 1, b: 'plain' });
        });

        it('falls back to an empty page name', () => {
            comp.message.mockReturnValue(undefined);
            comp.ngOnInit();
            expect(comp.pagename).toBe('');
        });

        it('watches bound params and digests on change', () => {
            const unwatch = jest.fn();
            mockWatch.mockReturnValue(unwatch);
            const context = { c: 1 };
            comp.options.mockReturnValue({ partialParams: [{ name: 'x', value: 'bind:Variables.v.dataSet' }], context });
            comp.generateParams();
            expect(mockWatch).toHaveBeenCalledWith('Variables.v.dataSet', context, {}, expect.any(Function));
            mockWatch.mock.calls[0][3]('NV');
            expect(comp.params.x).toBe('NV');
            expect(mockDigest).toHaveBeenCalled();
            expect(comp.watchers).toEqual([unwatch]);
        });

        it('treats non-bind string and non-string values as static', () => {
            comp.options.mockReturnValue({ partialParams: [{ name: 'a', value: 'bindless' }, { name: 'b', value: { o: 1 } }] });
            comp.generateParams();
            expect(mockWatch).not.toHaveBeenCalled();
            expect(comp.params).toEqual({ a: 'bindless', b: { o: 1 } });
        });
    });

    describe('view rendering', () => {
        it('renders the template into the toast container on view init', async () => {
            document.body.innerHTML = '<div class="parent-custom-toast"></div>';
            const node = document.createElement('div');
            comp.customToastRef = { clear: jest.fn(), createEmbeddedView: jest.fn(() => ({ rootNodes: [node] })) };
            comp.customToastTmpl = {};
            comp.ngAfterViewInit();
            await Promise.resolve();
            expect(comp.customToastRef.clear).toHaveBeenCalledTimes(1);
            expect(document.querySelector('.parent-custom-toast').contains(node)).toBe(true);
        });
    });

    describe('ngOnDestroy', () => {
        it('disposes watchers and calls the base class', () => {
            const w1 = jest.fn();
            const w2 = jest.fn();
            comp.watchers = [w1, w2];
            comp.ngOnDestroy();
            expect(w1).toHaveBeenCalledTimes(1);
            expect(w2).toHaveBeenCalledTimes(1);
            expect(mockSuperDestroy).toHaveBeenCalledTimes(1);
        });
    });
});
