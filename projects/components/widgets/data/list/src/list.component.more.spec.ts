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
        <div wmList template="true" itemsperrow="xs-1 sm-1 md-1 lg-1" class="media-list" name="moreList"
             dataset.bind="testdata" navigation="Basic">
            <ng-template #listTemplate let-item="item" let-$index="$index" let-itemRef="itemRef" let-$first="$first" let-$last="$last" let-currentItemWidgets="currentItemWidgets">
                <label wmLabel name="Name" class="p media-heading" caption.bind="item.name"></label>
            </ng-template>
        </div>
    `,
})
class MoreListWrapperComponent {
    @ViewChild(ListComponent, { static: true }) listComponent: ListComponent;
    public testdata: any = [{ name: 'Peter', age: 21 }, { name: 'Tony', age: 42 }];

    constructor(_pipeProvider: PipeProvider) {
        setPipeProvider(_pipeProvider);
    }
}

const handlers: any = {};
const moreApp = { ...mockApp, subscribe: (name: string, cb: any) => { handlers[name] = cb; return () => undefined; } };

describe('ListComponent - more behaviour', () => {
    let fixture: ComponentFixture<MoreListWrapperComponent>;
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
            reset: jest.fn(),
            setDirty: jest.fn(),
        };
        return items;
    };

    const keyEvent = (target: any = document.createElement('div')) => ({ stopPropagation: jest.fn(), preventDefault: jest.fn(), keyCode: 40, target });

    beforeEach(waitForAsync(() => {
        TestBed.configureTestingModule({
            imports: [FormsModule, PaginationModule, WmPaginationModule, ListComponent, ListItemDirective],
            declarations: [MoreListWrapperComponent],
            providers: [
                { provide: App, useValue: moreApp },
                { provide: ToDatePipe, useClass: ToDatePipe },
                { provide: AppDefaults, useClass: AppDefaults },
                { provide: AbstractI18nService, useClass: MockAbstractI18nService },
                { provide: DatePipe, useValue: DatePipe },
                TextContentDirective,
            ],
        }).compileComponents();
        fixture = TestBed.createComponent(MoreListWrapperComponent);
        list = fixture.componentInstance.listComponent;
        fixture.detectChanges();
    }));

    afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
        (isMobile as jest.Mock).mockReturnValue(false);
        fixture?.destroy();
    });

    describe('app subscriptions', () => {
        it('applies persisted state only for the list bound variable', () => {
            const apply = jest.spyOn(list, 'handleStateParams').mockImplementation(() => undefined);
            list.datasource = { name: 'svVar' };
            handlers['check-state-persistence-options']({ variable: { name: 'other' } });
            expect(apply).not.toHaveBeenCalled();
            handlers['check-state-persistence-options']({ variable: { name: 'svVar' } });
            expect(apply).toHaveBeenCalledTimes(1);
        });

        it('falls back to the bound datasource name when the datasource is not resolved yet (prefabs)', () => {
            const apply = jest.spyOn(list, 'handleStateParams').mockImplementation(() => undefined);
            list.datasource = undefined;
            list.binddatasource = 'Variables.prefabVar';
            handlers['check-state-persistence-options']({ variable: { name: 'prefabVar' } });
            expect(apply).toHaveBeenCalledTimes(1);
        });

        it('marks the list dependent only for its own cud listener', () => {
            list._isDependent = false;
            handlers['setup-cud-listener']('someOtherList');
            expect(list._isDependent).toBe(false);
            handlers['setup-cud-listener']('moreList');
            expect(list._isDependent).toBe(true);
        });
    });

    it('exposes the updated page size', () => {
        list.updatedPageSize = 35;
        expect(list.getUpdatedPageSize()).toBe(35);
    });

    describe('keyboard handling', () => {
        beforeEach(() => {
            list.statePersistence = { removeWidgetState: jest.fn(), computeMode: jest.fn().mockReturnValue('SESSION') };
        });

        it('raises selectionlimitexceed when extending the selection upwards past the limit', () => {
            const items = useItems([fakeItem(0), fakeItem(1), fakeItem(2)]);
            const invoke = jest.spyOn(list, 'invokeEventCallback').mockImplementation(() => undefined);
            list.multiselect = true;
            list.selectionlimit = 1;
            list._items = [{ a: 1 }];
            list.firstSelectedItem = items[2];
            list.lastSelectedItem = items[1];
            const evt = keyEvent();
            list.handleKeyDown(evt, 'selectPrev');
            expect(invoke).toHaveBeenCalledWith('selectionlimitexceed', { $event: evt });
            expect(list.lastSelectedItem).toBe(items[1]);
        });

        it('swaps the item with the next one when keyboard moving is enabled', () => {
            const items = useItems([fakeItem(0), fakeItem(1), fakeItem(2)]);
            const ul = document.createElement('ul');
            items.forEach((i: any) => ul.appendChild(i.nativeElement));
            list.isListElementMovable = true;
            const [first, second, third] = items;
            list.lastSelectedItem = first;
            list.handleKeyDown(keyEvent(), 'focusNext');
            expect(ul.children[1]).toBe(first.nativeElement);
            expect(list.listItems.reset).toHaveBeenCalledWith([second, first, third]);
            expect(list.currentIndex).toBe(2);
            expect(list.ariaText).toBe('selected ');
            expect(list.statePersistence.removeWidgetState).toHaveBeenCalledWith(list, 'selectedItem');
        });

        it('does not move the last item further down', () => {
            const items = useItems([fakeItem(0), fakeItem(1)]);
            list.isListElementMovable = true;
            list.lastSelectedItem = items[1];
            list.handleKeyDown(keyEvent(), 'focusNext');
            expect(list.listItems.reset).not.toHaveBeenCalled();
        });

        it('moves the focus to the next item without moving it, staying on the last item', () => {
            const items = useItems([fakeItem(0), fakeItem(1)]);
            list.isListElementMovable = false;
            list.lastSelectedItem = items[0];
            const focus = jest.spyOn(items[1].nativeElement, 'focus');
            list.handleKeyDown(keyEvent(), 'focusNext');
            expect(list.lastSelectedItem).toBe(items[1]);
            expect(list.currentIndex).toBe(2);
            expect(focus).toHaveBeenCalled();
            list.handleKeyDown(keyEvent(), 'focusNext');
            expect(list.lastSelectedItem).toBe(items[1]);
        });

        it('selects the item the enter key was pressed on when nothing was selected before', () => {
            useItems([fakeItem(0), fakeItem(1)]);
            const click = jest.spyOn(list, 'onItemClick').mockImplementation(() => undefined);
            list.lastSelectedItem = undefined;
            const ul = document.createElement('ul');
            ul.className = 'app-livelist-container';
            ul.innerHTML = '<li class="app-list-item"></li><li class="app-list-item"><span id="inner"></span></li>';
            const evt = keyEvent(ul.querySelector('#inner'));
            evt.keyCode = 13;
            list.handleKeyDown(evt, 'select');
            expect(evt.preventDefault).not.toHaveBeenCalled();
            expect(click).toHaveBeenCalledWith(evt, list.listItems.toArray()[1]);
        });
    });

    describe('view init and teardown', () => {
        const settle = async () => { await list.propsInitPromise; await Promise.resolve(); };

        it('wires reordering aria attributes and the dnd configuration', async () => {
            const dnd = jest.spyOn(list, 'configureDnD').mockImplementation(() => undefined);
            list.enablereorder = true;
            list.groupby = '';
            list.ngAfterViewInit();
            await settle();
            const ul = list.nativeElement.querySelector('ul.app-livelist-container');
            expect(dnd).toHaveBeenCalled();
            expect(ul.getAttribute('aria-describedby')).toBe(list.titleId);
        });

        it('removes the aria description when reordering is off and sets up collapsible headers', async () => {
            const ul = list.nativeElement.querySelector('ul.app-livelist-container');
            ul.setAttribute('aria-describedby', 'x');
            list.enablereorder = false;
            list.groupby = 'type';
            list.collapsible = true;
            list.ngAfterViewInit();
            await settle();
            expect(ul.hasAttribute('aria-describedby')).toBe(false);
            expect(typeof list.handleHeaderClick).toBe('function');
            expect(typeof list.toggleAllHeaders).toBe('function');
            list.groupby = '';
            list.collapsible = false;
        });

        it('flags the next load as a page load again when detached', () => {
            list._pageLoad = false;
            list.ngOnDetach();
            expect(list._pageLoad).toBe(true);
        });

        it('releases the animator subscription and the add item listener on destroy', () => {
            const unsubscribe = jest.fn();
            list._listAnimator = { $btnSubscription: { unsubscribe } };
            const add = document.createElement('button');
            add.className = 'add-list-item';
            document.body.appendChild(add);
            const handler = jest.fn();
            add.addEventListener('click', handler);
            list.boundAddItemHandler = handler;
            const remove = jest.spyOn(add, 'removeEventListener');
            list.ngOnDestroy();
            expect(unsubscribe).toHaveBeenCalled();
            expect(list._listAnimator).toBeNull();
            expect(remove).toHaveBeenCalledWith('click', handler);
            expect(list.boundAddItemHandler).toBeNull();
            add.remove();
        });
    });

    describe('item events', () => {
        const attach = (ctx: any) => {
            const ul = list.nativeElement.querySelector('ul.app-livelist-container');
            ul.innerHTML = '<li class="app-list-item"><span id="in"></span></li>';
            $(ul.querySelector('li')).data('listItemContext', ctx);
            return ul.querySelector('#in') as HTMLElement;
        };

        it('invokes the click callback with the list as widget and the clicked item', () => {
            const invoke = jest.spyOn(list, 'invokeEventCallback').mockImplementation(() => undefined);
            const inner = attach({ item: { id: 1 } });
            list.handleEvent(list.nativeElement, 'click', jest.fn(), {});
            const evt = new MouseEvent('click', { bubbles: true });
            inner.dispatchEvent(evt);
            expect(invoke).toHaveBeenCalledWith('click', { widget: list.widget, $event: evt, item: { id: 1 } });
        });

        it('does not invoke the click callback for clicks outside a list item', () => {
            const invoke = jest.spyOn(list, 'invokeEventCallback').mockImplementation(() => undefined);
            attach({ item: {} });
            list.handleEvent(list.nativeElement, 'click', jest.fn(), {});
            list.nativeElement.querySelector('ul.app-livelist-container').dispatchEvent(new MouseEvent('click', { bubbles: true }));
            expect(invoke).not.toHaveBeenCalled();
        });

        it('maps tap to click', () => {
            const invoke = jest.spyOn(list, 'invokeEventCallback').mockImplementation(() => undefined);
            const inner = attach({ item: {} });
            list.handleEvent(list.nativeElement, 'tap', jest.fn(), {});
            inner.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            expect(invoke).toHaveBeenCalledWith('tap', expect.objectContaining({ widget: list.widget }));
        });

        it('resolves the owning list item of a click inside a nested list item', () => {
            const trigger = jest.spyOn(list, 'triggerListItemSelection').mockImplementation(() => undefined);
            list.listItems = { changes: { subscribe: () => ({ unsubscribe: jest.fn() }) } };
            const ul = list.nativeElement.querySelector('ul.app-livelist-container') as HTMLElement;
            ul.innerHTML = '<li class="app-list-item" id="outer"><ul class="app-livelist-container"><li class="app-list-item"><span id="deep"></span></li></ul></li>';
            list.setupHandlers();
            ul.querySelector('#deep')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            const target = trigger.mock.calls[0][0] as JQuery<HTMLElement>;
            expect(target.get(0)!.id).toBe('outer');
        });
    });

    describe('data handling', () => {
        it('renders the first page when persisted state asks for a later page on an app level datasource', () => {
            jest.spyOn(list, 'invokeEventCallback').mockImplementation(() => undefined);
            const update = jest.spyOn(list, 'updateFieldDefs').mockImplementation(() => undefined);
            list.infScroll = true;
            list.currentPage = 0;
            list.datasource = {
                owner: 'App',
                execute: jest.fn((op: any) => {
                    if (op === DataSource.Operation.GET_PAGING_OPTIONS) return { number: 2 };
                    if (op === DataSource.Operation.LIST_RECORDS) return [{ id: 'page1' }];
                    return false;
                }),
            };
            list.onDataChange([{ id: 'page2' }]);
            expect(list.datasource.execute).toHaveBeenCalledWith(DataSource.Operation.LIST_RECORDS, { page: 1 });
            expect(update).toHaveBeenCalledWith([{ id: 'page1' }]);
        });

        it('wires the navigator results and page size into the list', () => {
            const resultUnsub = jest.fn();
            const maxUnsub = jest.fn();
            list.navigatorResultWatch = { unsubscribe: resultUnsub };
            list.navigatorMaxResultWatch = { unsubscribe: maxUnsub };
            let onResult: any;
            let onMax: any;
            const setBindDataSet = jest.fn();
            list.dataNavigator = {
                options: null,
                resultEmitter: { subscribe: (fn: any) => { onResult = fn; return { unsubscribe: jest.fn() }; } },
                maxResultsEmitter: { subscribe: (fn: any) => { onMax = fn; return { unsubscribe: jest.fn() }; } },
                setBindDataSet,
            };
            list.pagesize = 5;
            const change = jest.spyOn(list, 'onDataChange').mockImplementation(() => undefined);
            list.setupDataSource.mockRestore?.();
            Object.getPrototypeOf(list).setupDataSource.call(list);
            expect(resultUnsub).toHaveBeenCalled();
            expect(maxUnsub).toHaveBeenCalled();
            expect(list.dataNavigator.options).toEqual({ maxResults: 5 });
            expect(list.dataNavigator.maxResults).toBe(5);
            expect(list.dataNavigatorWatched).toBe(true);
            onResult([1]);
            expect(change).toHaveBeenCalledWith([1]);
            onMax(12);
            expect(list.pagesize).toBe(12);
            expect(setBindDataSet).toHaveBeenCalled();
        });
    });

    describe('configureDnD', () => {
        it('appends the dragged item to the parent when the list has a height', () => {
            jest.spyOn(list, 'getAttr').mockImplementation((n: any) => (n === 'height' ? '200px' : undefined));
            jest.spyOn($.fn, 'droppable' as any).mockReturnThis();
            list.configureDnD();
            expect(baseLib.configureDnD).toHaveBeenLastCalledWith(expect.anything(), { appendTo: 'parent' }, expect.any(Function), expect.any(Function), expect.any(Function));
        });

        it('appends to the last open modal, or the body by default', () => {
            jest.spyOn(list, 'getAttr').mockReturnValue(undefined);
            jest.spyOn($.fn, 'droppable' as any).mockReturnThis();
            const modal = document.createElement('div');
            modal.className = 'modal';
            document.body.appendChild(modal);
            list.configureDnD();
            expect((baseLib.configureDnD as jest.Mock).mock.calls.pop()[1].appendTo).toBe(modal);
            modal.remove();
            list.configureDnD();
            expect((baseLib.configureDnD as jest.Mock).mock.calls.pop()[1].appendTo).toBe('body');
        });
    });
});
