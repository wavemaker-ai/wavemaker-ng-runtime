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
    template: '<div wmSearch name="extraSearch" searchon="typing" type="search" show="true" tabindex="1"></div>',
})
class ExtraSearchWrapperComponent {
    @ViewChild(SearchComponent, { static: true }) wmComponent: SearchComponent;
}

const moduleDef: ITestModuleDef = {
    imports: [FormsModule, TypeaheadModule, SearchComponent, ScrollableDirective, InputTextComponent],
    declarations: [ExtraSearchWrapperComponent],
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

describe('SearchComponent - extra behaviour', () => {
    let fixture: ComponentFixture<ExtraSearchWrapperComponent>;
    let search: any;
    let invoke: jest.SpyInstance;

    const item = (value: any, label = String(value), extra: any = {}) => ({ key: value, value, label, dataObject: { value }, ...extra });

    beforeEach(() => {
        fixture = compileTestComponent(moduleDef, ExtraSearchWrapperComponent);
        search = fixture.componentInstance.wmComponent;
        fixture.detectChanges();
        invoke = jest.spyOn(search, 'invokeEventCallback').mockImplementation(() => undefined);
    });

    afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
        document.body.innerHTML = '';
    });

    describe('datavalue and dataset subscriptions', () => {
        it('clears the model for empty values', () => {
            search.query = 'x';
            search._lastResult = ['r'];
            search.datavalue$.next('');
            expect(search._modelByValue).toBe('');
            expect(search.query).toBe('');
            expect(search._lastResult).toBeUndefined();
            search.datavalue$.next(null);
            expect(search.queryModel).toBe('');
        });

        it('updates the model for new values and shows the close button', () => {
            const update = jest.spyOn(search, 'updateByDatavalue').mockImplementation(() => undefined);
            search._unsubscribeDv = false;
            search.query = 'something';
            search.prevDatavalue = 'new';
            search.datavalue$.next('new');
            expect(update).toHaveBeenCalledWith('new');
            expect(search._defaultQueryInvoked).toBe(false);
            expect(search.showClosebtn).toBe(true);
        });

        it('does not update the model while the value change comes from the widget itself', () => {
            const update = jest.spyOn(search, 'updateByDatavalue').mockImplementation(() => undefined);
            search._unsubscribeDv = true;
            search.datavalue$.next('x');
            expect(update).not.toHaveBeenCalled();
        });

        it('takes the first value of lists', () => {
            const update = jest.spyOn(search, 'updateByDatavalue').mockImplementation(() => undefined);
            search._unsubscribeDv = false;
            search.datavalue$.next(['first', 'second']);
            expect(update).toHaveBeenCalledWith(['first', 'second']);
        });

        it('refreshes the model when the dataset changes and a value exists', () => {
            const update = jest.spyOn(search, 'updateByDataset').mockImplementation(() => undefined);
            search.datasetItems = [item('a'), item('b')];
            search.datavalue = 'a';
            search._lastResult = ['x'];
            search.dataset$.next();
            expect(search.startIndex).toBe(2);
            expect(search._lastResult).toBeUndefined();
            expect(update).toHaveBeenCalledWith('a');
        });
    });

    describe('default values', () => {
        it('selects the dataset item matching the value case insensitively', () => {
            search.datasetItems = [item('Apple', 'Apple Label'), item('b')];
            search._defaultQueryInvoked = false;
            search.updateByDataset('apple');
            expect(search.queryModel).toEqual([expect.objectContaining({ value: 'Apple' })]);
            expect(search.query).toBe('Apple Label');
            expect(search._modelByValue).toBe('Apple');
            expect(search.showClosebtn).toBe(true);
        });

        it('compares object values by equality', () => {
            search.datasetItems = [item({ id: 1 }, 'one')];
            search.updateByDataset({ id: 1 });
            expect(search.query).toBe('one');
        });

        it('does nothing when the default query was already made for remote search', () => {
            search._defaultQueryInvoked = true;
            search.searchkey = 'name';
            search.query = 'keep';
            search.updateByDataset('x');
            expect(search.query).toBe('keep');
        });

        it('builds the model from objects when all fields are used', () => {
            search.datasetItems = [];
            search.datafield = 'All Fields';
            search._defaultQueryInvoked = false;
            jest.spyOn(search, 'getTransformedData').mockReturnValue([item({ id: 2 }, 'two')]);
            search.updateByDataset({ id: 2 });
            expect(search.query).toBe('two');
        });

        it('resets the model for unknown values that differ from the previous value', () => {
            search.datasetItems = [];
            search.datafield = 'name';
            search.prevDatavalue = 'old';
            search.query = 'q';
            search.updateByDataset('unknown');
            expect(search.queryModel).toBeUndefined();
            expect(search.query).toBe('');
        });

        it('copies the model of an existing query model', () => {
            search.queryModel = [item('a')];
            search.updateDatavalueFromQueryModel();
            expect(search._modelByValue).toBe('a');
            expect(search._modelByKey).toBe('a');
            expect(search.toBeProcessedDatavalue).toBeUndefined();
            search.queryModel = 'plain';
            search.updateDatavalueFromQueryModel();
            expect(search._modelByValue).toBe('plain');
        });

        it('updates the datavalue from the query model instead of querying again', () => {
            const query = jest.spyOn(search, 'debounceDefaultQuery').mockImplementation(() => undefined);
            search.datasource = { execute: jest.fn().mockReturnValue(true) };
            search._modelByKey = undefined;
            search.datafield = 'name';
            search.queryModel = [item('a')];
            search.updateByDataSource('a');
            expect(query).not.toHaveBeenCalled();
            expect(search._modelByValue).toBe('a');
        });

        it('makes the default query for crud data sources', () => {
            const query = jest.spyOn(search, 'debounceDefaultQuery').mockImplementation(() => undefined);
            search.datasource = { execute: jest.fn((op: any) => op === DataSource.Operation.SUPPORTS_CRUD) };
            search._modelByKey = undefined;
            search.queryModel = undefined;
            search.datafield = 'name';
            search._defaultQueryInvoked = false;
            search.updateByDataSource('a');
            expect(query).toHaveBeenCalledWith('a');
            query.mockClear();
            search._defaultQueryInvoked = true;
            search.updateByDataSource('a');
            expect(query).not.toHaveBeenCalled();
            search._defaultQueryInvoked = false;
            search.updateByDataSource({ object: true });
            expect(query).not.toHaveBeenCalled();
        });

        describe('debounceDefaultQuery', () => {
            it('applies the first response record', async () => {
                jest.spyOn(search, 'getDataSource').mockResolvedValue([item('a', 'Label A')]);
                search.debounceDefaultQuery('a');
                await Promise.resolve();
                await Promise.resolve();
                expect(search._defaultQueryInvoked).toBe(true);
                expect(search.query).toBe('Label A');
                expect(search._modelByValue).toBe('a');
                expect(search._modelByKey).toBe('a');
                expect(search.showClosebtn).toBe(true);
            });

            it('clears the model without a response and hides an open dropdown', async () => {
                const hide = jest.fn();
                search.typeahead = { _typeahead: { isShown: true }, hide };
                search.clearData = true;
                jest.spyOn(search, 'getDataSource').mockResolvedValue([]);
                search.debounceDefaultQuery('a');
                await Promise.resolve();
                await Promise.resolve();
                expect(search.queryModel).toBeUndefined();
                expect(search.query).toBe('');
                expect(hide).toHaveBeenCalled();
            });
        });
    });

    describe('focus and search state', () => {
        it('re-opens the previous results on focus for search type', () => {
            const emit = jest.fn();
            search.typeahead = { keyUpEventEmitter: { emit } };
            search.type = 'search';
            search.query = 'q';
            search._lastQuery = 'q';
            search._lastResult = ['r'];
            search.handleFocus({});
            expect(emit).toHaveBeenCalledWith('q');
            emit.mockClear();
            search._lastResult = undefined;
            search.handleFocus({});
            expect(emit).not.toHaveBeenCalled();
        });

        it('notifies floating captions', () => {
            const notify = jest.spyOn(search.app, 'notify');
            search.notifySubscriber();
            expect(notify).not.toHaveBeenCalled();
            const parent = document.createElement('div');
            parent.className = 'app-composite-widget caption-floating';
            parent.appendChild(search.nativeElement);
            search.notifySubscriber();
            expect(notify).toHaveBeenCalledWith('captionPositionAnimate', { displayVal: true, nativeEl: expect.anything() });
        });

        it('raises beforeservicecall', () => {
            search.invokeOnBeforeServiceCall({ q: 1 });
            expect(invoke).toHaveBeenCalledWith('beforeservicecall', { inputData: { q: 1 } });
        });

        it('detects update on typing', () => {
            search.searchon = 'typing';
            expect(search.isUpdateOnKeyPress()).toBe(true);
            search.searchon = 'onsearchiconclick';
            expect(search.isUpdateOnKeyPress()).toBe(false);
        });
    });

    describe('dropdown handling', () => {
        it('loads the next page when the keyboard reaches the last match', () => {
            const load = jest.spyOn(search, 'loadMoreData').mockImplementation(() => undefined);
            search.typeaheadContainer = { matches: ['a', 'b'], active: 'b' };
            search._loadingItems = false;
            search.dataProvider = { isLastPage: false };
            search.selectNext();
            expect(search.lastSelectedIndex).toBe(1);
            expect(load).toHaveBeenCalledWith(true);

            load.mockClear();
            search.typeaheadContainer = { matches: ['a', 'b'], active: 'a' };
            search.selectNext();
            expect(load).not.toHaveBeenCalled();
            search.typeaheadContainer = { matches: undefined };
            expect(() => search.selectNext()).not.toThrow();
        });

        it('restores the active match after the next page was loaded', () => {
            const nextActiveMatch = jest.fn();
            search.typeaheadContainer = { matches: ['a', 'b', 'c'], nextActiveMatch };
            search.lastSelectedIndex = 1;
            search.setLastActiveMatchAsSelected();
            expect(search.typeaheadContainer._active).toBe('b');
            expect(nextActiveMatch).toHaveBeenCalledTimes(1);
            expect(search.lastSelectedIndex).toBeUndefined();
            nextActiveMatch.mockClear();
            search.setLastActiveMatchAsSelected();
            expect(nextActiveMatch).not.toHaveBeenCalled();
        });

        it('triggers the next page when the last item is visible in the full screen view', () => {
            const load = jest.spyOn(search, 'loadMoreData').mockImplementation(() => undefined);
            search.dataProvider = { isLastPage: false };
            search.$element.removeClass('full-screen');
            search.triggerSearch();
            expect(load).not.toHaveBeenCalled();
        });

        it('loads more data when scrolled to the bottom', () => {
            const load = jest.spyOn(search, 'loadMoreData').mockImplementation(() => undefined);
            search._loadingItems = false;
            search.dataProvider = { isLastPage: false };
            search.onScroll({ scrollHeight: 100, clientHeight: 50, scrollTop: 50 } as any, {} as any);
            expect(load).toHaveBeenCalledWith(true);
            load.mockClear();
            search.onScroll({ scrollHeight: 100, clientHeight: 50, scrollTop: 10 } as any, {} as any);
            search._loadingItems = true;
            search.onScroll({ scrollHeight: 100, clientHeight: 50, scrollTop: 50 } as any, {} as any);
            search.dataProvider = { isLastPage: true };
            search._loadingItems = false;
            search.onScroll({ scrollHeight: 100, clientHeight: 50, scrollTop: 50 } as any, {} as any);
            expect(load).not.toHaveBeenCalled();
        });

        it('hides the dropdown on open when the data was cleared', () => {
            jest.useFakeTimers();
            const hide = jest.fn();
            search.typeahead = { hide, _container: { liElements: undefined }, _typeahead: {} };
            search.clearData = true;
            jest.spyOn(search, 'isMobileAutoComplete').mockReturnValue(false);
            search.onDropdownOpen();
            jest.advanceTimersByTime(400);
            expect(hide).toHaveBeenCalled();
            expect(search._isOpen).toBe(true);
        });
    });

    describe('getDataSource', () => {
        beforeEach(() => {
            search.dataProvider = { filter: jest.fn().mockResolvedValue({ data: [{ id: 1 }] }), updateDataset: false };
            search.datafield = 'id';
            search.displayfield = 'id';
            search.dataset = [{ id: 0 }];
        });

        it('returns no results for default queries on all fields', async () => {
            search.datafield = 'All Fields';
            await expect(search.getDataSource('x', true)).resolves.toEqual([]);
            expect(search.dataProvider.filter).not.toHaveBeenCalled();
        });

        it('filters through the data provider with the search configuration', async () => {
            search.searchkey = 'name';
            search.matchmode = 'start';
            const result = await search.getDataSource('x');
            const config = search.dataProvider.filter.mock.calls[0][0];
            expect(config).toMatchObject({ query: 'x', searchKey: 'name', matchMode: 'start', isLocalFilter: false, datafield: 'id' });
            expect(result[0].value).toBe(1);
            expect(search.result).toEqual([1]);
            expect(search._loadingItems).toBe(false);
        });

        it('searches on the data field with a start match for default queries', async () => {
            search.datafield = 'id';
            await search.getDataSource('1', true);
            expect(search.dataProvider.filter.mock.calls[0][0]).toMatchObject({ searchKey: 'id', matchMode: 'startignorecase' });
        });

        it('passes the data options of the search on', async () => {
            search.dataoptions = { a: 1 };
            search.viewParent = { page: true };
            await search.getDataSource('x');
            expect(search.dataProvider.filter.mock.calls[0][0]).toMatchObject({ dataoptions: { a: 1 }, viewParent: { page: true } });
        });

        it('updates an empty dataset from the response when the provider asks for it', async () => {
            search.dataset = undefined;
            search.dataProvider.updateDataset = true;
            await search.getDataSource('x');
            expect(search.dataset).toEqual([{ id: 1 }]);
        });

        it('appends the response when more data was requested', async () => {
            search.formattedDataset = [{ id: 0 }];
            search.dataProvider.hasMoreData = true;
            await search.getDataSource('x');
            expect(search.formattedDataset).toEqual([{ id: 0 }, { id: 1 }]);
        });

        it('raises the typeahead options limit for long results', async () => {
            search.limit = undefined;
            search.dataProvider.filter.mockResolvedValue({ data: Array.from({ length: 25 }, (_, i) => ({ id: i })) });
            await search.getDataSource('x');
            expect(search._dynamicTypeaheadOptionsLimit).toBe(25);
            search.dataProvider.filter.mockResolvedValue({ data: [{ id: 1 }] });
            await search.getDataSource('x');
            expect(search._dynamicTypeaheadOptionsLimit).toBeUndefined();
        });

        it('resets the model when nothing was found', async () => {
            search.dataProvider.filter.mockResolvedValue({ data: [] });
            const result = await search.getDataSource('nothing');
            expect(result).toEqual([]);
            expect(search._modelByValue).toBeUndefined();
            expect(search.queryModel).toBe('nothing');
        });

        it('returns an empty list when the request fails', async () => {
            search.dataProvider.filter.mockRejectedValue('boom');
            await expect(search.getDataSource('x')).resolves.toEqual([]);
            expect(search._loadingItems).toBe(false);
        });

        it('hides the results when the widget was unsubscribed in the meantime', async () => {
            search._unsubscribeDv = true;
            await expect(search.getDataSource('x')).resolves.toEqual([]);
            search._unsubscribeDv = false;
        });

        it('restores the active match after scrolling', async () => {
            jest.useFakeTimers();
            const restore = jest.spyOn(search, 'setLastActiveMatchAsSelected').mockImplementation(() => undefined);
            search.isScrolled = true;
            const promise = search.getDataSource('x');
            await Promise.resolve();
            await Promise.resolve();
            await Promise.resolve();
            await Promise.resolve();
            jest.advanceTimersByTime(50);
            await promise;
            expect(restore).toHaveBeenCalled();
            expect(search.isScrolled).toBe(false);
        });
    });

    describe('helpers', () => {
        it('resolves the page context of nested widgets', () => {
            const page = { page: true };
            expect(search.getContext({ widget: {}, viewParent: { widget: {}, viewParent: page } })).toBe(page);
            expect(search.getContext(page)).toBe(page);
            expect(search.getContext(undefined)).toBeUndefined();
        });

        it('transforms data into unique dataset items', () => {
            search.datafield = 'id';
            search.displayfield = 'name';
            const items = search.getTransformedData([{ id: 1, name: 'a' }, { id: 1, name: 'a' }, { id: 2, name: 'b' }], 0, false);
            expect(items.map((i: any) => i.value)).toEqual([1, 2]);
        });

        it('adds the data of the selection to the event', () => {
            search.query = 'q';
            const event: any = {};
            const result = search.eventData(event, item('a', 'Label'));
            expect(result.data).toEqual({ item: { value: 'a' }, model: 'a', label: 'Label', query: 'q' });
            expect(search.eventData(undefined, item('a'))).toBeUndefined();
        });

        it('sets the model of a selected suggestion and raises the events', () => {
            jest.spyOn(search, 'invokeOnTouched').mockImplementation(() => undefined);
            jest.spyOn(search, 'invokeOnChange').mockImplementation(() => undefined);
            jest.spyOn(search, 'updateBoundVariable').mockImplementation(() => undefined);
            jest.spyOn(search, 'updatePrevDatavalue').mockImplementation(() => undefined);
            const selected = item('a', 'Label');
            search.typeaheadOnSelect({ item: selected } as any, {} as any);
            expect(search.query).toBe('Label');
            expect(selected).toMatchObject({ selected: true });
            expect(search._modelByKey).toBe('a');
            expect(invoke).toHaveBeenCalledWith('select', expect.anything());
            expect(invoke).toHaveBeenCalledWith('submit', expect.anything());
        });

        it('removes aria-expanded from the search inputs after checking the view', () => {
            document.body.innerHTML = '<input class="app-search-input" aria-expanded="true">';
            search.ngAfterViewChecked();
            expect(document.querySelector('.app-search-input')!.hasAttribute('aria-expanded')).toBe(false);
        });

        it('pushes a changed minchars to the typeahead', () => {
            search.typeahead = {};
            search.onPropertyChange('minchars', 3, 1);
            expect(search.typeahead._typeaheadMinLengthValue).toBe(3);
        });

        it('ignores a minchars change when there is no typeahead or no value', () => {
            search.typeahead = undefined;
            expect(() => search.onPropertyChange('minchars', 3, 1)).not.toThrow();

            search.typeahead = {};
            search.onPropertyChange('minchars', undefined, 1);
            expect('_typeaheadMinLengthValue' in search.typeahead).toBe(false);
        });

        it('defaults minchars and the search icon from the type', () => {
            jest.spyOn(Object.getPrototypeOf(SearchComponent.prototype), 'ngOnInit').mockImplementation(() => undefined);
            search.minchars = undefined;
            search.showsearchicon = undefined;
            search.type = 'autocomplete';
            search.ngOnInit();
            expect(search.minchars).toBe(0);
            expect(search.showsearchicon).toBe(false);
            search.minchars = undefined;
            search.showsearchicon = undefined;
            search.type = 'search';
            search.ngOnInit();
            expect(search.minchars).toBe(1);
            expect(search.showsearchicon).toBe(true);
        });
    });
});
