import { Subject } from 'rxjs';
import { ListItemDirective } from './list-item.directive';
import { BaseFormComponent } from '@wm/components/input/base-form';

describe('ListItemDirective (cover)', () => {
    const superProto = () => Object.getPrototypeOf(ListItemDirective.prototype);
    let dir: any;

    beforeEach(() => {
        dir = Object.create(ListItemDirective.prototype);
        dir.nativeElement = document.createElement('li');
        dir.listComponent = {};
        dir.context = { $index: 3 };
        dir.destroySub = new Subject();
    });

    afterEach(() => jest.restoreAllMocks());

    describe('itemAttrsHandler', () => {
        it('does nothing when the list has no item attributes map', () => {
            dir.setProperty = jest.fn();
            dir.itemAttrsHandler();
            expect(dir.setProperty).not.toHaveBeenCalled();
        });

        it('applies every item attribute as a property', () => {
            dir.setProperty = jest.fn();
            dir.listComponent.itemAttrsMap = { a: 1, b: 'x' };
            dir.itemAttrsHandler();
            expect(dir.setProperty).toHaveBeenCalledWith('a', 1);
            expect(dir.setProperty).toHaveBeenCalledWith('b', 'x');
        });
    });

    describe('watchers', () => {
        it('falls back to an empty item class and false disable flag for falsy watched values', () => {
            const cbs: Record<string, Function> = {};
            dir.registerWatch = jest.fn((expr: string, cb: Function) => { cbs[expr] = cb; });
            dir.itemClassWatcher({ binditemclass: 'cls.expr' });
            dir.disableItemWatcher({ binddisableitem: 'dis.expr' });
            cbs['cls.expr']('big');
            cbs['dis.expr'](true);
            expect(dir.itemClass).toBe('big');
            expect(dir.disableItem).toBe(true);
            cbs['cls.expr'](null);
            cbs['dis.expr'](undefined);
            expect(dir.itemClass).toBe('');
            expect(dir.disableItem).toBe(false);
        });

        it('uses static item class and disable flag when not bound', () => {
            dir.itemClassWatcher({ itemclass: 'static' });
            dir.disableItemWatcher({ disableitem: true });
            expect(dir.itemClass).toBe('static');
            expect(dir.disableItem).toBe(true);
            dir.disableItemWatcher({});
            expect(dir.disableItem).toBe(false);
        });
    });

    describe('ngOnInit', () => {
        it('registers no mouse handlers when the list has no mouse callbacks and sets the item index', () => {
            jest.spyOn(superProto(), 'ngOnInit').mockImplementation(() => undefined);
            const add = jest.spyOn(dir.nativeElement, 'addEventListener');
            dir.ngOnInit();
            expect(add).not.toHaveBeenCalled();
            expect(dir.nativeElement.getAttribute('listitemindex')).toBe('3');
        });
    });

    describe('ngAfterViewInit', () => {
        beforeEach(() => jest.spyOn(superProto(), 'ngAfterViewInit').mockImplementation(() => undefined));

        const formWidget = (bound: any) => {
            const w: any = Object.create(BaseFormComponent.prototype);
            w.$attrs = new Map(bound ? [['datavaluesource.bind', 'x']] : []);
            return w;
        };

        it('sets the list datasource on form widgets without a datavaluesource binding only', () => {
            dir.listComponent = { datasource: 'DS' };
            const unbound = formWidget(false), bound = formWidget(true);
            const other: any = { widget: {} };
            const mk = (widget: any) => { const e: any = document.createElement('div'); e.setAttribute('widget-id', 'w'); e.widget = widget; dir.nativeElement.appendChild(e); };
            mk(unbound); mk(bound); mk(other.widget);
            dir.ngAfterViewInit();
            expect(unbound.datavaluesource).toBe('DS');
            expect(bound.datavaluesource).toBeUndefined();
            expect(other.widget.datavaluesource).toBeUndefined();
        });
    });

    describe('ngOnDestroy', () => {
        beforeEach(() => jest.spyOn(superProto(), 'ngOnDestroy').mockImplementation(() => undefined));

        it('tolerates already-cleared members', () => {
            dir.context = null;
            dir.viewContainerRef = null;
            dir.destroySub = null;
            dir.nativeElement = null;
            expect(() => dir.ngOnDestroy()).not.toThrow();
        });

        it('skips removing handlers that were never registered even when the CUD elements exist', () => {
            dir.nativeElement.innerHTML = '<a class="edit-list-item"></a><a class="delete-list-item"></a>';
            const rm = jest.spyOn(dir.nativeElement.querySelector('.edit-list-item'), 'removeEventListener');
            dir.ngOnDestroy();
            expect(rm).not.toHaveBeenCalled();
        });

        it('does not signal an already closed destroy subject', () => {
            const next = jest.spyOn(dir.destroySub, 'next');
            dir.destroySub.unsubscribe();
            dir.ngOnDestroy();
            expect(next).not.toHaveBeenCalled();
            expect(dir.destroySub).toBeNull();
        });

        it('swallows errors thrown while removing listeners or signalling', () => {
            dir.boundMouseEnterHandler = () => undefined;
            dir.boundMouseLeaveHandler = () => undefined;
            dir.nativeElement.innerHTML = '<a class="edit-list-item"></a><a class="delete-list-item"></a>';
            dir.boundEditHandler = () => undefined;
            dir.boundDeleteHandler = () => undefined;
            jest.spyOn(dir.nativeElement, 'removeEventListener').mockImplementation(() => { throw new Error('x'); });
            jest.spyOn(Element.prototype, 'removeEventListener').mockImplementation(() => { throw new Error('x'); });
            jest.spyOn(dir.destroySub, 'next').mockImplementation(() => { throw new Error('x'); });
            expect(() => dir.ngOnDestroy()).not.toThrow();
            expect(dir.boundMouseEnterHandler).toBeNull();
            expect(dir.boundMouseLeaveHandler).toBeNull();
            expect(dir.boundEditHandler).toBeNull();
            expect(dir.boundDeleteHandler).toBeNull();
            expect(dir.destroySub).toBeNull();
        });
    });
});
