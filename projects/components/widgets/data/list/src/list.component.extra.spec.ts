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
        <div wmList template="true" itemsperrow="xs-1 sm-1 md-1 lg-1" class="media-list" name="extraList"
             dataset.bind="testdata" navigation="Basic">
            <ng-template #listTemplate let-item="item" let-$index="$index" let-itemRef="itemRef" let-$first="$first" let-$last="$last" let-currentItemWidgets="currentItemWidgets">
                <label wmLabel name="Name" class="p media-heading" caption.bind="item.name"></label>
            </ng-template>
        </div>
    `,
})
class ExtraListWrapperComponent {
    @ViewChild(ListComponent, { static: true }) listComponent: ListComponent;
    public testdata: any = [{ name: 'Peter', age: 21 }, { name: 'Tony', age: 42 }];

    constructor(_pipeProvider: PipeProvider) {
        setPipeProvider(_pipeProvider);
    }
}

describe('ListComponent - extra behaviour', () => {
    let fixture: ComponentFixture<ExtraListWrapperComponent>;
    let list: any;
    let notify: jest.SpyInstance;

    const fakeItem = (index: number, overrides: any = {}) => ({
        context: { index },
        isActive: false,
        disableItem: false,
        item: { name: `item${index}` },
        currentItemWidgets: { w1: { name: `w1-${index}` } },
        nativeElement: document.createElement('li'),
        ...overrides,
    });

    const useItems = (items: any[]) => {
        list.listItems = {
            toArray: () => items,
            find: (fn: any) => items.find(fn),
            forEach: (fn: any) => items.forEach(fn),
            get length() { return items.length; },
            reset: jest.fn(),
            setDirty: jest.fn(),
        };
        return items;
    };

    beforeEach(waitForAsync(() => {
        TestBed.configureTestingModule({
            imports: [FormsModule, PaginationModule, WmPaginationModule, ListComponent, ListItemDirective],
            declarations: [ExtraListWrapperComponent],
            providers: [
                { provide: App, useValue: mockApp },
                { provide: ToDatePipe, useClass: ToDatePipe },
                { provide: AppDefaults, useClass: AppDefaults },
                { provide: AbstractI18nService, useClass: MockAbstractI18nService },
                { provide: DatePipe, useValue: DatePipe },
                TextContentDirective,
            ],
        }).compileComponents();
        fixture = TestBed.createComponent(ExtraListWrapperComponent);
        list = fixture.componentInstance.listComponent;
        fixture.detectChanges();
        notify = jest.spyOn(list.app, 'notify');
        // the navigator is set up asynchronously by the widget itself; keep it out of these unit tests
        jest.spyOn(list, 'setupDataSource').mockImplementation(() => undefined);
    }));

    afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
        (isMobile as jest.Mock).mockReturnValue(false);
        fixture?.destroy();
    });

    describe('selection model', () => {
        it('returns the selected items as an object, empty object or array', () => {
            list._items = [];
            list.multiselect = false;
            expect(list.selecteditem).toEqual({});
            list._items = [{ a: 1 }, { a: 2 }];
            expect(list.selecteditem).toEqual({ a: 1 });
            expect(list.selecteditem).not.toBe(list._items[0]);
            list.multiselect = true;
            expect(list.selecteditem).toEqual([{ a: 1 }, { a: 2 }]);
        });

        it('replaces the selection when items are assigned', () => {
            const deselect = jest.spyOn(list, 'deselectListItems').mockImplementation(() => undefined);
            const select = jest.spyOn(list, 'selectItem').mockImplementation(() => undefined);
            list._items = [{ a: 1 }];
            list.selecteditem = [1, 2];
            expect(list._items).toEqual([]);
            expect(deselect).toHaveBeenCalled();
            expect(select).toHaveBeenCalledTimes(2);
            list.selecteditem = 3;
            expect(select).toHaveBeenLastCalledWith(3);
        });

        it('selects only inactive items and focuses them', () => {
            const item: any = fakeItem(0);
            const focus = jest.spyOn(item.nativeElement, 'focus');
            const toggle = jest.spyOn(list, 'toggleListItemSelection').mockImplementation(() => undefined);
            jest.spyOn(list, 'getItemRefByIndexOrModel').mockReturnValue(item);

            list.selectItem(0, true);
            expect(toggle).toHaveBeenCalledWith(item, true);
            expect(focus).toHaveBeenCalled();

            toggle.mockClear();
            item.isActive = true;
            list.selectItem(0);
            expect(toggle).not.toHaveBeenCalled();
        });

        it('ignores unknown items on select', () => {
            jest.spyOn(list, 'getItemRefByIndexOrModel').mockReturnValue(undefined);
            const toggle = jest.spyOn(list, 'toggleListItemSelection').mockImplementation(() => undefined);
            list.selectItem(5);
            expect(toggle).not.toHaveBeenCalled();
        });

        it('deselects only active items', () => {
            const toggle = jest.spyOn(list, 'toggleListItemSelection').mockImplementation(() => undefined);
            const item: any = fakeItem(0, { isActive: true });
            jest.spyOn(list, 'getItemRefByIndexOrModel').mockReturnValue(item);
            list.deselectItem(0);
            expect(toggle).toHaveBeenCalledWith(item);
            toggle.mockClear();
            item.isActive = false;
            list.deselectItem(0);
            expect(toggle).not.toHaveBeenCalled();
        });
    });

    describe('item access', () => {
        it('returns the widgets of every item by name', () => {
            useItems([fakeItem(0), fakeItem(1), fakeItem(2, { currentItemWidgets: {} })]);
            expect(list.getWidgets('w1')).toEqual([{ name: 'w1-0' }, { name: 'w1-1' }]);
            expect(list.getWidgets(undefined)).toBeUndefined();
        });

        it('returns the widget of one item by index', () => {
            useItems([fakeItem(0), fakeItem(1)]);
            expect(list.getWidgets('w1', 1)).toEqual([{ name: 'w1-1' }]);
            expect(list.getWidgets('w1', '0' as any)).toEqual([{ name: 'w1-0' }]);
            expect(list.getWidgets('w1', 9)).toBeUndefined();
        });

        it('looks up items by index and model', () => {
            const spy = jest.spyOn(list, 'getListItemByIndex').mockReturnValue('item' as any);
            expect(list.getItem(2)).toBe('item');
            expect(spy).toHaveBeenCalledWith(2);
        });

        it('finds the index of directives and plain objects', () => {
            const directive = Object.create(ListItemDirective.prototype);
            jest.spyOn(list, 'getListItemIndex').mockReturnValue(4);
            expect(list.getIndex(directive)).toBe(4);
            list.fieldDefs = [{ a: 1 }, { a: 2 }];
            expect(list.getIndex({ a: 2 })).toBe(1);
            expect(list.getIndex(undefined)).toBeUndefined();
        });
    });

    describe('CUD events', () => {
        let trigger: jest.SpyInstance;

        beforeEach(() => {
            trigger = jest.spyOn(list, 'triggerWMEvent').mockImplementation(() => undefined);
        });

        it('does nothing for independent lists', () => {
            list._isDependent = false;
            list.create();
            list.editRow(0);
            list.deleteRow(0);
            expect(trigger).not.toHaveBeenCalled();
        });

        it('raises events for dependent lists', () => {
            list._isDependent = true;
            jest.spyOn(list, 'getItemRefByIndexOrModel').mockReturnValue({ item: { id: 7 } });
            list.create();
            expect(trigger).toHaveBeenLastCalledWith('insert');
            list.editRow();
            expect(trigger).toHaveBeenLastCalledWith('update', undefined);
            list.editRow(1);
            expect(trigger).toHaveBeenLastCalledWith('update', { id: 7 });
            list.update(1);
            expect(trigger).toHaveBeenLastCalledWith('update', { id: 7 });
            list.deleteRow(1);
            expect(trigger).toHaveBeenLastCalledWith('delete', { id: 7 });
            list.delete();
            expect(trigger).toHaveBeenLastCalledWith('delete', undefined);
        });

        it('notifies the app with the selected row', () => {
            trigger.mockRestore();
            list.name = 'extraList';
            list.multiselect = false;
            list._items = [{ id: 1 }];
            list.triggerWMEvent('update');
            expect(notify).toHaveBeenCalledWith('wm-event', { eventName: 'update', widgetName: 'extraList', row: { id: 1 } });

            list.multiselect = true;
            list._items = [{ id: 1 }, { id: 2 }];
            list.triggerWMEvent('delete');
            expect(notify).toHaveBeenLastCalledWith('wm-event', expect.objectContaining({ row: { id: 2 } }));

            list.triggerWMEvent('delete', { id: 9 });
            expect(notify).toHaveBeenLastCalledWith('wm-event', expect.objectContaining({ row: { id: 9 } }));
        });
    });

    describe('data source integration', () => {
        it('tracks the loading state of an API aware data source', () => {
            list.datasource = { execute: jest.fn().mockReturnValue(true), getUniqueIdentifier: () => 'u' };
            jest.spyOn(list, 'handleStateParams').mockImplementation(() => undefined);
            list.datasource.execute.mockImplementation((op: any) => (op === DataSource.Operation.IS_API_AWARE ? true : 'same'));
            list.handleLoading({ variable: { execute: () => 'same' }, active: true, data: { pagination: { totalElements: 0 } } });
            expect(list.variableInflight).toBe(true);
            expect(list.noDataFound).toBe(true);

            list.handleLoading({ variable: { execute: () => 'same' }, active: false, data: { pagination: { totalElements: 3 } } });
            expect(list.noDataFound).toBe(false);

            list.handleLoading({ variable: { execute: () => 'same' }, active: false, data: { data: [] } });
            expect(list.noDataFound).toBe(true);
        });

        it('ignores loading events when the data source is not API aware', () => {
            list.datasource = { execute: jest.fn().mockReturnValue(false) };
            list.variableInflight = false;
            list.handleLoading({ variable: {}, active: true });
            expect(list.variableInflight).toBe(false);
        });

        it('reports what the list supports to other data widgets', () => {
            expect(list.execute(DataSource.Operation.IS_API_AWARE)).toBe(false);
            expect(list.execute(DataSource.Operation.IS_PAGEABLE)).toBe(false);
            expect(list.execute(DataSource.Operation.SUPPORTS_SERVER_FILTER)).toBe(false);
        });

        it('adds the stored pagination to the options on the first load only', () => {
            list.statePersistence = { computeMode: jest.fn().mockReturnValue('SESSION'), getWidgetState: jest.fn().mockReturnValue({ pagination: 3, selectedItem: [{}] }) };
            list._pageLoad = true;
            const options: any = {};
            list.handleStateParams(options);
            expect(options.options.page).toBe(3);
            expect(list._selectedItemsExist).toBe(true);
            expect(list._pageLoad).toBe(false);

            const again: any = {};
            list.handleStateParams(again);
            expect(again.options).toBeUndefined();
        });

        it('skips state restoration when persistence is off', () => {
            list.statePersistence = { computeMode: jest.fn().mockReturnValue('NONE'), getWidgetState: jest.fn() };
            list._pageLoad = true;
            list.handleStateParams({});
            expect(list.statePersistence.getWidgetState).not.toHaveBeenCalled();
        });

        it('triggers the item selection for the list items of this list only', () => {
            const click = jest.spyOn(list, 'onItemClick').mockImplementation(() => undefined);
            const $el = $('<li></li>');
            $el.data('listItemContext', { listComponent: list });
            list.triggerListItemSelection($el, 'evt' as any);
            expect(click).toHaveBeenCalledWith('evt', { listComponent: list });

            click.mockClear();
            const other = $('<li></li>');
            other.data('listItemContext', { listComponent: {} });
            list.triggerListItemSelection(other, 'evt' as any);
            list.triggerListItemSelection($(), 'evt' as any);
            expect(click).not.toHaveBeenCalled();
        });
    });

    describe('navigation', () => {
        it.each([
            ['Basic', 'Basic', true],
            ['Inline', 'Inline', undefined],
            ['Classic', 'Classic', true],
            ['Advanced', 'Classic', true],
            ['Pager', 'Pager', true],
            ['None', 'None', false],
        ])('%s navigation configures the controls', (type, controls, show) => {
            list.onNavigationTypeChange(type);
            expect(list.navControls).toBe(controls);
            if (show !== undefined) {
                expect(list.showNavigation).toBe(show);
            }
        });

        it('enables infinite scroll and on demand loading', () => {
            list.onNavigationTypeChange('Scroll');
            expect(list.infScroll).toBe(true);
            expect(list.onDemandLoad).toBe(false);
            list.onNavigationTypeChange('On-Demand');
            expect(list.onDemandLoad).toBe(true);
            expect(list.infScroll).toBe(false);
            expect(list.showNavigation).toBe(true);
        });
    });

    describe('page size options', () => {
        it.each([
            ['', ''],
            [undefined, ''],
            ['10, 5, 10, abc, -20', '10,5,20'],
        ])('sanitizes %p to %p', (input, expected) => {
            expect(list.sanitizeCommaSeparatedIntegers(input as any)).toBe(expected);
        });

        it('falls back to a page size of 20', () => {
            list.actualPageSize = undefined;
            expect(list.getActualPageSize()).toBe(20);
            list.actualPageSize = 10;
            expect(list.getActualPageSize()).toBe(10);
        });

        it('detects a change of the page size options', () => {
            list.prevPagesizeoptions = '5';
            list.pagesizeoptions = '5';
            expect(list.isPageSizeOptionsChanged()).toBe(false);
            list.pagesizeoptions = '10';
            expect(list.isPageSizeOptionsChanged()).toBe(true);
        });

        describe('setDefaultPageSize', () => {
            beforeEach(() => {
                list.dataNavigator = { widget: {}, pageSizeOptions: [], defaultPageSizeOptions: [] };
                list.statePersistence = { getWidgetState: jest.fn().mockReturnValue(undefined) };
                list.datasource = { maxResults: 3 };
            });

            it('applies the size to the navigator and the data source', () => {
                list.allowpagesizechange = false;
                list.pagesize = 7;
                list.setDefaultPageSize(10);
                expect(list.updatedPageSize).toBe(10);
                expect(list.dataNavigator.maxResults).toBe(10);
                expect(list.dataNavigator.options).toEqual({ maxResults: 10 });
                expect(list.datasource.maxResults).toBe(7);
            });

            it('prefers the size stored in the widget state', () => {
                list.allowpagesizechange = true;
                list.pagesizeoptions = '20,10';
                list.prevPagesizeoptions = '';
                (list.statePersistence.getWidgetState as jest.Mock).mockReturnValue({ pagesize: 20 });
                list.setDefaultPageSize(5);
                expect(list.pagesize).toBe(20);
                expect(list.dataNavigator.pageSizeOptions).toEqual([10, 20]);
            });

            it('falls back to the smallest configured option', () => {
                list.allowpagesizechange = true;
                list.pagesizeoptions = '20,10';
                list.prevPagesizeoptions = '20,10';
                list.setDefaultPageSize(5);
                expect(list.pagesize).toBe(10);
                expect(list.dataNavigator.pageSizeOptions).toEqual([]);
            });
        });

        describe('selectPageSize', () => {
            beforeEach(() => {
                list.dataNavigator = { pageSizeOptions: [5, 10, 20], onPageSizeChange: jest.fn() };
            });

            it('ignores the call when changes are not allowed and no size is given', () => {
                list.allowpagesizechange = false;
                list.selectPageSize(undefined as any);
                expect(list.dataNavigator.onPageSizeChange).not.toHaveBeenCalled();
            });

            it('accepts valid sizes and corrects invalid ones', () => {
                list.allowpagesizechange = true;
                list.selectPageSize(10);
                list.selectPageSize(2);
                list.selectPageSize(50);
                list.selectPageSize(7);
                expect(list.dataNavigator.onPageSizeChange.mock.calls.map((c: any[]) => c[1])).toEqual([10, 5, 5, 5]);
            });
        });
    });

    describe('onPropertyChange', () => {
        it('ignores tabindex', () => {
            const change = jest.spyOn(list, 'onDataSetChange').mockImplementation(() => undefined);
            list.onPropertyChange('tabindex', 1);
            expect(change).not.toHaveBeenCalled();
        });

        it('waits for the data source when a bound dataset is empty', () => {
            const change = jest.spyOn(list, 'onDataSetChange').mockImplementation(() => undefined);
            list.binddatasource = 'Variables.x';
            list.datasource = undefined;
            list.onPropertyChange('dataset', undefined);
            expect(change).not.toHaveBeenCalled();
            list.onPropertyChange('dataset', [1]);
            expect(change).toHaveBeenCalledWith([1]);
        });

        it('re-processes the dataset when the data source changes', () => {
            const change = jest.spyOn(list, 'onDataSetChange').mockImplementation(() => undefined);
            list.allowpagesizechange = true;
            list.pagesize = 15;
            list.datasource = { maxResults: 3 };
            list.dataset = [1, 2];
            list.onPropertyChange('datasource', list.datasource);
            expect(list.datasource.maxResults).toBe(15);
            expect(change).toHaveBeenCalledWith([1, 2]);
        });

        it('converts the advanced navigation type to classic', () => {
            list.onPropertyChange('navigation', 'Advanced');
            expect(list.navigation).toBe('Classic');
        });

        it('applies a navigation type', () => {
            list.dataNavigator = { navigationClass: '' };
            list.paginationclass = 'pagination-lg';
            list.onPropertyChange('navigation', 'Pager', 'Basic');
            expect(list.navControls).toBe('Pager');
            expect(list.dataNavigator.navigationClass).toBe('pagination-lg');
        });

        it('enables pull to refresh', () => {
            const subscribe = jest.spyOn(list, 'subscribeToPullToRefresh').mockImplementation(() => undefined);
            list.onPropertyChange('pulltorefresh', true);
            expect(notify).toHaveBeenCalledWith('pullToRefresh:enable');
            expect(subscribe).toHaveBeenCalled();
        });

        it('updates the navigation class of the paginator later', () => {
            jest.useFakeTimers();
            list.dataNavigator = { navigationClass: '' };
            list.onPropertyChange('paginationclass', 'pagination-sm');
            jest.runAllTimers();
            expect(list.dataNavigator.navigationClass).toBe('pagination-sm');
            jest.useRealTimers();
        });

        it('applies the page size and its options', () => {
            const setDefault = jest.spyOn(list, 'setDefaultPageSize').mockImplementation(() => undefined);
            list.onPropertyChange('pagesize', 25);
            expect(list.actualPageSize).toBe(25);
            expect(setDefault).toHaveBeenCalledWith(25);

            list.allowpagesizechange = true;
            list.onPropertyChange('pagesizeoptions', '20, 10', '5');
            expect(list.pagesizeoptions).toBe('20,10');
            expect(list.prevPagesizeoptions).toBe('5');
            expect(setDefault).toHaveBeenCalledTimes(2);
        });

        it('enables or disables page size changes on the navigator', () => {
            list.dataNavigator = {};
            list.onPropertyChange('allowpagesizechange', true);
            expect(list.dataNavigator.allowpagesizechange).toBe(true);
        });

        it('resets the selected widgets when multiselect changes', () => {
            list.onPropertyChange('multiselect', true);
            expect(list.selectedItemWidgets).toEqual([]);
            list.onPropertyChange('multiselect', false);
            expect(list.selectedItemWidgets).toEqual({});
        });

        it('enables and disables reordering', () => {
            const sortable = jest.fn();
            const attr = jest.fn();
            const removeAttr = jest.fn();
            list.$ulEle = { sortable, attr, removeAttr };
            jest.spyOn(list, 'configureDnD').mockImplementation(() => undefined);
            list.onPropertyChange('enablereorder', true);
            expect(sortable).toHaveBeenCalledWith('enable');
            list.onPropertyChange('enablereorder', false);
            expect(sortable).toHaveBeenCalledWith('disable');
            expect(removeAttr).toHaveBeenCalledWith('aria-describedby');
        });
    });

    describe('item click', () => {
        let toggle: jest.SpyInstance;
        let clear: jest.SpyInstance;
        let limitExceeded: jest.SpyInstance;

        beforeEach(() => {
            toggle = jest.spyOn(list, 'toggleListItemSelection').mockImplementation(() => undefined);
            clear = jest.spyOn(list, 'clearSelectedItems').mockImplementation(() => undefined);
            jest.spyOn(list, 'invokeEventCallback').mockImplementation(() => undefined);
            limitExceeded = list.invokeEventCallback;
            list.multiselect = false;
            list._items = [];
        });

        it('ignores disabled items', () => {
            list.onItemClick({}, fakeItem(0, { disableItem: true }));
            expect(toggle).not.toHaveBeenCalled();
        });

        it('selects the clicked item exclusively', () => {
            const item: any = fakeItem(0);
            list.onItemClick({}, item);
            expect(clear).toHaveBeenCalled();
            expect(toggle).toHaveBeenCalledWith(item);
            expect(list.lastSelectedItem).toBe(item);
        });

        it('keeps an already selected item', () => {
            list._items = [{}];
            list.onItemClick({}, fakeItem(0, { isActive: true }));
            expect(toggle).not.toHaveBeenCalled();
        });

        it('toggles items with ctrl or meta in multi select lists', () => {
            list.multiselect = true;
            jest.spyOn(list, 'checkSelectionLimit').mockReturnValue(true);
            const item: any = fakeItem(0);
            list.onItemClick({ ctrlKey: true }, item);
            list.onItemClick({ metaKey: true }, item);
            expect(toggle).toHaveBeenCalledTimes(2);
        });

        it('reports when the selection limit is exceeded', () => {
            list.multiselect = true;
            jest.spyOn(list, 'checkSelectionLimit').mockReturnValue(false);
            list.onItemClick({ ctrlKey: true, type: 'click' }, fakeItem(0));
            expect(limitExceeded).toHaveBeenCalledWith('selectionlimitexceed', { $event: { ctrlKey: true, type: 'click' } });
        });

        it('lets active items be toggled off even at the limit', () => {
            list.multiselect = true;
            jest.spyOn(list, 'checkSelectionLimit').mockReturnValue(false);
            list.onItemClick({ ctrlKey: true }, fakeItem(0, { isActive: true }));
            expect(toggle).toHaveBeenCalled();
        });

        it('selects the range between the first selected item and the clicked item on shift', () => {
            list.multiselect = true;
            const items = useItems([fakeItem(0), fakeItem(1), fakeItem(2), fakeItem(3)]);
            jest.spyOn(list, 'checkSelectionLimit').mockReturnValue(true);
            list.firstSelectedItem = items[1];
            list.onItemClick({ shiftKey: true }, items[3]);
            expect(clear).toHaveBeenCalled();
            expect(toggle.mock.calls.map((c) => (c[0] as any).context.index)).toEqual([1, 2, 3]);
            expect(list.lastSelectedItem).toBe(items[3]);
        });

        it('selects a range upwards as well', () => {
            list.multiselect = true;
            const items = useItems([fakeItem(0), fakeItem(1), fakeItem(2)]);
            jest.spyOn(list, 'checkSelectionLimit').mockReturnValue(true);
            list.firstSelectedItem = items[2];
            list.onItemClick({ shiftKey: true }, items[0]);
            expect(toggle).toHaveBeenCalledTimes(3);
        });

        it('reports the limit for a too large shift range', () => {
            list.multiselect = true;
            const items = useItems([fakeItem(0), fakeItem(1)]);
            jest.spyOn(list, 'checkSelectionLimit').mockReturnValue(false);
            list.firstSelectedItem = items[0];
            list.onItemClick({ shiftKey: true }, items[1]);
            expect(limitExceeded).toHaveBeenCalledWith('selectionlimitexceed', expect.anything());
        });

        it('toggles items on mobile multi select lists', () => {
            (isMobile as jest.Mock).mockReturnValue(true);
            list.multiselect = true;
            jest.spyOn(list, 'checkSelectionLimit').mockReturnValueOnce(true).mockReturnValueOnce(false);
            list.onItemClick({}, fakeItem(0));
            expect(toggle).toHaveBeenCalledTimes(1);
            list.onItemClick({}, fakeItem(1));
            expect(limitExceeded).toHaveBeenCalledWith('selectionlimitexceed', expect.anything());
        });
    });

    describe('list rendering helpers', () => {
        it('clears the list through empty field definitions', () => {
            const update = jest.spyOn(list, 'updateFieldDefs').mockImplementation(() => undefined);
            list.clear();
            expect(update).toHaveBeenCalledWith([]);
        });

        it('stores the field definitions and marks the items dirty', () => {
            const items = useItems([]);
            list.infScroll = false;
            list.onDemandLoad = false;
            list.orderby = '';
            list.groupby = '';
            list.updateFieldDefs([{ a: 1 }]);
            expect(list.fieldDefs).toEqual([{ a: 1 }]);
            expect(list.listItems.setDirty).toHaveBeenCalled();
            expect(items.length).toBe(0);
        });

        it('shows the no data message and clears the selection for empty definitions', () => {
            useItems([]);
            list.infScroll = false;
            list.updateFieldDefs([]);
            expect(list.noDataFound).toBe(true);
        });

        it('orders the field definitions', () => {
            useItems([]);
            list.infScroll = false;
            list.orderby = 'age:desc';
            list.updateFieldDefs([{ age: 1 }, { age: 3 }]);
            expect(list.fieldDefs[0].age).toBe(3);
            list.orderby = '';
        });

        it('merges pages for scrolling lists', () => {
            useItems([]);
            list.infScroll = true;
            jest.spyOn(list.paginationService, 'updateFieldsOnPagination').mockReturnValue([[{ a: 1 }, { a: 2 }], 2]);
            list.updateFieldDefs([{ a: 2 }]);
            expect(list.fieldDefs.length).toBe(2);
            expect(list.currentPage).toBe(2);
        });

        it('processes object, string and array data', () => {
            const update = jest.spyOn(list, 'updateFieldDefs').mockImplementation(() => undefined);
            const invoke = jest.spyOn(list, 'invokeEventCallback').mockImplementation(() => undefined);
            list.datasource = undefined;
            list.onDataChange({ a: 1 });
            expect(update).toHaveBeenLastCalledWith([{ a: 1 }]);
            list.onDataChange('x,y');
            expect(update).toHaveBeenLastCalledWith(['x', 'y']);
            list.onDataChange([{ b: 1 }]);
            expect(invoke).toHaveBeenCalledWith('beforedatarender', { $data: [{ b: 1 }] });
            expect(list.isDataChanged).toBe(true);
            list.onDataChange([]);
            expect(update).toHaveBeenLastCalledWith([]);
        });

        it('clones data from API aware data sources', () => {
            const update = jest.spyOn(list, 'updateFieldDefs').mockImplementation(() => undefined);
            list.datasource = { execute: jest.fn().mockReturnValue(true) };
            const data = [{ a: 1 }];
            list.onDataChange(data);
            expect(update.mock.calls[0][0]).toEqual(data);
            expect(update.mock.calls[0][0]).not.toBe(data);
        });

        it('limits the selection by the configured maximum', () => {
            list.selectionlimit = 2;
            expect(list.checkSelectionLimit(1)).toBe(true);
            expect(list.checkSelectionLimit(2)).toBe(false);
            list.selectionlimit = 0;
            expect(list.checkSelectionLimit(100)).toBe(true);
        });

        it('tracks items by their index', () => {
            expect(list.trackByFn(3)).toBe(3);
        });
    });

    describe('selection internals', () => {
        const state = () => {
            const fake: any = { getWidgetState: jest.fn(), setWidgetState: jest.fn(), removeWidgetState: jest.fn(), computeMode: jest.fn().mockReturnValue('SESSION') };
            list.statePersistence = fake;
            return fake;
        };

        it('deselects all items and clears the selection model', () => {
            const items = useItems([fakeItem(0, { isActive: true }), fakeItem(1, { isActive: true })]);
            list._items = [{}, {}];
            list.clearSelectedItems();
            expect(items.every((i: any) => !i.isActive)).toBe(true);
            expect(list._items).toEqual([]);
        });

        it('finds list items by model, ignoring the group index', () => {
            const items = useItems([fakeItem(0, { item: { id: 1, _groupIndex: 0 } }), fakeItem(1, { item: { id: 2 } })]);
            list.groupby = '';
            expect(list.getListItemByModel({ id: 2 })).toBe(items[1]);
            expect(list.getListItemByModel({ id: 9 })).toBeNull();
            list.groupby = 'type';
            expect(list.getListItemByModel({ id: 1 })).toBe(items[0]);
            list.groupby = '';
        });

        it('resolves items by index or model', () => {
            const items = useItems([fakeItem(0), fakeItem(1, { item: { id: 2 } })]);
            expect(list.getItemRefByIndexOrModel(1)).toBe(items[1]);
            expect(list.getItemRefByIndexOrModel({ id: 2 })).toBe(items[1]);
            expect(list.getListItemIndex(items[1])).toBe(1);
        });

        it('toggles an item on and off, raising the select event', () => {
            const update = jest.spyOn(list, 'updateSelectedItemsWidgets').mockImplementation(() => undefined);
            const invoke = jest.spyOn(list, 'invokeEventCallback').mockImplementation(() => undefined);
            useItems([]);
            list.multiselect = true;
            list._items = [];
            const item: any = fakeItem(0, { item: { id: 1, _groupIndex: 2 } });
            list.groupby = 'type';

            list.toggleListItemSelection(item, true);
            expect(item.isActive).toBe(true);
            expect(list._items).toEqual([{ id: 1 }]);
            expect(invoke).toHaveBeenCalledWith('select', { widget: item, $data: { id: 1 } });

            list.toggleListItemSelection(item);
            expect(item.isActive).toBe(false);
            expect(list._items).toEqual([]);
            expect(update).toHaveBeenCalledTimes(2);
            list.groupby = '';
        });

        it('clears other items first for single select and skips disabled or missing items', () => {
            jest.spyOn(list, 'updateSelectedItemsWidgets').mockImplementation(() => undefined);
            jest.spyOn(list, 'invokeEventCallback').mockImplementation(() => undefined);
            const clear = jest.spyOn(list, 'clearSelectedItems').mockImplementation(() => undefined);
            list.multiselect = false;
            list.toggleListItemSelection(fakeItem(0));
            expect(clear).toHaveBeenCalled();

            clear.mockClear();
            list.toggleListItemSelection(fakeItem(0, { disableItem: true }));
            list.toggleListItemSelection(undefined);
            expect(clear).not.toHaveBeenCalled();
        });

        it('stores the selected widgets and the state of a single selection', () => {
            const persistence = state();
            persistence.getWidgetState.mockReturnValue({ selectedItem: [{ page: 1, index: 4 }] });
            useItems([fakeItem(0), fakeItem(1, { isActive: true })]);
            list.multiselect = false;
            list.navigation = 'Basic';
            list.dataNavigator = { dn: { currentPage: 1 } };

            list.updateSelectedItemsWidgets();

            expect(list.selectedItemWidgets).toEqual({ w1: { name: 'w1-1' } });
            expect(persistence.removeWidgetState).toHaveBeenCalledWith(list, 'selectedItem');
            expect(persistence.setWidgetState).toHaveBeenCalledWith(list, { selectedItem: [{ page: 1, index: 1 }] });
        });

        it('keeps other pages in the state for multi select lists', () => {
            const persistence = state();
            const widgetState = { selectedItem: [{ page: 2, index: 0 }, { page: 1, index: 0 }] };
            persistence.getWidgetState.mockReturnValue(widgetState);
            useItems([fakeItem(0), fakeItem(1, { isActive: true }), fakeItem(2, { isActive: true })]);
            list.multiselect = true;
            list.selectedItemWidgets = [];
            list._items = [{}, {}];
            list.navigation = 'Basic';
            list.dataNavigator = { dn: { currentPage: 1 } };

            list.updateSelectedItemsWidgets();

            expect(list.selectedItemWidgets).toHaveLength(2);
            expect(widgetState.selectedItem).toEqual([{ page: 2, index: 0 }, { page: 1, index: 1 }, { page: 1, index: 2 }]);
        });

        it('resets the stored state when a single item is picked in a multi select list', () => {
            const persistence = state();
            const widgetState = { selectedItem: [{ page: 2, index: 0 }] };
            persistence.getWidgetState.mockReturnValue(widgetState);
            useItems([fakeItem(0, { isActive: true })]);
            list.multiselect = true;
            list.selectedItemWidgets = [];
            list._items = [{ id: 1 }];
            list.navigation = 'Basic';
            list.dataNavigator = { dn: { currentPage: 1 } };
            list.updateSelectedItemsWidgets();
            expect(persistence.setWidgetState).toHaveBeenCalledWith(list, { selectedItem: [{ page: 1, index: 0 }] });
        });

        it('warns when the state of the navigation type cannot be persisted', () => {
            const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
            const persistence = state();
            persistence.getWidgetState.mockReturnValue({});
            useItems([fakeItem(0, { isActive: true })]);
            list.multiselect = false;
            list.navigation = 'Scroll';
            list.updateSelectedItemsWidgets();
            expect(warn).toHaveBeenCalled();
        });

        it('does not touch the state when persistence is switched off or triggered by the state itself', () => {
            const persistence = state();
            persistence.computeMode.mockReturnValue('NONE');
            useItems([]);
            list.multiselect = false;
            list.updateSelectedItemsWidgets();
            expect(persistence.getWidgetState).not.toHaveBeenCalled();

            persistence.computeMode.mockReturnValue('SESSION');
            persistence.getWidgetState.mockReturnValue({});
            list.updateSelectedItemsWidgets(true);
            expect(persistence.setWidgetState).not.toHaveBeenCalled();
        });
    });

    describe('rendering', () => {
        const render = (items: any[]) => {
            useItems(items);
            const queryList: any = { length: items.length, first: items[0] };
            list.listItems.first = items[0];
            list.listItems.length;
            return queryList;
        };

        beforeEach(() => {
            list.statePersistence = { computeMode: jest.fn().mockReturnValue('NONE'), getWidgetState: jest.fn() };
            jest.spyOn(list, 'invokeEventCallback').mockImplementation(() => undefined);
            list.fieldDefs = [];
            list.selectfirstitem = false;
            list.infScroll = false;
            list.onDemandLoad = false;
        });

        it('raises render only when the data changed and resets the flag', () => {
            const items = [fakeItem(0)];
            list.isDataChanged = true;
            list.onListRender(render(items));
            expect(list.invokeEventCallback).toHaveBeenCalledWith('render', { $data: list.fieldDefs });
            expect(list.isDataChanged).toBe(false);

            (list.invokeEventCallback as jest.Mock).mockClear();
            list.onListRender(render(items));
            expect(list.invokeEventCallback).not.toHaveBeenCalled();
        });

        it('restores the selection of the stored state', () => {
            const select = jest.spyOn(list, 'selectItem').mockImplementation(() => undefined);
            list.statePersistence = {
                computeMode: jest.fn().mockReturnValue('SESSION'),
                getWidgetState: jest.fn().mockReturnValue({ selectedItem: [{ page: 1, index: 0 }, { page: 2, index: 5 }] }),
            };
            list.dataNavigator = { dn: { currentPage: 1 } };
            list.multiselect = true;
            list._selectedItemsExist = true;
            list._items = [];
            list.isDataChanged = true;
            list.onListRender(render([fakeItem(0), fakeItem(1)]));
            expect(select).toHaveBeenCalledTimes(1);
            expect(select).toHaveBeenCalledWith(0, true);
            expect(list._selectedItemsExist).toBe(false);
        });

        it('selects the first item when configured', () => {
            const select = jest.spyOn(list, 'selectItem').mockImplementation(() => undefined);
            jest.spyOn(list, 'clearSelectedItems').mockImplementation(() => undefined);
            jest.spyOn(list, 'setupDataSource').mockImplementation(() => undefined);
            const items = [fakeItem(0), fakeItem(1)];
            list.selectfirstitem = true;
            list.multiselect = false;
            list.isDataChanged = true;
            list._items = [];
            list._selectedItemsExist = undefined;
            list.onListRender(render(items));
            expect(select).toHaveBeenCalledWith(0);
            expect(list.firstSelectedItem).toBe(items[0]);
        });

        it('keeps the current selection of scrolling lists when the first item would be selected', () => {
            const select = jest.spyOn(list, 'selectItem').mockImplementation(() => undefined);
            list.selectfirstitem = true;
            list.infScroll = true;
            list.isDataChanged = true;
            list._items = [{}];
            list._selectedItemsExist = undefined;
            jest.spyOn(list.paginationService, 'bindScrollEvt').mockImplementation(() => undefined);
            list.onListRender(render([fakeItem(0)]));
            expect(select).not.toHaveBeenCalled();
        });

        it('re-marks the selected items that are still rendered', () => {
            const items = [fakeItem(0, { item: { id: 1 } }), fakeItem(1, { item: { id: 2 } })];
            const focus = jest.spyOn(items[1].nativeElement, 'focus');
            list._items = [{ id: 2 }];
            list.multiselect = true;
            list.onListRender(render(items));
            expect(items[0].isActive).toBe(false);
            expect(items[1].isActive).toBe(true);
            expect(list.lastSelectedItem).toBe(items[1]);
            expect(focus).toHaveBeenCalled();
        });

        it('binds the scroll handler of infinite scroll lists and limits the height in modals on mobile', () => {
            jest.useFakeTimers();
            const bind = jest.spyOn(list.paginationService, 'bindScrollEvt').mockImplementation(() => undefined);
            (isMobile as jest.Mock).mockReturnValue(true);
            const modal = document.createElement('div');
            modal.className = 'modal-body';
            modal.appendChild(list.nativeElement);
            document.body.appendChild(modal);
            jest.spyOn($.fn, 'height').mockReturnValue(5000 as any);
            list.fieldDefs = [{}];
            list.infScroll = true;
            list.onListRender(render([fakeItem(0)]));
            jest.advanceTimersByTime(600);
            expect(bind).toHaveBeenCalledWith(list, '> ul', expect.any(Number));
            expect(list.nativeElement.style.height).toBe(`${window.innerHeight - 140}px`);
            jest.restoreAllMocks();
        });

        it('re-renders and detects changes when the item list changes', () => {
            const render$ = jest.spyOn(list, 'onListRender').mockImplementation(() => undefined);
            const detect = jest.spyOn(list.cdRef, 'detectChanges').mockImplementation(() => undefined);
            let emit: any;
            list.listItems = { changes: { subscribe: (fn: any) => { emit = fn; return { unsubscribe: jest.fn() }; } } };
            list.setupHandlers();
            emit('items');
            expect(render$).toHaveBeenCalledWith('items');
            expect(detect).toHaveBeenCalled();
        });

        it('selects the list item that was clicked inside nested lists', () => {
            const trigger = jest.spyOn(list, 'triggerListItemSelection').mockImplementation(() => undefined);
            const ul = list.nativeElement.querySelector('ul.app-livelist-container') as HTMLElement;
            ul.innerHTML = '<li class="app-list-item"><span id="t"></span></li>';
            list.listItems = { changes: { subscribe: () => ({ unsubscribe: jest.fn() }) } };
            list.setupHandlers();
            ul.querySelector('#t')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            expect(trigger).toHaveBeenCalled();
        });
    });

    describe('data set changes', () => {
        beforeEach(() => {
            list.statePersistence = { computeMode: jest.fn().mockReturnValue('SESSION'), getWidgetState: jest.fn() };
            list.dataNavigator = { pageChanged: jest.fn(), setDataSource: jest.fn() };
        });

        it('restores the stored page of static variables on the first load', () => {
            list.datasource = { category: 'wm.Variable' };
            list._pageLoad = true;
            list.dataNavigatorWatched = true;
            list.navigation = 'None';
            list.statePersistence.getWidgetState.mockReturnValue({ pagination: 3, selectedItem: [{}] });
            list.onDataSetChange([1]);
            expect(list.dataNavigator.pageChanged).toHaveBeenCalledWith({ page: 3 }, true);
            expect(list._selectedItemsExist).toBe(true);
        });

        it('restores page size and page together when page size change is allowed', () => {
            list.datasource = { category: 'wm.Variable' };
            list._pageLoad = true;
            list.allowpagesizechange = true;
            list.dataNavigatorWatched = true;
            list.navigation = 'None';
            list.statePersistence.getWidgetState.mockReturnValue({ pagesize: 20 });
            list.onDataSetChange([1]);
            expect(list.dataNavigator.pageChanged).toHaveBeenCalledWith({ page: 1, pagesize: 20 }, true);
        });

        it('sets up the data source of the navigator when navigation is on', () => {
            const setup = jest.spyOn(list, 'setupDataSource').mockImplementation(() => undefined);
            list.dataNavigatorWatched = false;
            list.navigation = 'Basic';
            list.onDataSetChange([1]);
            expect(setup).toHaveBeenCalled();
        });

        it('processes the data directly without navigation', () => {
            const change = jest.spyOn(list, 'onDataChange').mockImplementation(() => undefined);
            list.dataNavigatorWatched = false;
            list.navigation = 'None';
            list.onDataSetChange([1]);
            expect(change).toHaveBeenCalledWith([1]);
        });

        it('hands a changed data source to an already set up navigator', () => {
            list.dataNavigatorWatched = true;
            list.navigation = 'Basic';
            list.datasource = { category: 'wm.ServiceVariable' };
            list.onDataSetChange([1]);
            expect(list.dataNavigator.setDataSource).toHaveBeenCalledWith(list.datasource);
        });
    });

    describe('reordering', () => {
        const ui = (index = 1) => ({ placeholder: { height: jest.fn() }, item: { height: () => 30, index: () => index }, offset: { top: 100 } });

        beforeEach(() => {
            list.$ulEle = $('<ul></ul>');
        });

        it('sizes the placeholder and remembers the dragged index', () => {
            const dragUi = ui(2);
            list.onReorderStart({}, dragUi);
            expect(dragUi.placeholder.height).toHaveBeenCalledWith(30);
            expect(list.$ulEle.data('oldIndex')).toBe(2);
        });

        it('loads the next items when dragging past the last item of an infinite scroll list', () => {
            list.infScroll = true;
            list.fieldDefs = [{}, {}];
            const bind = jest.spyOn(list.paginationService, 'bindScrollEvt').mockImplementation(() => undefined);
            list.debouncedFetchNextDatasetOnScroll = jest.fn();
            jest.spyOn(list.$ulEle, 'find').mockReturnValue({ offset: () => ({ top: 10 }) } as any);
            list.onSort({}, ui());
            expect(bind).toHaveBeenCalled();
            expect(list.debouncedFetchNextDatasetOnScroll).toHaveBeenCalled();

            bind.mockClear();
            list.infScroll = false;
            list.onSort({}, ui());
            expect(bind).not.toHaveBeenCalled();
        });

        it('moves the dragged item in the data and raises reorder', () => {
            const invoke = jest.spyOn(list, 'invokeEventCallback').mockImplementation(() => undefined);
            jest.spyOn(list.cdRef, 'detectChanges').mockImplementation(() => undefined);
            list.statePersistence = { computeMode: jest.fn().mockReturnValue('SESSION'), removeWidgetState: jest.fn() };
            list.fieldDefs = ['a', 'b', 'c'];
            list.reorderProps = { minIndex: null, maxIndex: null };
            list.$ulEle.data('oldIndex', 0);

            list.onUpdate('evt', ui(2));

            expect(list.fieldDefs).toEqual(['b', 'c', 'a']);
            expect(list.statePersistence.removeWidgetState).toHaveBeenCalledWith(list, 'selectedItem');
            expect(list.reorderProps).toEqual({ minIndex: 0, maxIndex: 2 });
            expect(invoke).toHaveBeenCalledWith('reorder', { $event: 'evt', $data: list.fieldDefs, $changedItem: { oldIndex: 0, newIndex: 2, item: 'a' } });
            expect(list.$ulEle.data('oldIndex')).toBeUndefined();
        });

        it('supports keyboard reordering with an explicit index', () => {
            jest.spyOn(list, 'invokeEventCallback').mockImplementation(() => undefined);
            jest.spyOn(list.cdRef, 'detectChanges').mockImplementation(() => undefined);
            list.statePersistence = { computeMode: jest.fn().mockReturnValue('NONE') };
            list.fieldDefs = ['a', 'b', 'c'];
            list.reorderProps = { minIndex: 5, maxIndex: 1 };
            list.$ulEle.data('oldIndex', 2);
            list.onUpdate(undefined, undefined, 0);
            expect(list.fieldDefs).toEqual(['c', 'a', 'b']);
            expect(list.reorderProps).toEqual({ minIndex: 0, maxIndex: 2 });
        });

        it('leaves the data alone when nothing was dragged', () => {
            const invoke = jest.spyOn(list, 'invokeEventCallback').mockImplementation(() => undefined);
            list.fieldDefs = [];
            list.$ulEle.data('oldIndex', 0);
            list.onUpdate('evt', ui(1));
            expect(invoke).not.toHaveBeenCalled();
        });

        it('configures drag and drop on the list container', () => {
            const droppable = jest.fn();
            const ulEle: any = { droppable };
            jest.spyOn($.fn, 'find').mockReturnValue(ulEle);
            list.configureDnD();
            jest.restoreAllMocks();
            expect((baseLib as any).configureDnD).toHaveBeenCalled();
            expect(droppable).toHaveBeenCalledWith({ accept: '.app-list-item' });
        });
    });

    describe('misc helpers', () => {
        it('refreshes the data source when pull to refresh fires without a custom handler', () => {
            let handler: any;
            jest.spyOn(list.app, 'subscribe').mockImplementation((_name: any, fn: any) => { handler = fn; return () => undefined; });
            list._listenerDestroyers = [];
            list.subscribeToPullToRefresh();
            list.datasource = { listRecords: jest.fn() };
            handler();
            expect(list.datasource.listRecords).toHaveBeenCalled();
            list.datasource = {};
            expect(() => handler()).not.toThrow();
            expect(list._listenerDestroyers.length).toBe(1);
        });

        it('creates an item when the add action is clicked', () => {
            const add = document.createElement('button');
            add.className = 'add-list-item';
            document.body.appendChild(add);
            const create = jest.spyOn(list, 'create').mockImplementation(() => undefined);
            list.setUpCUDHandlers();
            add.click();
            expect(create).toHaveBeenCalled();
            add.remove();
        });

        it('does nothing without an add action', () => {
            expect(() => list.setUpCUDHandlers()).not.toThrow();
        });

        it('raises the pagination change event', () => {
            const invoke = jest.spyOn(list, 'invokeEventCallback').mockImplementation(() => undefined);
            list.beforePaginationChange('evt', 3);
            expect(invoke).toHaveBeenCalledWith('paginationchange', { $event: 'evt', $index: 3 });
        });

        it('reads the item attributes of the host', () => {
            list.nativeElement.setAttribute('itemattrs', '{"a":"1"}');
            list._readItemAttrsFromHost();
            expect(list.itemAttrsMap).toEqual({ a: '1' });

            list.nativeElement.setAttribute('itemattrs', '{broken');
            const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
            list._readItemAttrsFromHost();
            expect(list.itemAttrsMap).toEqual({});
            expect(warn).toHaveBeenCalled();

            list.nativeElement.removeAttribute('itemattrs');
            list.itemAttrsMap = { stale: true };
            list._readItemAttrsFromHost();
            expect(list.itemAttrsMap).toEqual({});
        });
    });
});
