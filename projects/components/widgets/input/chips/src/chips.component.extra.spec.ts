import { ComponentFixture } from '@angular/core/testing';
import { Component, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TypeaheadModule } from 'ngx-bootstrap/typeahead';
import { DatePipe } from '@angular/common';
import { $unwatch, $watch, AbstractI18nService, App, AppDefaults, isAppleProduct, PartialRefProvider } from '@wm/core';
import { TextContentDirective, ToDatePipe } from '@wm/components/base';
import { SearchComponent } from '@wm/components/basic/search';
import { ITestModuleDef } from '../../../../base/src/test/common-widget.specs';
import { compileTestComponent, mockApp } from '../../../../base/src/test/util/component-test-util';
import { MockAbstractI18nService } from '../../../../base/src/test/util/date-test-util';
import { ChipsComponent } from './chips.component';

jest.mock('@wm/core', () => ({
    ...jest.requireActual('@wm/core'),
    isAppleProduct: jest.fn(),
    $unwatch: jest.fn(),
    $watch: jest.fn(() => jest.fn()),
}));

@Component({
    standalone: false,
    template: '<ul wmChips name="extraChips" readonly="false" show="true" tabindex="0"></ul>',
})
class ExtraChipsWrapperComponent {
    @ViewChild(ChipsComponent, { static: true }) wmComponent: ChipsComponent;
}

const moduleDef: ITestModuleDef = {
    imports: [FormsModule, TypeaheadModule, ChipsComponent, SearchComponent],
    declarations: [ExtraChipsWrapperComponent],
    providers: [
        { provide: App, useValue: mockApp },
        { provide: ToDatePipe, useClass: ToDatePipe },
        { provide: DatePipe, useClass: DatePipe },
        { provide: AppDefaults, useClass: AppDefaults },
        { provide: PartialRefProvider, useClass: PartialRefProvider },
        { provide: AbstractI18nService, useClass: MockAbstractI18nService },
        TextContentDirective,
    ],
};

