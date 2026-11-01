import { ComponentFixture, ComponentFixtureAutoDetect } from '@angular/core/testing';
import { Component, ViewChild } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TypeaheadMatch, TypeaheadModule } from 'ngx-bootstrap/typeahead';
import { AbstractI18nService, App, AppDefaults, DataSource, PartialRefProvider } from '@wm/core';
import { BaseComponent, TextContentDirective, ToDatePipe } from '@wm/components/base';
import { InputTextComponent } from '@wm/components/input/text';
import { ITestModuleDef } from 'projects/components/base/src/test/common-widget.specs';
import { compileTestComponent, mockApp } from 'projects/components/base/src/test/util/component-test-util';
import { MockAbstractI18nService } from 'projects/components/base/src/test/util/date-test-util';
import { SearchComponent } from './search.component';
import { ScrollableDirective } from './scrollable.directive';

jest.mock('@wm/core', () => ({
    ...jest.requireActual('@wm/core'),
    adjustContainerPosition: jest.fn(),
}));

@Component({
    standalone: false,
    template: '<div wmSearch name="coverSearch" searchon="typing" type="search" show="true" tabindex="1"></div>',
})
class CoverSearchWrapperComponent {
    @ViewChild(SearchComponent, { static: true }) wmComponent: SearchComponent;
}

const moduleDef: ITestModuleDef = {
    imports: [FormsModule, TypeaheadModule, SearchComponent, ScrollableDirective, InputTextComponent],
    declarations: [CoverSearchWrapperComponent],
    providers: [
        { provide: App, useValue: mockApp },
        { provide: ToDatePipe, useClass: ToDatePipe },
        { provide: DatePipe, useClass: DatePipe },
        { provide: AppDefaults, useClass: AppDefaults },
        { provide: TypeaheadMatch, useValue: TypeaheadMatch },
        { provide: ComponentFixtureAutoDetect, useValue: true },
        { provide: PartialRefProvider, useClass: PartialRefProvider },
        { provide: AbstractI18nService, useClass: MockAbstractI18nService },
        { provide: BaseComponent, useClass: BaseComponent },
        TextContentDirective,
    ],
};

