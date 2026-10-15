import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { AbstractI18nService, App, AppDefaults, DataSource, isMobile, setPipeProvider } from '@wm/core';
import * as baseLib from '@wm/components/base';
import { ChangeDetectionStrategy, Component, ViewChild } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PaginationModule } from 'ngx-bootstrap/pagination';
import { PaginationComponent as WmPaginationModule } from '@wm/components/data/pagination';
import { TextContentDirective, ToDatePipe } from '@wm/components/base';
import { MockAbstractI18nService } from 'projects/components/base/src/test/util/date-test-util';
import { mockApp } from 'projects/components/base/src/test/util/component-test-util';
import { PipeProvider } from '../../../../../runtime-base/src/services/pipe-provider.service';
import { ListComponent } from './list.component';
import { ListItemDirective } from './list-item.directive';

jest.mock('@wm/components/base', () => ({
    ...jest.requireActual('@wm/components/base'),
    configureDnD: jest.fn(),
}));

jest.mock('@wm/core', () => ({
    ...jest.requireActual('@wm/core'),
    isMobile: jest.fn(() => false),
    $appDigest: jest.fn(),
}));

@Component({
    standalone: false,
    changeDetection: ChangeDetectionStrategy.Eager,
    template: `
        <div wmList template="true" itemsperrow="xs-1 sm-1 md-1 lg-1" class="media-list" name="coverList"
             dataset.bind="testdata" navigation="Basic">
            <ng-template #listTemplate let-item="item" let-$index="$index" let-itemRef="itemRef" let-$first="$first" let-$last="$last" let-currentItemWidgets="currentItemWidgets">
                <label wmLabel name="Name" class="p media-heading" caption.bind="item.name"></label>
            </ng-template>
        </div>
    `,
})
class CoverListWrapperComponent {
    @ViewChild(ListComponent, { static: true }) listComponent: ListComponent;
    public testdata: any = [{ name: 'Peter', age: 21 }, { name: 'Tony', age: 42 }];

    constructor(_pipeProvider: PipeProvider) {
        setPipeProvider(_pipeProvider);
    }
}
const handlers: any = {};
const coverApp = { ...mockApp, subscribe: (name: string, cb: any) => { handlers[name] = cb; return () => undefined; } };

