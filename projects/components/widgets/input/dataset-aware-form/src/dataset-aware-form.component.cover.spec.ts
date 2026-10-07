import { TestBed, ComponentFixture } from '@angular/core/testing';
import { Component, Injector } from '@angular/core';
import { ALLFIELDS, ToDatePipe } from '@wm/components/base';
import { App, AppDefaults } from '@wm/core';
import { mockApp } from 'projects/components/base/src/test/util/component-test-util';
import { DatasetAwareFormComponent } from './dataset-aware-form.component';

jest.mock('@wm/components/base', () => ({
    ...jest.requireActual('@wm/components/base'),
    handleHeaderClick: jest.fn(),
    toggleAllHeaders: jest.fn(),
}));
jest.mock('lodash-es', () => ({
    ...jest.requireActual('lodash-es'),
    debounce: jest.fn(fn => fn),
}));

import { handleHeaderClick, toggleAllHeaders } from '@wm/components/base';

@Component({
    standalone: false,
    selector: 'test-dataset-aware-form-cover',
    template: '<div></div>',
})
class TestComponent extends DatasetAwareFormComponent {
    constructor(inj: Injector) {
        super(inj, { widgetType: 'wm-input', widgetSubType: 'wm-form-field-text' }, null);
    }
}

describe('DatasetAwareFormComponent - remaining branches', () => {
    let component: any;
    let fixture: ComponentFixture<TestComponent>;
    let handlers: { [k: string]: Function };
    let cancelLocale: jest.Mock;

    beforeEach(async () => {
        handlers = {};
        cancelLocale = jest.fn();
        const app = { ...mockApp, subscribe: jest.fn((evt: string, fn: Function) => { handlers[evt] = fn; return cancelLocale; }) };
        await TestBed.configureTestingModule({
            declarations: [TestComponent],
            providers: [
                { provide: Injector, useValue: { get: jest.fn() } },
                { provide: ToDatePipe, useValue: {} },
                { provide: AppDefaults, useValue: {} },
                { provide: App, useValue: app },
            ],
        }).compileComponents();
        fixture = TestBed.createComponent(TestComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    afterEach(() => jest.clearAllMocks());

    const items = () => [
        { key: 'k1', value: 'v1', label: 'L1', dataObject: { id: 1, n: 'a' } },
        { key: 'k2', value: 'v2', label: 'L2', dataObject: { id: 2, n: 'b' } },
    ];

    it('exposes the key model', () => {
        component._modelByKey = 'k1';
        expect(component.modelByKey).toBe('k1');
    });

    describe('locale changes and dataset property changes', () => {
        it('re-initialises the dataset items when the locale changes', async () => {
            const init = jest.spyOn(component, 'initDatasetItems').mockImplementation(() => undefined);
            handlers['locale-changed']();
            await new Promise(resolve => setTimeout(resolve, 300));
            expect(init).toHaveBeenCalledTimes(1);
        });

        it('ignores locale changes and dataset property changes when the debounced initialiser is gone', () => {
            const init = jest.spyOn(component, 'initDatasetItems').mockImplementation(() => undefined);
            component._debouncedInitDatasetItems = null;
            expect(() => handlers['locale-changed']()).not.toThrow();
            expect(() => component.onPropertyChange('dataset', [])).not.toThrow();
            expect(init).not.toHaveBeenCalled();
        });
    });

    describe('selectByKey', () => {
        beforeEach(() => { component.datasetItems = items(); });

        it('wraps a single key for multiple selection and skips unknown keys', () => {
            component.multiple = true;
            component.selectByKey('k2');
            expect(component._modelByKey).toEqual(['k2']);
            expect(component._modelByValue).toEqual(['v2']);
            component.selectByKey(['k1', 'unknown']);
            expect(component._modelByValue).toEqual(['v1']);
        });

        it('clears the value for an unknown key in single selection', () => {
            component.selectByKey('unknown');
            expect(component._modelByValue).toBe('');
            expect(component.datasetItems.some((i: any) => i.selected)).toBe(false);
        });
    });

    describe('selectByValue', () => {
        beforeEach(() => { component.datasetItems = items(); });

        it('returns early for empty values when empty is not allowed or the value is undefined', () => {
            component.allowempty = false;
            component.toBeProcessedDatavalue = 'keep';
            component.selectByValue('');
            expect(component._modelByKey).toBeUndefined();
            expect(component.toBeProcessedDatavalue).toBe('keep');
            component.allowempty = true;
            component.selectByValue(undefined);
            expect(component.toBeProcessedDatavalue).toBe('keep');
            // an empty string with allowempty continues processing and finds no match
            const reset = jest.spyOn(component, 'resetDatasetItems');
            component.selectByValue('');
            expect(reset).toHaveBeenCalled();
            expect(component._modelByKey).toBeUndefined();
            expect(component.datasetItems.some((i: any) => i.selected)).toBe(false);
        });

        it('wraps scalar values for widgets that accept arrays', () => {
            component.acceptsArray = true;
            component.selectByValue('v1');
            expect(component._modelByKey).toEqual(['k1']);
            component.allowempty = false;
            component.selectByValue('v2,v1');
            expect(component._modelByKey).toEqual(['k2', 'k1']);
        });

        it('matches object values by deep equality', () => {
            component.datasetItems = [{ key: 'o1', value: { a: 1 }, label: 'O1' }, { key: 'o2', value: { a: 2 }, label: 'O2' }];
            component.selectByValue({ a: 2 });
            expect(component._modelByKey).toBe('o2');
            component.selectByValue({ a: 3 });
            expect(component._modelByKey).toBeUndefined();
            component.selectByValue([{ a: 1 }, { a: 9 }]);
            expect(component._modelByKey).toEqual(['o1']);
        });

        it('compares complete objects by the compareby fields when all fields are the datafield', () => {
            component.datafield = ALLFIELDS;
            component.compareby = ['id'];
            component.selectByValue({ id: 2, n: 'different' });
            expect(component._modelByKey).toBe('k2');
            component.selectByValue([{ id: 1, n: 'x' }, { id: 5 }]);
            expect(component._modelByKey).toEqual(['k1']);
        });

        it('falls back to value comparison for all fields without compareby', () => {
            component.datafield = ALLFIELDS;
            component.compareby = [];
            component.selectByValue('V2');
            expect(component._modelByKey).toBe('k2');
            component.selectByValue(['V1']);
            expect(component._modelByKey).toEqual(['k1']);
        });
    });

    describe('initDisplayValues', () => {
        beforeEach(() => {
            component.datasetItems = items();
            component.viewParent = { containerWidget: { _isCustom: true } };
        });

        it('publishes the selected label to a custom container', () => {
            component.datasetItems[1].selected = true;
            component.initDisplayValues();
            expect(component.displayValue).toBe('L2');
            expect(component.viewParent.containerWidget.displayValue).toBe('L2');
        });

        it('publishes an empty value when nothing is selected', () => {
            component.initDisplayValues();
            expect(component.displayValue).toBe('');
            expect(component.viewParent.containerWidget.displayValue).toBe('');
        });

        it('lists every selected label for multiple selection', () => {
            component.multiple = true;
            component.datasetItems.forEach((i: any) => (i.selected = true));
            component.initDisplayValues();
            expect(component.displayValue).toEqual(['L1', 'L2']);
            expect(component.viewParent.containerWidget.displayValue).toEqual(['L1', 'L2']);
        });

        it('does not touch containers that are not custom widgets', () => {
            component.viewParent = { containerWidget: { _isCustom: false } };
            component.initDisplayValues();
            expect(component.viewParent.containerWidget.displayValue).toBeUndefined();
        });
    });

    describe('initDatasetItems', () => {
        it('builds items from the keys of the data when usekeys is set', () => {
            component.dataset = [{ first: 1, second: 2 }];
            component.usekeys = true;
            component.initDatasetItems();
            expect(component.datasetItems.map((i: any) => i.key)).toEqual(['first', 'second']);
        });

        it('uses the display label when no display field is given', () => {
            component.dataset = [{ id: 1, name: 'one' }, { id: 2, name: 'two' }];
            component.usekeys = false;
            component.datafield = 'id';
            component.displayfield = undefined;
            component.displaylabel = 'name';
            component.initDatasetItems();
            expect(component.datasetItems.map((i: any) => i.label)).toEqual(['one', 'two']);
        });
    });

    describe('postDatasetItemsInit', () => {
        beforeEach(() => { component.datasetItems = items(); });

        it('does not select by value when the default query provided the value', () => {
            const spy = jest.spyOn(component, 'selectByValue');
            component._defaultQueryInvoked = true;
            component.postDatasetItemsInit();
            expect(spy).not.toHaveBeenCalled();
        });

        it('prefers the value that is waiting to be processed', () => {
            const spy = jest.spyOn(component, 'selectByValue');
            component.toBeProcessedDatavalue = 'v2';
            component._modelByValue = 'v1';
            component.postDatasetItemsInit();
            expect(spy).toHaveBeenCalledWith('v2');
        });

        it('falls back to the datavalue and keeps falsy defaults', () => {
            const spy = jest.spyOn(component, 'selectByValue');
            component.toBeProcessedDatavalue = undefined;
            component._modelByValue = 'v1';
            component.postDatasetItemsInit();
            expect(spy).toHaveBeenCalledWith('v1');
        });
    });

    describe('ngOnInit grouping', () => {
        let baseInit: jest.SpyInstance;
        beforeEach(() => {
            baseInit = jest.spyOn(Object.getPrototypeOf(DatasetAwareFormComponent.prototype), 'ngOnInit').mockImplementation(() => undefined);
        });
        afterEach(() => baseInit.mockRestore());

        it('sets up grouping and collapsible headers', () => {
            const group = jest.spyOn(component, 'setGroupData').mockImplementation(() => undefined);
            component.groupby = 'type';
            component.collapsible = true;
            component.ngOnInit();
            expect(group).toHaveBeenCalled();
            expect(component.handleHeaderClick).toBe(handleHeaderClick);
            component.toggleAllHeaders();
            expect(toggleAllHeaders).toHaveBeenCalledWith(component);
        });

        it('does not group search and chips widgets', () => {
            const group = jest.spyOn(component, 'setGroupData').mockImplementation(() => undefined);
            component.groupby = 'type';
            component.widgetType = 'wm-search';
            component.ngOnInit();
            component.widgetType = 'wm-chips';
            component.ngOnInit();
            expect(group).not.toHaveBeenCalled();
        });

        it('keeps the default header handler when not collapsible', () => {
            component.groupby = 'type';
            component.collapsible = false;
            const before = component.handleHeaderClick;
            jest.spyOn(component, 'setGroupData').mockImplementation(() => undefined);
            component.ngOnInit();
            expect(component.handleHeaderClick).toBe(before);
        });

        it('does nothing without groupby', () => {
            const group = jest.spyOn(component, 'setGroupData').mockImplementation(() => undefined);
            component.groupby = undefined;
            component.ngOnInit();
            expect(group).not.toHaveBeenCalled();
        });
    });

    describe('ngOnDestroy', () => {
        it('cancels the locale subscription and completes the subjects', () => {
            const dsComplete = jest.spyOn(component.dataset$, 'complete');
            const dvComplete = jest.spyOn(component.datavalue$, 'complete');
            component.groupedData = [1];
            component.ngOnDestroy();
            expect(cancelLocale).toHaveBeenCalled();
            expect(dsComplete).toHaveBeenCalled();
            expect(dvComplete).toHaveBeenCalled();
            expect(component.groupedData).toEqual([]);
            expect(component.datasetItems).toEqual([]);
            expect(component._modelByKey).toBeNull();
        });

        it('tolerates already released resources', () => {
            component.cancelLocaleChangeSubscription = null;
            component.dataset$ = null;
            component.datavalue$ = null;
            component.groupedData = undefined;
            expect(() => component.ngOnDestroy()).not.toThrow();
            expect(cancelLocale).not.toHaveBeenCalled();
        });
    });
});