describe('ChipsComponent - extra behaviour', () => {
    let fixture: ComponentFixture<ExtraChipsWrapperComponent>;
    let chips: any;
    let invoke: jest.SpyInstance;

    const chip = (value: any, extra: any = {}) => ({ key: value, value, label: String(value), ...extra });

    beforeEach(() => {
        fixture = compileTestComponent(moduleDef, ExtraChipsWrapperComponent);
        chips = fixture.componentInstance.wmComponent;
        fixture.detectChanges();
        invoke = jest.spyOn(chips, 'invokeEventCallback').mockImplementation(() => undefined);
        jest.spyOn(chips.searchComponent, 'clearSearch').mockImplementation(() => undefined);
        (chips.searchComponent as any).query = '';
        ($watch as jest.Mock).mockClear();
        ($unwatch as jest.Mock).mockClear();
    });

    afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
        document.body.innerHTML = '';
    });

    describe('chip classes', () => {
        it('only registers a class watcher when the class is bound', () => {
            chips.bindChipclass = undefined;
            chips.registerChipItemClass(chip('a'), 0);
            expect($watch).not.toHaveBeenCalled();
        });

        it('watches the class expression of each chip and applies the result', () => {
            chips.bindChipclass = "{'active': item.value == 'a'}";
            chips.widgetId = 'wid';
            jest.spyOn(chips, 'registerDestroyListener').mockImplementation(() => undefined);
            const apply = jest.spyOn(chips, 'applyItemClass').mockImplementation(() => undefined);
            chips.registerChipItemClass(chip('a'), 2);
            expect($unwatch).toHaveBeenCalledWith('wid_chipItemClass_2');
            expect(($watch as jest.Mock).mock.calls[0][0]).toBe(chips.bindChipclass);
            ($watch as jest.Mock).mock.calls[0][3]({ active: true }, { old: true });
            expect(apply).toHaveBeenCalledWith({ toAdd: ['active'], toRemove: ['old'] }, 2);
        });

        it('applies the classes to the rendered chip', () => {
            chips.nativeElement.innerHTML = '<li class="chip-item old"></li><li class="chip-item"></li>';
            chips.applyItemClass({ toAdd: ['new'], toRemove: ['old'] }, 0);
            const first = chips.nativeElement.querySelectorAll('.chip-item')[0];
            expect(first.classList.contains('new')).toBe(true);
            expect(first.classList.contains('old')).toBe(false);
        });

        it('retries once when the chip is not rendered yet', () => {
            jest.useFakeTimers();
            chips.nativeElement.innerHTML = '';
            chips.applyItemClass({ toAdd: ['new'], toRemove: [] }, 0);
            chips.nativeElement.innerHTML = '<li class="chip-item"></li>';
            jest.advanceTimersByTime(60);
            expect(chips.nativeElement.querySelector('.chip-item').classList.contains('new')).toBe(true);
            chips.nativeElement.innerHTML = '';
            expect(() => { chips.applyItemClass({ toAdd: ['x'], toRemove: [] }, 3); jest.advanceTimersByTime(60); }).not.toThrow();
        });

        it('removes duplicate chips', () => {
            chips.datafield = 'name';
            chips.displayfield = 'name';
            chips.chipsList = [{ key: 'a', value: 'a', label: 'a' }, { key: 'a', value: 'a', label: 'a' }, { key: 'b', value: 'b', label: 'b' }];
            chips.removeDuplicates();
            expect(chips.chipsList.map((c: any) => c.key)).toEqual(['a', 'b']);
        });
    });

    describe('datasource and model', () => {
        it('passes the data source to the search component and refreshes the model', () => {
            const update = jest.fn();
            chips._debounceUpdateQueryModel = update;
            chips.datavalue = ['a'];
            chips.datasource = { id: 1 };
            expect(chips.searchComponent.datasource).toEqual({ id: 1 });
            expect(update).toHaveBeenCalledWith(['a']);
            expect(chips.datasource).toEqual({ id: 1 });
            chips._debounceUpdateQueryModel = null;
            expect(() => { chips.datasource = undefined; }).not.toThrow();
        });

        it('clears the chips for an empty value', async () => {
            chips.chipsList = [chip('a')];
            await chips.updateQueryModel(undefined);
            expect(chips.chipsList).toEqual([]);
        });

        it('uses the dataset items that match the values', async () => {
            chips.datasetItems = [chip('a'), chip('b'), chip({ id: 1 })];
            chips.datafield = 'name';
            await chips.updateQueryModel(['a', 'b']);
            expect(chips.chipsList.map((c: any) => c.value)).toEqual(['a', 'b']);
            expect(chips._modelByValue).toEqual(['a', 'b']);
            chips.datafield = 'All Fields';
            await chips.updateQueryModel([{ id: 1 }]);
            expect(chips.chipsList[0].value).toEqual({ id: 1 });
        });

        it('trims the model to the maximum size', async () => {
            chips.datasetItems = [chip('a'), chip('b'), chip('c')];
            chips.datafield = 'name';
            chips.maxsize = 2;
            await chips.updateQueryModel(['a', 'b', 'c']);
            expect(chips.chipsList).toHaveLength(2);
            expect(chips._modelByValue).toEqual(['a', 'b']);
            expect(chips.saturate).toBe(true);
        });

        it('queries the data source for unknown values and adds custom chips for the ones it did not find', async () => {
            chips.datasetItems = [];
            chips.datafield = 'name';
            chips.allowonlyselect = false;
            jest.spyOn(chips, 'getDefaultModel').mockResolvedValue([chip('found')]);
            chips.getTransformedData = (val: any) => [chip(val)];
            await chips.updateQueryModel(['found', 'custom']);
            expect(chips.chipsList.map((c: any) => c.value)).toEqual(['found', 'custom']);
            expect(chips.chipsList[1].iscustom).toBe(true);
        });

        it('drops unknown values when only existing items may be chosen', async () => {
            chips.datasetItems = [];
            chips.datafield = 'name';
            chips.allowonlyselect = true;
            jest.spyOn(chips, 'getDefaultModel').mockResolvedValue([chip('found')]);
            const data = ['found', 'ghost'];
            await chips.updateQueryModel(data);
            expect(chips.chipsList.map((c: any) => c.value)).toEqual(['found']);
            expect(data).toEqual(['found']);
        });

        it('creates custom chips for plain values and keeps objects when all fields are used', async () => {
            chips.datasetItems = [];
            chips.datafield = 'All Fields';
            chips.displayfield = 'name';
            chips.getTransformedData = (val: any, isCustom: boolean) => [{ ...chip(val), custom: isCustom }];
            chips.chipsList = [];
            const data: any[] = ['plain', { name: 'obj' }];
            await chips.updateQueryModel(data);
            expect(chips.chipsList).toHaveLength(2);
            expect(chips.chipsList[0].iscustom).toBe(true);
            expect(data[0]).toEqual({ name: 'plain' });
            expect(chips.chipsList[1].iscustom).toBeUndefined();
        });

        it('keeps the custom flag of objects that were custom before', async () => {
            chips.datasetItems = [];
            chips.datafield = 'All Fields';
            const value = { name: 'obj' };
            chips.getTransformedData = (val: any, isCustom: boolean) => [chip(val)];
            chips.chipsList = [{ value, iscustom: true }];
            await chips.updateQueryModel([value]);
            expect(chips.chipsList[0].iscustom).toBe(true);
        });

        it('builds custom data models from the display field or data field', () => {
            chips.displayfield = 'name';
            expect(chips.createCustomDataModel('x')).toEqual({ name: 'x' });
            chips.displayfield = undefined;
            chips.datafield = 'code';
            expect(chips.createCustomDataModel('x')).toEqual({ code: 'x' });
            chips.datafield = 'All Fields';
            expect(chips.createCustomDataModel('x')).toBeUndefined();
        });

        it('resets the search model without reacting to the value change', () => {
            chips.minchars = 0;
            chips.resetSearchModel();
            expect(chips.searchComponent.clearSearch).toHaveBeenCalledWith(undefined, true);
            expect(chips._unsubscribeDv).toBe(false);
            chips.resetSearchModel(true);
            expect(chips.searchComponent.clearSearch).toHaveBeenLastCalledWith(undefined, false);
        });

        it('detects duplicates by key or by value for all fields', () => {
            chips.datafield = 'name';
            chips.chipsList = [chip('a')];
            expect(chips.isDuplicate(chip('a'))).toBe(true);
            expect(chips.isDuplicate(chip('b'))).toBe(false);
            chips.datafield = 'All Fields';
            chips.chipsList = [chip({ id: 1 })];
            expect(chips.isDuplicate(chip({ id: 1 }))).toBe(true);
        });

        it('flags the chips list as saturated at the maximum size', () => {
            chips.maxsize = 2;
            chips.chipsList = [chip('a'), chip('b')];
            chips.updateMaxSize();
            expect(chips.saturate).toBe(true);
            chips.chipsList = [chip('a')];
            chips.updateMaxSize();
            expect(chips.saturate).toBe(false);
        });
    });

    describe('adding chips', () => {
        beforeEach(() => {
            chips.datafield = 'name';
            chips.chipsList = [];
            chips._modelByValue = [];
            jest.spyOn(chips, 'invokeOnChange').mockImplementation(() => undefined);
            jest.spyOn(chips, 'invokeOnTouched').mockImplementation(() => undefined);
            chips.getTransformedData = (val: any) => [chip(val)];
        });

        it('adds a selected suggestion', () => {
            const search: any = { datavalue: 'x', queryModel: chip('x'), query: 'x' };
            chips.addItem({ key: 'a' }, search);
            expect(chips.chipsList.map((c: any) => c.value)).toEqual(['x']);
            expect(chips._modelByValue).toEqual(['x']);
            expect(invoke).toHaveBeenCalledWith('add', expect.objectContaining({ $item: expect.objectContaining({ value: 'x' }) }));
            expect(chips.invokeOnChange).toHaveBeenCalled();
        });

        it('ignores an empty query', () => {
            chips.addItem({}, { datavalue: 'x', queryModel: chip('x'), query: '  ' } as any);
            expect(chips.chipsList).toEqual([]);
        });

        it('appends to the existing value', () => {
            chips.datavalue = ['a'];
            chips._modelByValue = ['a'];
            chips.addItem({}, { datavalue: 'b', queryModel: chip('b'), query: 'b' } as any);
            expect(chips._modelByValue).toEqual(['a', 'b']);
        });

        it('adds a typed custom value unless only selections are allowed', () => {
            chips.searchComponent.query = ' typed ';
            chips.allowonlyselect = true;
            chips.addItem({}, undefined);
            expect(chips.chipsList).toEqual([]);
            chips.allowonlyselect = false;
            chips.addItem({}, undefined);
            expect(chips.chipsList[0].iscustom).toBe(true);
            expect(chips.chipsList[0].value).toBe('typed');
        });

        it('builds custom objects for all fields and stops for empty ones', () => {
            chips.datafield = 'All Fields';
            chips.displayfield = 'name';
            chips.getTransformedData = (val: any) => [chip(val)];
            chips.searchComponent.query = 'typed';
            chips.addItem({}, undefined);
            expect(chips.chipsList[0].value).toEqual({ name: 'typed' });

            chips.chipsList = [];
            chips.displayfield = undefined;
            const reset = jest.spyOn(chips, 'resetSearchModel').mockImplementation(() => undefined);
            chips.searchComponent.query = 'typed';
            chips.addItem({}, undefined);
            expect(reset).toHaveBeenCalled();
            expect(chips.chipsList).toEqual([]);
        });

        it('does nothing when there is nothing to add', () => {
            chips.searchComponent.query = '   ';
            chips.addItem({}, undefined);
            expect(chips.chipsList).toEqual([]);
            expect(invoke).not.toHaveBeenCalledWith('add', expect.anything());
        });

        it('respects a beforeadd handler that rejects the chip', () => {
            invoke.mockImplementation((name: string) => (name === 'beforeadd' ? false : undefined));
            chips.searchComponent.query = 'typed';
            chips.addItem({}, undefined);
            expect(chips.chipsList).toEqual([]);
        });

        it('does not add duplicates', () => {
            chips.chipsList = [chip('typed')];
            const reset = jest.spyOn(chips, 'resetSearchModel').mockImplementation(() => undefined);
            chips.searchComponent.query = 'typed';
            chips.addItem({}, undefined);
            expect(chips.chipsList).toHaveLength(1);
            expect(reset).toHaveBeenCalled();
        });

        it('stops the enter key from submitting a form', () => {
            const stop = jest.spyOn(chips, 'stopEvent').mockImplementation(() => undefined);
            chips.searchComponent.query = 'typed';
            chips.addItem({ key: 'Enter' }, undefined);
            expect(stop).toHaveBeenCalled();
        });

        it('only stops events that carry input', () => {
            const event: any = { target: { value: 'x' }, stopPropagation: jest.fn(), preventDefault: jest.fn() };
            chips.stopEvent(event);
            expect(event.stopPropagation).toHaveBeenCalled();
            const empty: any = { target: { value: '  ' }, stopPropagation: jest.fn(), preventDefault: jest.fn() };
            chips.stopEvent(empty);
            expect(empty.stopPropagation).not.toHaveBeenCalled();
            expect(() => chips.stopEvent({ target: undefined, stopPropagation: jest.fn(), preventDefault: jest.fn() } as any)).not.toThrow();
        });
    });

    describe('keyboard and focus', () => {
        const render = () => {
            chips.nativeElement.innerHTML = '<ul><li class="chip-item"><a class="app-chip" tabindex="0"></a></li><li class="chip-item"><a class="app-chip" tabindex="0"></a></li><li class="app-chip-input"><input class="app-textbox"></li></ul>';
            document.body.appendChild(chips.nativeElement);
            return {
                links: Array.from(chips.nativeElement.querySelectorAll('a.app-chip')) as HTMLElement[],
                input: chips.nativeElement.querySelector('input.app-textbox') as HTMLElement,
            };
        };

        it('ignores clicks and focus on readonly chips', () => {
            chips.readonly = true;
            chips.handleChipClick({ currentTarget: { focus: jest.fn() } }, chip('a'));
            chips.handleChipFocus({}, chip('a'));
            expect(invoke).not.toHaveBeenCalled();
        });

        it('raises chipclick and chipselect', () => {
            chips.readonly = false;
            const focus = jest.fn();
            chips.handleChipClick({ currentTarget: { focus } }, chip('a'));
            expect(focus).toHaveBeenCalled();
            expect(invoke).toHaveBeenCalledWith('chipclick', expect.anything());
            const item: any = chip('a');
            chips.handleChipFocus({}, item);
            expect(item.active).toBe(true);
            expect(invoke).toHaveBeenCalledWith('chipselect', expect.anything());
        });

        it('moves from the input to the last chip on delete in Apple products only', () => {
            const clear = jest.spyOn(chips, 'onInputClear').mockImplementation(() => undefined);
            (isAppleProduct as any) = false;
            chips.onTextDelete({} as any);
            expect(clear).not.toHaveBeenCalled();
        });

        it('focuses the last chip when the empty input is cleared', () => {
            const { links } = render();
            const focus = jest.spyOn(links[1], 'focus');
            const stop = jest.spyOn(chips, 'stopEvent').mockImplementation(() => undefined);
            chips.chipsList = [chip('a'), chip('b')];
            chips.searchComponent.query = '';
            chips.onInputClear({} as any);
            expect(focus).toHaveBeenCalled();
            expect(stop).toHaveBeenCalled();
            focus.mockClear();
            chips.searchComponent.query = 'text';
            chips.onInputClear({} as any);
            expect(focus).not.toHaveBeenCalled();
            chips.chipsList = [];
            chips.searchComponent.query = '';
            chips.onInputClear({} as any);
            expect(focus).not.toHaveBeenCalled();
        });

        it('navigates with the arrow keys', () => {
            const { links, input } = render();
            chips.readonly = false;
            chips.chipsList = [chip('a'), chip('b')];
            const focusFirst = jest.spyOn(links[0], 'focus');
            const focusLast = jest.spyOn(links[1], 'focus');
            const focusInput = jest.spyOn(input, 'focus');
            chips.searchComponent.query = '';

            chips.onArrowLeft();
            expect(focusLast).toHaveBeenCalled();
            chips.onArrowLeft(chip('b'), 1);
            expect(focusFirst).toHaveBeenCalled();
            chips.onArrowLeft(chip('a'), 0);
            expect(focusInput).toHaveBeenCalledTimes(1);

            focusFirst.mockClear();
            chips.onArrowRight();
            expect(focusFirst).toHaveBeenCalled();
            chips.onArrowRight(chip('a'), 0);
            expect(focusLast).toHaveBeenCalledTimes(2);
            chips.onArrowRight(chip('b'), 1);
            expect(focusInput).toHaveBeenCalledTimes(2);
        });

        it('ignores arrow keys on readonly chips', () => {
            const { links } = render();
            const focus = jest.spyOn(links[0], 'focus');
            chips.readonly = true;
            chips.onArrowLeft();
            chips.onArrowRight();
            expect(focus).not.toHaveBeenCalled();
        });
    });

    describe('removing chips', () => {
        beforeEach(() => {
            chips.datavalue = ['a', 'b', 'c'];
            chips.chipsList = [chip('a'), chip('b'), chip('c')];
            chips._modelByValue = ['a', 'b', 'c'];
            jest.spyOn(chips, 'invokeOnChange').mockImplementation(() => undefined);
            jest.spyOn(chips, 'focusSearchBox').mockImplementation(() => undefined);
        });

        it('ignores backspace and delete on readonly chips', () => {
            chips.readonly = true;
            const remove = jest.spyOn(chips, 'removeItem').mockImplementation(() => undefined);
            chips.onBackspace({}, chip('a'), 0);
            chips.onDelete({}, chip('a'), 0);
            expect(remove).not.toHaveBeenCalled();
        });

        it('removes with backspace and delete', () => {
            chips.readonly = false;
            const remove = jest.spyOn(chips, 'removeItem').mockImplementation(() => undefined);
            chips.onBackspace('e', chip('a'), 1);
            chips.onDelete('e', chip('a'), 2);
            expect(remove).toHaveBeenNthCalledWith(1, 'e', expect.anything(), 1, true);
            expect(remove).toHaveBeenNthCalledWith(2, 'e', expect.anything(), 2);
        });

        it('removes the chip, updates the value and raises the events', () => {
            const event: any = { stopPropagation: jest.fn() };
            chips.removeItem(event, chip('b'), 1);
            expect(chips.chipsList.map((c: any) => c.value)).toEqual(['a', 'c']);
            expect(chips._modelByValue).toEqual(['a', 'c']);
            expect(chips.invokeOnChange).toHaveBeenCalled();
            expect(invoke).toHaveBeenCalledWith('change', expect.objectContaining({ oldVal: ['a', 'b', 'c'] }));
            expect(invoke).toHaveBeenCalledWith('remove', expect.objectContaining({ $item: expect.objectContaining({ value: 'b' }) }));
        });

        it('removes several chips at once and removes object values by equality', () => {
            chips.chipsList = [chip({ id: 1 }), chip({ id: 2 }), chip({ id: 3 })];
            chips._modelByValue = [{ id: 1 }, { id: 2 }, { id: 3 }];
            chips.removeItem({ stopPropagation: jest.fn() } as any, chip('x'), [0, 2] as any);
            expect(chips._modelByValue).toEqual([{ id: 2 }]);
            expect(invoke).toHaveBeenCalledWith('remove', expect.objectContaining({ $item: expect.any(Array) }));
        });

        it('keeps the chip when beforeremove rejects', () => {
            invoke.mockImplementation((name: string) => (name === 'beforeremove' ? false : undefined));
            chips.removeItem({ stopPropagation: jest.fn() } as any, chip('b'), 1);
            expect(chips.chipsList).toHaveLength(3);
        });

        it('moves the focus after a removal', () => {
            jest.useFakeTimers();
            chips.nativeElement.innerHTML = '<ul><li class="chip-item"><a class="app-chip" tabindex="0"></a></li><li class="chip-item"><a class="app-chip" tabindex="0"></a></li></ul>';
            document.body.appendChild(chips.nativeElement);
            const links = Array.from(chips.nativeElement.querySelectorAll('a.app-chip')) as HTMLElement[];
            const focus0 = jest.spyOn(links[0], 'focus');
            const focus1 = jest.spyOn(links[1], 'focus');

            // removing the first chip focuses the chip that took its place
            chips.chipsList = [chip('a'), chip('b')];
            chips.removeItem({ stopPropagation: jest.fn() } as any, chip('a'), 0, true);
            jest.runAllTimers();
            expect(focus0).toHaveBeenCalled();
            expect(chips.chipsList[0].active).toBe(true);

            // removing the last chip focuses the new last chip
            focus0.mockClear();
            chips.chipsList = [chip('a'), chip('b')];
            chips.removeItem({ stopPropagation: jest.fn() } as any, chip('b'), 1, true);
            jest.runAllTimers();
            expect(focus0).toHaveBeenCalled();
            expect(focus1).not.toHaveBeenCalled();
        });

        it('focuses the search box when no chip is left or focusing is not wanted', () => {
            jest.useFakeTimers();
            chips.chipsList = [chip('x')];
            chips.removeItem({ stopPropagation: jest.fn() } as any, chip('x'), 0, true);
            jest.runAllTimers();
            expect(chips.focusSearchBox).toHaveBeenCalledTimes(1);

            chips.chipsList = [chip('a'), chip('b')];
            chips.removeItem({ stopPropagation: jest.fn() } as any, chip('a'), 0);
            jest.runAllTimers();
            expect(chips.focusSearchBox).toHaveBeenCalledTimes(2);
        });
    });

    describe('reordering', () => {
        const uiItem = (index: number) => ({ item: { index: () => index }, helper: { width: jest.fn().mockReturnValue(10) } });

        it('swaps items in lists', () => {
            const data = ['a', 'b', 'c'];
            chips.swapElementsInArray(data, 2, 0);
            expect(data).toEqual(['b', 'c', 'a']);
        });

        it('widens the dragged chip and remembers its index', () => {
            const ui = uiItem(2);
            chips.inputposition = 'first';
            chips.onReorderStart({}, ui);
            expect(ui.helper.width).toHaveBeenCalledWith(11);
            expect(chips.$element.data('oldIndex')).toBe(1);
            chips.resetReorder();
            expect(chips.$element.data('oldIndex')).toBeUndefined();
        });

        it('reorders chips and the value after a drag', () => {
            chips.chipsList = [chip('a'), chip('b'), chip('c')];
            chips._modelByValue = ['a', 'b', 'c'];
            chips.inputposition = 'last';
            chips.$element.data('oldIndex', 0);
            chips.update('evt', uiItem(2));
            expect(chips.chipsList.map((c: any) => c.value)).toEqual(['b', 'c', 'a']);
            expect(chips._modelByValue).toEqual(['b', 'c', 'a']);
            expect(invoke).toHaveBeenCalledWith('reorder', expect.objectContaining({ $changedItem: expect.objectContaining({ oldIndex: 0, newIndex: 2 }) }));
        });

        it('clamps the new index and ignores unchanged positions', () => {
            chips.chipsList = [chip('a'), chip('b')];
            chips._modelByValue = ['a', 'b'];
            chips.inputposition = 'last';
            chips.$element.data('oldIndex', 1);
            chips.update('evt', uiItem(2));
            expect(invoke).not.toHaveBeenCalledWith('reorder', expect.anything());
            expect(chips.$element.data('oldIndex')).toBeUndefined();
        });

        it('cancels the reorder when beforereorder returns false', () => {
            chips.chipsList = [chip('a'), chip('b')];
            chips._modelByValue = ['a', 'b'];
            chips.inputposition = 'last';
            chips.$element.data('oldIndex', 0);
            invoke.mockImplementation((name: string) => (name === 'beforereorder' ? false : undefined));
            chips.update('evt', uiItem(1));
            expect(chips.chipsList.map((c: any) => c.value)).toEqual(['a', 'b']);
        });
    });

    describe('events and properties', () => {
        it('does not attach handlers for events the widget raises itself', () => {
            const superHandle = jest.spyOn(Object.getPrototypeOf(ChipsComponent.prototype), 'handleEvent').mockImplementation(() => undefined);
            ['remove', 'beforeremove', 'chipselect', 'chipclick', 'add', 'reorder', 'change'].forEach((name) => chips.handleEvent(document.createElement('div'), name, jest.fn(), {}));
            expect(superHandle).not.toHaveBeenCalled();
            chips.handleEvent(document.createElement('div'), 'focus', jest.fn(), {});
            expect(superHandle).toHaveBeenCalledTimes(1);
        });

        it('raises beforeservicecall', () => {
            chips.invokeOnBeforeServiceCall({ q: 1 });
            expect(invoke).toHaveBeenCalledWith('beforeservicecall', { inputData: { q: 1 } });
        });

        it.each([
            ['dataoptions', 'dataoptions', { a: 1 }],
            ['limit', 'limit', 5],
            ['matchmode', 'matchmode', 'start'],
            ['groupby', 'groupby', 'type'],
        ])('forwards %s to the search component', (key, prop, value) => {
            chips[key] = value;
            chips.onPropertyChange(key, value, undefined);
            expect(chips.searchComponent[prop]).toEqual(value);
        });

        it('forwards the field properties to the search component', () => {
            chips.datafield = 'code';
            chips.displayfield = 'name';
            chips.displayexpression = 'x';
            chips.displayimagesrc = 'img';
            ['datafield', 'displayfield', 'displayexpression', 'displayimagesrc'].forEach((key) => chips.onPropertyChange(key, chips[key], undefined));
            expect(chips.searchComponent.datafield).toBe('code');
            expect(chips.searchComponent.displaylabel).toBe('name');
            expect(chips.searchComponent.binddisplaylabel).toBe('x');
            expect(chips.searchComponent.binddisplayimagesrc).toBe('img');
        });

        it('ignores tabindex changes', () => {
            expect(() => chips.onPropertyChange('tabindex', 1, 0)).not.toThrow();
        });

        it('toggles the reorder behaviour', () => {
            const configure = jest.spyOn(chips, 'configureDnD').mockImplementation(() => undefined);
            chips.$element.removeClass('ui-sortable');
            chips.onPropertyChange('enablereorder', true, false);
            expect(configure).toHaveBeenCalled();

            chips.$element.addClass('ui-sortable');
            const sortable = jest.spyOn($.fn as any, 'sortable').mockImplementation(function (this: any) { return this; });
            chips.onPropertyChange('enablereorder', false, true);
            expect(sortable).toHaveBeenCalledWith('option', 'disabled', true);
        });
    });
});