describe('ListComponent - cover', () => {
    let fixture: ComponentFixture<CoverListWrapperComponent>;
    let list: any;

    const fakeItem = (index: number, overrides: any = {}) => ({
        context: { index },
        isActive: false,
        disableItem: false,
        item: { name: `item${index}` },
        nativeElement: document.createElement('li'),
        ...overrides,
    });

    const useItems = (items: any[]) => {
        list.listItems = {
            toArray: () => items,
            forEach: (fn: any) => items.forEach(fn),
            get length() { return items.length; },
            get first() { return items[0]; },
            find: (fn: any) => items.find(fn),
            reset: jest.fn(),
            setDirty: jest.fn(),
            changes: { subscribe: jest.fn() },
        };
        return items;
    };

    const keyEvent = (target: any = document.createElement('div')) => ({ stopPropagation: jest.fn(), preventDefault: jest.fn(), keyCode: 40, target });

    beforeEach(waitForAsync(() => {
        TestBed.configureTestingModule({
            imports: [FormsModule, PaginationModule, WmPaginationModule, ListComponent, ListItemDirective],
            declarations: [CoverListWrapperComponent],
            providers: [
                { provide: App, useValue: coverApp },
                { provide: ToDatePipe, useClass: ToDatePipe },
                { provide: AppDefaults, useClass: AppDefaults },
                { provide: AbstractI18nService, useClass: MockAbstractI18nService },
                { provide: DatePipe, useValue: DatePipe },
                TextContentDirective,
            ],
        }).compileComponents();
        fixture = TestBed.createComponent(CoverListWrapperComponent);
        list = fixture.componentInstance.listComponent;
        fixture.detectChanges();
    }));

    afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
        (isMobile as jest.Mock).mockReturnValue(false);
        fixture?.destroy();
    });

    describe('keyboard handling in multiselect mode', () => {
        beforeEach(() => {
            list.statePersistence = { removeWidgetState: jest.fn(), computeMode: jest.fn().mockReturnValue('SESSION') };
            list.multiselect = true;
        });

        it('counts a single (non array) selected item when extending the selection', () => {
            const items = useItems([fakeItem(0), fakeItem(1), fakeItem(2)]);
            const limit = jest.spyOn(list, 'checkSelectionLimit').mockReturnValue(true);
            jest.spyOn(list, 'toggleListItemSelection').mockImplementation(() => undefined);
            jest.spyOn(list, 'selecteditem', 'get').mockReturnValue({ name: 'x' });
            list.firstSelectedItem = items[1];
            list.lastSelectedItem = items[1];
            list.handleKeyDown(keyEvent(), 'selectNext');
            expect(limit).toHaveBeenCalledWith(1);
            expect(list.lastSelectedItem).toBe(items[2]);
        });

        it('counts zero selected items when nothing is selected', () => {
            const items = useItems([fakeItem(0), fakeItem(1), fakeItem(2)]);
            const limit = jest.spyOn(list, 'checkSelectionLimit').mockReturnValue(true);
            jest.spyOn(list, 'toggleListItemSelection').mockImplementation(() => undefined);
            jest.spyOn(list, 'selecteditem', 'get').mockReturnValue(undefined);
            list.firstSelectedItem = items[1];
            list.lastSelectedItem = items[1];
            list.handleKeyDown(keyEvent(), 'selectPrev');
            expect(limit).toHaveBeenCalledWith(0);
            expect(list.lastSelectedItem).toBe(items[0]);
        });

        it('does nothing when selecting previous from the first item', () => {
            const items = useItems([fakeItem(0), fakeItem(1)]);
            const toggle = jest.spyOn(list, 'toggleListItemSelection').mockImplementation(() => undefined);
            list.firstSelectedItem = items[0];
            list.lastSelectedItem = items[0];
            list.handleKeyDown(keyEvent(), 'selectPrev');
            expect(toggle).not.toHaveBeenCalled();
        });

        it('does nothing when selecting next from the last item', () => {
            const items = useItems([fakeItem(0), fakeItem(1)]);
            const toggle = jest.spyOn(list, 'toggleListItemSelection').mockImplementation(() => undefined);
            list.firstSelectedItem = items[1];
            list.lastSelectedItem = items[1];
            list.handleKeyDown(keyEvent(), 'selectNext');
            expect(toggle).not.toHaveBeenCalled();
        });

        it('ignores other actions in the selection phase and only moves the focus', () => {
            const items = useItems([fakeItem(0), fakeItem(1)]);
            const toggle = jest.spyOn(list, 'toggleListItemSelection').mockImplementation(() => undefined);
            list.isListElementMovable = false;
            list.firstSelectedItem = items[0];
            list.lastSelectedItem = items[0];
            list.handleKeyDown(keyEvent(), 'focusNext');
            expect(toggle).not.toHaveBeenCalled();
            expect(list.lastSelectedItem).toBe(items[1]);
        });
    });

    describe('keyboard focus handling', () => {
        beforeEach(() => {
            list.statePersistence = { removeWidgetState: jest.fn(), computeMode: jest.fn().mockReturnValue('SESSION') };
        });

        it('keeps focus on the first item when moving focus up from the top', () => {
            const items = useItems([fakeItem(0), fakeItem(1)]);
            list.isListElementMovable = false;
            list.lastSelectedItem = items[0];
            list.handleKeyDown(keyEvent(), 'focusPrev');
            expect(list.lastSelectedItem).toBe(items[0]);
            expect(list.currentIndex).toBe(1);
        });

        it('selects the last selected item directly when the enter key is pressed on it', () => {
            const items = useItems([fakeItem(0), fakeItem(1)]);
            const click = jest.spyOn(list, 'onItemClick').mockImplementation(() => undefined);
            list.lastSelectedItem = items[1];
            const evt = keyEvent();
            evt.keyCode = 13;
            list.handleKeyDown(evt, 'select');
            expect(click).toHaveBeenCalledWith(evt, items[1]);
        });
    });

    describe('onItemClick selection counting', () => {
        it('counts an object selection as one selected item and none as zero', () => {
            const item = fakeItem(0) as any;
            list.multiselect = true;
            (isMobile as jest.Mock).mockReturnValue(true);
            const limit = jest.spyOn(list, 'checkSelectionLimit').mockReturnValue(true);
            jest.spyOn(list, 'toggleListItemSelection').mockImplementation(() => undefined);
            const getter = jest.spyOn(list, 'selecteditem', 'get').mockReturnValue({ a: 1 });
            list.onItemClick({}, item);
            expect(limit).toHaveBeenLastCalledWith(1);
            getter.mockReturnValue(null);
            list.onItemClick({}, item);
            expect(limit).toHaveBeenLastCalledWith(0);
        });
    });

    describe('onPropertyChange', () => {
        it('keeps the datasource max results when no explicit page size is set and skips the dataset refresh without a dataset', () => {
            list.allowpagesizechange = true;
            list.pagesize = undefined;
            list.dataset = undefined;
            list.datasource = { maxResults: 15 };
            const refresh = jest.spyOn(list, 'onDataSetChange').mockImplementation(() => undefined);
            list.onPropertyChange('datasource', list.datasource);
            expect(list.datasource.maxResults).toBe(15);
            expect(refresh).not.toHaveBeenCalled();
        });

        it('handles navigation changes when there is no navigator yet', () => {
            list.dataNavigator = undefined;
            const change = jest.spyOn(list, 'onNavigationTypeChange').mockImplementation(() => undefined);
            list.onPropertyChange('navigation', 'Basic', 'Pager');
            expect(change).toHaveBeenCalledWith('Basic');
        });

        it('ignores pagination class changes when there is no navigator', () => {
            jest.useFakeTimers();
            list.dataNavigator = undefined;
            expect(() => { list.onPropertyChange('paginationclass', 'x'); jest.runAllTimers(); }).not.toThrow();
        });

        it('does not touch the list element when reordering is switched off before the element exists', () => {
            list.$ulEle = undefined;
            expect(() => list.onPropertyChange('enablereorder', false)).not.toThrow();
            expect(() => list.onPropertyChange('enablereorder', true)).not.toThrow();
        });

        it('re-initialises the selected item widgets as an array when multiselect turns on and an object when off', () => {
            list.onPropertyChange('multiselect', true);
            expect(list.selectedItemWidgets).toEqual([]);
            list.onPropertyChange('multiselect', false);
            expect(list.selectedItemWidgets).toEqual({});
        });
    });

    describe('setDefaultPageSize', () => {
        beforeEach(() => {
            list.statePersistence = { ...list.statePersistence, getWidgetState: jest.fn().mockReturnValue(undefined) };
            list.dataNavigator = { widget: {}, defaultPageSizeOptions: [], pageSizeOptions: [] };
        });

        it('leaves the value as is when no state or page size options exist and falls back to empty options', () => {
            list.allowpagesizechange = true;
            list.pagesizeoptions = undefined;
            list.prevPagesizeoptions = '5,10';
            list.datasource = undefined;
            list.setDefaultPageSize(7);
            expect(list.updatedPageSize).toBe(7);
            expect(list.dataNavigator.defaultPageSizeOptions).toEqual([]);
            expect(list.dataNavigator.maxResults).toBe(7);
        });

        it('keeps the datasource max results when pagesize is not set', () => {
            list.allowpagesizechange = true;
            list.pagesizeoptions = undefined;
            list.prevPagesizeoptions = '';
            list.pagesize = undefined;
            list.datasource = { maxResults: 12 };
            list.setDefaultPageSize(undefined);
            expect(list.datasource.maxResults).toBe(12);
        });
    });

    describe('view init and teardown edge cases', () => {
        const settle = async () => { await list.propsInitPromise; await Promise.resolve(); };

        const hideLivelistContainerFromFind = () => {
            const original = $.fn.find;
            return jest.spyOn($.fn, 'find').mockImplementation(function (this: any, selector: any) {
                return selector === '.app-livelist-container' ? (undefined as any) : original.call(this, selector);
            });
        };

        it('initialises the selected item widgets as an array for multiselect lists', async () => {
            jest.spyOn(list, 'configureDnD').mockImplementation(() => undefined);
            list.multiselect = true;
            list.ngAfterViewInit();
            await settle();
            expect(list.selectedItemWidgets).toEqual([]);
        });

        it('copes with a missing list container element while configuring reordering', async () => {
            const dnd = jest.spyOn(list, 'configureDnD').mockImplementation(() => undefined);
            hideLivelistContainerFromFind();
            list.enablereorder = true;
            list.groupby = '';
            list.ngAfterViewInit();
            await settle();
            expect(dnd).toHaveBeenCalled();
        });

        it('copes with a missing list container element when reordering is disabled', async () => {
            const finder = hideLivelistContainerFromFind();
            list.enablereorder = false;
            list.ngAfterViewInit();
            await settle();
            expect(finder).toHaveBeenCalledWith('.app-livelist-container');
            expect(list.selectedItemWidgets).toEqual({});
        });

        it('does not set the reorder aria description when the ul element is missing', () => {
            list.nativeElement.querySelector('ul.app-livelist-container').remove();
            list.enablereorder = true;
            expect(() => list.ngAfterViewInit()).not.toThrow();
            list.enablereorder = false;
            expect(() => list.ngAfterViewInit()).not.toThrow();
        });

        it('does not bind the click handler in setupHandlers when the ul element is missing', () => {
            list.nativeElement.querySelector('ul.app-livelist-container').remove();
            list.listItems = { changes: { subscribe: jest.fn().mockReturnValue({ unsubscribe: jest.fn() }) } };
            list.setupHandlers();
            expect(list.listItems.changes.subscribe).toHaveBeenCalled();
            expect(typeof list.boundClickHandler).toBe('function');
        });

        it('tolerates destruction when the app listener destroyers are already gone', () => {
            list._listenerDestroyers = undefined;
            expect(() => list.ngOnDestroy()).not.toThrow();
        });
    });

    describe('data changes', () => {
        it('falls back to an empty list when an api aware datasource clones the data to an empty object', () => {
            const update = jest.spyOn(list, 'updateFieldDefs').mockImplementation(() => undefined);
            const invoke = jest.spyOn(list, 'invokeEventCallback').mockImplementation(() => undefined);
            list.datasource = { execute: jest.fn((op: any) => op === DataSource.Operation.IS_API_AWARE) };
            // lodash cannot clone error objects and returns an empty object for them
            list.onDataChange(Object.assign(new Error('not cloneable'), { code: 1 }));
            expect(update).toHaveBeenCalledWith([]);
            expect(invoke).not.toHaveBeenCalledWith('beforedatarender', expect.anything());
        });

        const demandLoadDatasource = (records: any) => ({
            owner: 'App',
            execute: jest.fn((op: any) => {
                if (op === DataSource.Operation.GET_PAGING_OPTIONS) return { number: 1 };
                if (op === DataSource.Operation.LIST_RECORDS) return records;
                return false;
            }),
        });

        it('renders the first page for load-on-demand lists (without infinite scroll)', () => {
            const update = jest.spyOn(list, 'updateFieldDefs').mockImplementation(() => undefined);
            jest.spyOn(list, 'invokeEventCallback').mockImplementation(() => undefined);
            list.infScroll = false;
            list.onDemandLoad = true;
            list.currentPage = 0;
            list.datasource = demandLoadDatasource([{ id: 'first' }]);
            list.onDataChange([{ id: 'later' }]);
            expect(update).toHaveBeenCalledWith([{ id: 'first' }]);
        });

        it('does not update the field definitions when the first page is not a list', () => {
            const update = jest.spyOn(list, 'updateFieldDefs').mockImplementation(() => undefined);
            list.infScroll = true;
            list.currentPage = 0;
            list.datasource = demandLoadDatasource(undefined);
            list.onDataChange([{ id: 'later' }]);
            expect(update).not.toHaveBeenCalled();
        });

        it('does not raise beforedatarender when the first page is empty', () => {
            const update = jest.spyOn(list, 'updateFieldDefs').mockImplementation(() => undefined);
            const invoke = jest.spyOn(list, 'invokeEventCallback').mockImplementation(() => undefined);
            list.infScroll = true;
            list.currentPage = 0;
            list.datasource = demandLoadDatasource([]);
            list.onDataChange([{ id: 'later' }]);
            expect(invoke).not.toHaveBeenCalledWith('beforedatarender', expect.anything());
            expect(update).toHaveBeenCalledWith([]);
        });

        it('passes the item context as the datasource to the navigator when the dataset is bound to an item field', () => {
            const setBind = jest.fn();
            const sub = () => ({ unsubscribe: jest.fn() });
            list.dataNavigator = { resultEmitter: { subscribe: sub }, maxResultsEmitter: { subscribe: sub }, setBindDataSet: setBind };
            list.context = { ctx: true };
            list.datasource = { ds: true };
            jest.spyOn(list, 'getAttr').mockImplementation((name: string) => (name === 'datasetboundexpr' ? 'item.children' : undefined) as any);
            list.setupDataSource();
            expect(setBind.mock.calls[0][2]).toBe(list.context);
            expect(setBind.mock.calls[0][5]).toBe('item.children');
        });

        it('passes the datasource to the navigator when the dataset is not bound to an item field', () => {
            const setBind = jest.fn();
            const sub = () => ({ unsubscribe: jest.fn() });
            list.dataNavigator = { resultEmitter: { subscribe: sub }, maxResultsEmitter: { subscribe: sub }, setBindDataSet: setBind };
            list.datasource = { ds: true };
            jest.spyOn(list, 'getAttr').mockReturnValue(undefined);
            list.setupDataSource();
            expect(setBind.mock.calls[0][2]).toBe(list.datasource);
        });

        it('does not ask the navigator to change page when the state has neither page nor page size', () => {
            const pageChanged = jest.fn();
            list.statePersistence = { computeMode: jest.fn().mockReturnValue('SESSION'), getWidgetState: jest.fn().mockReturnValue({}) };
            list.dataNavigator = { pageChanged };
            list.dataNavigatorWatched = true;
            list.navigation = 'None';
            list.datasource = { category: 'wm.Variable' };
            list.allowpagesizechange = true;
            list._pageLoad = true;
            list.onDataSetChange([{ a: 1 }]);
            expect(pageChanged).not.toHaveBeenCalled();
            expect(list._pageLoad).toBe(false);
            expect(list._selectedItemsExist).not.toBe(true);
        });
    });

    describe('selection state', () => {
        const state = () => {
            const persistence = {
                computeMode: jest.fn().mockReturnValue('SESSION'),
                getWidgetState: jest.fn(),
                removeWidgetState: jest.fn(),
                setWidgetState: jest.fn(),
            };
            list.statePersistence = persistence;
            return persistence;
        };

        it('defaults the current page to 1 when there is no navigator', () => {
            const persistence = state();
            persistence.getWidgetState.mockReturnValue({ selectedItem: [{ page: 1, index: 3 }, { page: 2, index: 1 }] });
            useItems([fakeItem(0, { isActive: true })]);
            list.dataNavigator = undefined;
            list.multiselect = false;
            list.navigation = 'Basic';
            list.updateSelectedItemsWidgets();
            expect(persistence.setWidgetState).toHaveBeenCalledWith(list, { selectedItem: [{ page: 1, index: 0 }] });
        });

        it('does not store the same page/index of a selected item twice in multiselect lists', () => {
            const persistence = state();
            persistence.getWidgetState.mockReturnValue({ selectedItem: [{ page: 2, index: 0 }] });
            const items = [fakeItem(0, { isActive: true }), fakeItem(1, { isActive: true })];
            list.listItems = { forEach: (fn: any) => items.forEach(i => fn(i, 0)), length: 2 };
            list.multiselect = true;
            list.selectedItemWidgets = [];
            list._items = [{}, {}];
            list.navigation = 'Basic';
            list.dataNavigator = { dn: { currentPage: 1 } };
            list.updateSelectedItemsWidgets();
            expect(persistence.setWidgetState).toHaveBeenCalledWith(list, { selectedItem: [{ page: 2, index: 0 }, { page: 1, index: 0 }] });
        });
    });

    describe('rendering with persisted state', () => {
        const render = (items: any[]) => {
            useItems(items);
            return { length: items.length, first: items[0] };
        };

        beforeEach(() => {
            jest.spyOn(list, 'invokeEventCallback').mockImplementation(() => undefined);
            list.fieldDefs = [];
            list.selectfirstitem = false;
            list.infScroll = false;
            list.onDemandLoad = false;
            list.isDataChanged = true;
            list._selectedItemsExist = true;
            jest.spyOn(list, 'setupDataSource').mockImplementation(() => undefined);
        });

        it('keeps waiting for the stored selection when the state has no selected items', () => {
            const getState = jest.fn().mockReturnValue({});
            list.statePersistence = { computeMode: jest.fn().mockReturnValue('SESSION'), getWidgetState: getState };
            const select = jest.spyOn(list, 'selectItem').mockImplementation(() => undefined);
            list.onListRender(render([fakeItem(0)]));
            expect(getState).toHaveBeenCalled();
            expect(list._selectedItemsExist).toBe(true);
            expect(select).not.toHaveBeenCalled();
        });

        it('restores the stored selection of a single select list', () => {
            list.statePersistence = {
                computeMode: jest.fn().mockReturnValue('SESSION'),
                getWidgetState: jest.fn().mockReturnValue({ selectedItem: [{ page: 1, index: 0 }] }),
            };
            const select = jest.spyOn(list, 'selectItem').mockImplementation(() => undefined);
            list.dataNavigator = { dn: {} };
            list.multiselect = false;
            list.onListRender(render([fakeItem(0)]));
            expect(select).toHaveBeenCalledWith(0, true);
        });

        it('does not restore the selection when everything stored is already selected', () => {
            const widgetState: any = { selectedItem: [{ page: 1, index: 0 }] };
            list.statePersistence = { computeMode: jest.fn().mockReturnValue('SESSION'), getWidgetState: jest.fn().mockReturnValue(widgetState) };
            const select = jest.spyOn(list, 'selectItem').mockImplementation(() => undefined);
            list.dataNavigator = { dn: {} };
            list.multiselect = true;
            list._items = [{ name: 'item0' }];
            list.onListRender(render([fakeItem(0)]));
            expect(select).not.toHaveBeenCalled();
            expect(widgetState.pagination).toBe(1);
        });

        it('does not limit the height of infinite scroll lists outside of mobile modals', () => {
            jest.useFakeTimers();
            list.statePersistence = { computeMode: jest.fn().mockReturnValue('NONE'), getWidgetState: jest.fn() };
            const bind = jest.spyOn(list.paginationService, 'bindScrollEvt').mockImplementation(() => undefined);
            (isMobile as jest.Mock).mockReturnValue(false);
            list.fieldDefs = [{}];
            list.infScroll = true;
            list.nativeElement.style.height = '';
            list.onListRender(render([fakeItem(0)]));
            jest.advanceTimersByTime(600);
            expect(list.nativeElement.style.height).toBe('');
            expect(bind).toHaveBeenCalled();
        });
    });
});