describe('SearchComponent - cover branches', () => {
    let fixture: ComponentFixture<CoverSearchWrapperComponent>;
    let search: any;
    let invoke: jest.SpyInstance;

    const item = (value: any, label = String(value), extra: any = {}) => ({ key: value, value, label, dataObject: { value }, ...extra });

    beforeEach(() => {
        fixture = compileTestComponent(moduleDef, CoverSearchWrapperComponent);
        search = fixture.componentInstance.wmComponent;
        fixture.detectChanges();
        invoke = jest.spyOn(search, 'invokeEventCallback').mockImplementation(() => undefined);
    });

    afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
        document.body.innerHTML = '';
    });

    describe('typeahead data source', () => {
        it('detaches the typeahead container while the next page is being loaded', () => {
            jest.spyOn(search, 'getDataSourceAsObservable').mockReturnValue({ subscribe: undefined } as any);
            const { of } = require('rxjs');
            (search.getDataSourceAsObservable as jest.Mock).mockReturnValue(of([]));
            search.typeahead = { _container: {} };
            search.lastSelectedIndex = 2;
            search.query = 'abc';
            const sub = search.typeaheadDataSource.subscribe();
            expect(search.typeahead._container).toBeUndefined();
            sub.unsubscribe();
        });
    });

    describe('clearSearch', () => {
        it('works without a data provider and without an event', () => {
            search.dataProvider = undefined;
            search.clearSearch(undefined, false);
            expect(search.query).toBe('');
            expect(search.listenQuery).toBe(false);
            expect(invoke).toHaveBeenCalledWith('clearsearch');
        });
    });

    describe('getDataSourceAsObservable (autocomplete guard)', () => {
        const setup = (over: any) => {
            Object.assign(search, { type: 'autocomplete', searchkey: 'name', query: 'q', _lastResult: undefined }, over);
            jest.spyOn(search, 'datavalue', 'get').mockReturnValue('v');
            jest.spyOn(search, 'getDataSource').mockResolvedValue([{ x: 1 }]);
        };
        it('goes on to fetch when the display label of the binding is the search key', async () => {
            setup({ binddisplaylabel: 'bind:Variables.x.dataSet[name]', displayexpression: undefined });
            const res = await new Promise((r) => search.getDataSourceAsObservable('q').subscribe(r));
            expect(res).toEqual([{ x: 1 }]);
            expect(search._lastQuery).toBe('q');
        });
        it('fetches when the expression is part of the search keys', async () => {
            setup({ binddisplaylabel: undefined, displayexpression: 'name' });
            const res = await new Promise((r) => search.getDataSourceAsObservable('q').subscribe(r));
            expect(res).toEqual([{ x: 1 }]);
        });
        it('returns nothing when the display expression differs from the search keys', async () => {
            setup({ binddisplaylabel: undefined, displayexpression: 'other' });
            const res = await new Promise((r) => search.getDataSourceAsObservable('q').subscribe(r));
            expect(res).toEqual([]);
            expect(search.getDataSource).not.toHaveBeenCalled();
        });
        it('treats piped bind labels as custom and skips the call', async () => {
            setup({ binddisplaylabel: 'a|b', displayexpression: undefined });
            const res = await new Promise((r) => search.getDataSourceAsObservable('q').subscribe(r));
            expect(res).toEqual([]);
        });
    });

    describe('handleEvent', () => {
        it('delegates other events to the base component and ignores the reserved ones', () => {
            const base = Object.getPrototypeOf(SearchComponent.prototype);
            const spy = jest.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(search)), 'handleEvent').mockImplementation(() => undefined);
            search.handleEvent(document.createElement('div'), 'click', () => undefined, {});
            expect(spy).toHaveBeenCalledTimes(1);
            search.handleEvent(document.createElement('div'), 'blur', () => undefined, {});
            expect(spy).toHaveBeenCalledTimes(1);
            expect(base).toBeDefined();
        });
    });

    describe('mobile dropdown', () => {
        beforeEach(() => {
            jest.useFakeTimers();
            search.typeahead = { hide: jest.fn(), _container: {}, _typeahead: {} };
            jest.spyOn(search, 'isMobileAutoComplete').mockReturnValue(true);
        });
        it('does not hide the typeahead when data is not cleared and renders the full screen view', () => {
            search.clearData = false;
            const render = jest.spyOn(search, 'renderMobileAutoComplete').mockImplementation(() => undefined);
            const insertAfter = jest.fn();
            const css = jest.fn();
            search.dropdownEl = { closest: jest.fn().mockReturnValue({ insertAfter, css }) };
            search.query = 'abc';
            search.dataProvider = { isLastPage: false };
            const trigger = jest.spyOn(search, 'triggerSearch').mockImplementation(() => undefined);
            search.onDropdownOpen();
            expect(search.typeahead.hide).not.toHaveBeenCalled();
            expect(render).toHaveBeenCalledTimes(1);
            expect(insertAfter).toHaveBeenCalledTimes(1);
            expect(css).toHaveBeenCalledWith(expect.objectContaining({ position: 'relative' }));
            expect(search.showClosebtn).toBe(true);
            expect(trigger).toHaveBeenCalledTimes(1);
        });
        it('skips rendering when already full screen and does not trigger on the last page', () => {
            search.$element.addClass('full-screen');
            const render = jest.spyOn(search, 'renderMobileAutoComplete').mockImplementation(() => undefined);
            search.dropdownEl = { closest: jest.fn().mockReturnValue({ insertAfter: jest.fn(), css: jest.fn() }) };
            search.dataProvider = { isLastPage: true };
            const trigger = jest.spyOn(search, 'triggerSearch').mockImplementation(() => undefined);
            search.query = '';
            search.onDropdownOpen();
            expect(render).not.toHaveBeenCalled();
            expect(trigger).not.toHaveBeenCalled();
            search.dataProvider = undefined;
            search.onDropdownOpen();
            expect(trigger).not.toHaveBeenCalled();
        });
    });

    describe('getDataSource in mobile', () => {
        const run = async (dp: any, open = true) => {
            search.dataProvider = { filter: jest.fn().mockResolvedValue([{ id: 1 }]), updateDataset: false, ...dp };
            search.datafield = 'id';
            search.displayfield = 'id';
            search.dataset = [{ id: 0 }];
            search._isOpen = open;
            jest.spyOn(search, 'isMobileAutoComplete').mockReturnValue(true);
            const trigger = jest.spyOn(search, 'triggerSearch').mockImplementation(() => undefined);
            await search.getDataSource('x');
            return trigger;
        };
        it('keeps triggering the search until the last page is reached', async () => {
            expect(await run({ isLastPage: false })).toHaveBeenCalled();
        });
        it('does not trigger when closed, on the last page or without paging info', async () => {
            expect(await run({ isLastPage: false }, false)).not.toHaveBeenCalled();
            expect(await run({ isLastPage: true })).not.toHaveBeenCalled();
            expect(await run({})).not.toHaveBeenCalled();
        });
    });

    describe('getTransformedData', () => {
        it('ignores the display expression for custom items', () => {
            search.displayexpression = 'expr';
            search.binddisplaylabel = 'bind';
            search.datafield = 'id';
            search.displayfield = 'id';
            const items = search.getTransformedData([{ id: 1 }], undefined, true);
            expect(items[0].label).toBe('1');
        });
    });

    describe('initialisation', () => {
        it('keeps a minchars that was already defined', () => {
            search.initState = new Map();
            search.minchars = 3;
            search.ngOnInit();
            expect(search.minchars).toBe(3);
        });
        it('keeps a showsearchicon that was already defined', () => {
            search.initState = new Map();
            search.showsearchicon = false;
            search.type = 'search';
            search.ngOnInit();
            expect(search.showsearchicon).toBe(false);
        });
        it('does not fail when the search input cannot be found', () => {
            const orig = (global as any).$;
            (global as any).$ = jest.fn(() => null);
            try {
                expect(() => search.ngAfterViewChecked()).not.toThrow();
            } finally {
                (global as any).$ = orig;
            }
        });
        it('destroys without a data provider', () => {
            search.dataProvider = null;
            expect(() => search.ngOnDestroy()).not.toThrow();
            expect(search.liElements).toBeNull();
        });
    });

    describe('typeaheadOnSelect', () => {
        it('falls back to an empty event and closes the full screen view', () => {
            search.$typeaheadEvent = undefined;
            search.prevDatavalue = undefined;
            jest.spyOn(search, 'invokeOnChange').mockImplementation(() => undefined);
            jest.spyOn(search, 'invokeOnTouched').mockImplementation(() => undefined);
            jest.spyOn(search, 'eventData').mockImplementation(() => undefined);
            const closeSearch = jest.spyOn(search, 'closeSearch').mockImplementation(() => undefined);
            const update = jest.spyOn(search, 'updateBoundVariable').mockImplementation(() => undefined);
            search.$element.addClass('full-screen');
            search.typeaheadOnSelect({ item: item('a', 'A') } as any, undefined);
            expect(search.invokeOnChange).toHaveBeenCalledWith('a', {});
            expect(update).toHaveBeenCalledWith('a');
            expect(closeSearch).toHaveBeenCalledTimes(1);
        });
        it('does not update the bound variable when the value is unchanged', () => {
            jest.spyOn(search, 'invokeOnChange').mockImplementation(() => undefined);
            jest.spyOn(search, 'invokeOnTouched').mockImplementation(() => undefined);
            jest.spyOn(search, 'eventData').mockImplementation((e: any) => e);
            const update = jest.spyOn(search, 'updateBoundVariable').mockImplementation(() => undefined);
            search.prevDatavalue = 'a';
            search.typeaheadOnSelect({ item: item('a', 'A') } as any, {} as any);
            expect(update).not.toHaveBeenCalled();
        });
    });

    describe('onPropertyChange displaylabel', () => {
        it('moves displaylabel to displayexpression when a datasource is missing', () => {
            Object.assign(search, { type: 'autocomplete', displaylabel: 'lbl', displayexpression: 'old', datasource: undefined });
            search.onPropertyChange('displaylabel', 'lbl', undefined);
            expect(search.displayexpression).toBe('lbl');
        });
        it('keeps the expression when a datasource exists', () => {
            Object.assign(search, { type: 'autocomplete', displaylabel: 'lbl', displayexpression: 'old', datasource: {} });
            search.onPropertyChange('displaylabel', 'lbl', undefined);
            expect(search.displayexpression).toBe('old');
        });
    });

    describe('debounceDefaultQuery with an unlabeled record', () => {
        it('falls back to an empty query', async () => {
            jest.spyOn(search, 'getDataSource').mockResolvedValue([item('a', '')]);
            search.debounceDefaultQuery('a');
            await Promise.resolve();
            await Promise.resolve();
            expect(search.query).toBe('');
            expect(search._lastQuery).toBe('');
            expect(search.showClosebtn).toBe(false);
        });
    });
});
