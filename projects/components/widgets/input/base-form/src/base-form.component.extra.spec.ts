import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, Injector } from '@angular/core';
import { WidgetConfig, IWidgetConfig } from '@wm/components/base';
import { App } from '@wm/core';
import { mockApp } from '../../../../base/src/test/util/component-test-util';
import { BaseFormComponent } from './base-form.component';

class Cfg implements IWidgetConfig {
    widgetType = 'wm-input';
    widgetSubType = 'wm-form-field-text';
}

@Component({ standalone: false, selector: 'wm-test-bf', template: '<div></div>' })
class TestBfComponent extends BaseFormComponent {
    constructor(inj: Injector) {
        super(inj, inj.get(WidgetConfig), null);
    }
    public change(v, e?) { this.invokeOnChange(v, e); }
    public prev() { return this.getPrevDataValue(); }
    public setPrev(v) { this.updatePrevDatavalue(v); }
}

describe('BaseFormComponent - additional behaviour', () => {
    let fixture: ComponentFixture<TestBfComponent>;
    let cmp: any;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            declarations: [TestBfComponent],
            providers: [
                { provide: App, useValue: mockApp },
                { provide: WidgetConfig, useClass: Cfg },
                { provide: 'EXPLICIT_CONTEXT', useValue: null },
            ],
        }).compileComponents();
        fixture = TestBed.createComponent(TestBfComponent);
        cmp = fixture.componentInstance;
        fixture.detectChanges();
    });

    afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
        fixture.destroy();
    });

    describe('updateBoundVariable', () => {
        it('returns when the datasource is not two way bound', () => {
            cmp.datavaluesource = { execute: jest.fn().mockReturnValue(false), twoWayBinding: false };
            cmp.binddatavalue = 'Variables.x.dataSet';
            cmp.context = { Variables: { x: { dataSet: 'old' } } };
            cmp.updateBoundVariable('new');
            expect(cmp.context.Variables.x.dataSet).toBe('old');
        });

        it('updates the context for a two way bound datasource', () => {
            cmp.datavaluesource = { execute: jest.fn().mockReturnValue(false), twoWayBinding: true };
            cmp.binddatavalue = 'row.name';
            cmp.context = { row: { name: 'old' } };
            cmp.updateBoundVariable('new');
            expect(cmp.context.row.name).toBe('new');
        });

        it('resolves [$i] to index 0 and evaluates bracket keys from the view parent', () => {
            cmp.binddatavalue = 'list[$i].name';
            cmp.context = { list: [{ name: 'old' }] };
            cmp.updateBoundVariable('v');
            expect(cmp.context.list[0].name).toBe('v');
        });

        it('substitutes numeric and string bracket keys evaluated on the view parent', () => {
            cmp.viewParent = { idx: 1, key: 'k' };
            cmp.binddatavalue = 'list[idx].name';
            cmp.context = { list: [{ name: 'a' }, { name: 'b' }] };
            cmp.updateBoundVariable('v');
            expect(cmp.context.list[1].name).toBe('v');
            expect(cmp.context.list[0].name).toBe('a');
        });

        it('falls back to index 0 when the key evaluates to a non primitive', () => {
            cmp.viewParent = { obj: {} };
            cmp.binddatavalue = 'list[obj].name';
            cmp.context = { list: [{ name: 'a' }, { name: 'b' }] };
            cmp.updateBoundVariable('v');
            expect(cmp.context.list[0].name).toBe('v');
        });

        it('falls back to index 0 when evaluating the key throws', () => {
            cmp.viewParent = undefined;
            cmp.binddatavalue = 'list[missing].name';
            cmp.context = { list: [{ name: 'a' }] };
            cmp.updateBoundVariable('v');
            expect(cmp.context.list[0].name).toBe('v');
        });

        it('sets on the view parent for a custom widget container', () => {
            cmp.viewParent = { containerWidget: { _isCustom: true }, prop: 'old' };
            cmp.context = {};
            cmp.binddatavalue = 'prop';
            cmp.updateBoundVariable('new');
            expect(cmp.viewParent.prop).toBe('new');
        });

        it('sets on the view parent when the datasource owner is Page', () => {
            cmp.viewParent = { prop: 'old' };
            cmp.context = {};
            cmp.datavaluesource = { execute: jest.fn(), twoWayBinding: true, owner: 'Page' };
            cmp.binddatavalue = 'prop';
            cmp.updateBoundVariable('new');
            expect(cmp.viewParent.prop).toBe('new');
        });

        it('sets on the App when the datasource owner is App', () => {
            cmp.viewParent = { App: { prop: 'old' } };
            cmp.context = {};
            cmp.datavaluesource = { execute: jest.fn(), twoWayBinding: true, owner: 'App' };
            cmp.binddatavalue = 'prop';
            cmp.updateBoundVariable('new');
            expect(cmp.viewParent.App.prop).toBe('new');
        });

        it('ignores widget bound expressions', () => {
            cmp.viewParent = { Widgets: { a: 1 } };
            cmp.binddatavalue = 'Widgets.a.datavalue';
            expect(() => cmp.updateBoundVariable('x')).not.toThrow();
            expect(cmp.viewParent.Widgets.a).toBe(1);
        });
    });

    describe('invokeOnChange', () => {
        it('invokes the change callback and updates bound variable only when value differs', () => {
            const cb = jest.spyOn(cmp, 'invokeEventCallback').mockImplementation(() => {});
            const ub = jest.spyOn(cmp, 'updateBoundVariable').mockImplementation(() => {});
            cmp.setPrev('a');
            cmp.datavalue = 'b';
            const ev = new Event('change');
            cmp.change('b', ev);
            expect(ub).toHaveBeenCalledWith('b');
            expect(cb).toHaveBeenCalledWith('change', { $event: ev, newVal: 'b', oldVal: 'a' });
            expect(cmp.prev()).toBe('b');
            cb.mockClear();
            cmp.change('b', ev);
            expect(cb).not.toHaveBeenCalled();
        });

        it('only records the previous value when no event is given', () => {
            const cb = jest.spyOn(cmp, 'invokeEventCallback').mockImplementation(() => {});
            cmp.change('z');
            expect(cb).not.toHaveBeenCalled();
            expect(cmp.prev()).toBe('z');
        });
    });

    describe('list ancestry keydown handling', () => {
        it('stops propagation of arrow keys inside a wmList and cleans up on destroy', () => {
            const listEl = document.createElement('div');
            listEl.setAttribute('wmList', '');
            const el = cmp.nativeElement as HTMLElement;
            const parent = el.parentElement;
            listEl.appendChild(el);
            document.body.appendChild(listEl);
            try {
                cmp.ngAfterViewInit();
                expect(cmp.boundKeydownHandler).toBeDefined();

                const arrow = $.Event('keydown', { keyCode: 37 });
                const stopSpy = jest.spyOn(arrow, 'stopPropagation');
                cmp.$element.trigger(arrow);
                expect(stopSpy).toHaveBeenCalled();

                const other = $.Event('keydown', { keyCode: 65 });
                const stopOther = jest.spyOn(other, 'stopPropagation');
                cmp.$element.trigger(other);
                expect(stopOther).not.toHaveBeenCalled();

                cmp.ngOnDestroy();
                expect(cmp.boundKeydownHandler).toBeNull();
                expect(cmp.binddatavalue).toBeNull();
            } finally {
                listEl.remove();
                if (parent) { parent.appendChild(el); }
            }
        });
    });
});
