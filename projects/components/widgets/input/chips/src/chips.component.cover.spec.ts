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
    template: '<ul wmChips name="coverChips" readonly="false" show="true" tabindex="0"></ul>',
})
class PlainHost {
    @ViewChild(ChipsComponent, { static: true }) wmComponent: ChipsComponent;
}

@Component({
    standalone: false,
    template: '<ul wmChips name="coverChips2" showsearchicon="true" enablereorder="true" chipclass.bind="item.cls" show="true"></ul>',
})
class ConfiguredHost {
    @ViewChild(ChipsComponent, { static: true }) wmComponent: ChipsComponent;
}

const moduleDef: ITestModuleDef = {
    imports: [FormsModule, TypeaheadModule, ChipsComponent, SearchComponent],
    declarations: [PlainHost, ConfiguredHost],
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

describe('ChipsComponent - cover', () => {
    let fixture: ComponentFixture<any>;
    let chips: any;

    const chip = (value: any, extra: any = {}) => ({ key: value, value, label: String(value), ...extra });
    const create = (host: any) => {
        fixture = compileTestComponent(moduleDef, host);
        chips = fixture.componentInstance.wmComponent;
        fixture.detectChanges();
        jest.spyOn(chips, 'invokeEventCallback').mockImplementation(() => undefined);
        jest.spyOn(chips.searchComponent, 'clearSearch').mockImplementation(() => undefined);
        ($watch as jest.Mock).mockClear();
    };

    afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
        document.body.innerHTML = '';
    });

    describe('configured widget', () => {
        let sortable: jest.SpyInstance;
        beforeEach(() => {
            sortable = jest.spyOn($.fn as any, 'sortable').mockImplementation(function (this: any) { return this; });
            create(ConfiguredHost);
        });

        it('keeps a configured showsearchicon', () => {
            expect(chips.showsearchicon).toBe(true);
        });

        it('configures drag and drop after view init when reordering is enabled', () => {
            expect(sortable).toHaveBeenCalledWith(expect.objectContaining({
                items: '> li:not(.app-chip-search)',
                placeholder: 'chip-placeholder',
            }));
        });

        it('registers the class watcher of every chip after the debounced model update', async () => {
            chips.chipsList = [chip('a'), chip('b')];
            jest.spyOn(chips, 'updateQueryModel').mockResolvedValue(undefined);
            const register = jest.spyOn(chips, 'registerChipItemClass').mockImplementation(() => undefined);
            chips._debounceUpdateQueryModel(['a']);
            await new Promise((r) => setTimeout(r, 300));
            expect(register).toHaveBeenCalledTimes(2);
            expect(register).toHaveBeenNthCalledWith(2, chips.chipsList[1], 1);
        });
    });

    it('does not override a showsearchicon that is already defined when constructed', () => {
        Object.defineProperty(ChipsComponent.prototype, 'showsearchicon', { value: true, writable: true, configurable: true });
        try {
            create(PlainHost);
            expect(chips.showsearchicon).toBe(true);
        } finally {
            delete (ChipsComponent.prototype as any).showsearchicon;
        }
    });

    describe('plain widget', () => {
        beforeEach(() => create(PlainHost));

        it('refreshes the model with the pending datavalue when no datavalue is set', () => {
            const update = jest.fn();
            chips._debounceUpdateQueryModel = update;
            Object.defineProperty(chips, 'datavalue', { get: () => undefined, set: () => undefined, configurable: true });
            chips.toBeProcessedDatavalue = ['pending'];
            chips.datasource = {};
            expect(update).toHaveBeenCalledWith(['pending']);
        });

        it('tolerates a missing debounced updater on dataset and datavalue changes', () => {
            chips._debounceUpdateQueryModel = undefined;
            chips.dataset$.next([]);
            chips.datavalue$.next(['x']);
            expect(chips.chipsList).toEqual([]);
            expect(chips.nextItemIndex).toBe(chips.datasetItems.length);
        });

        it('does not rebuild the chips while the datavalue update originates from the widget', () => {
            const update = jest.fn();
            chips._debounceUpdateQueryModel = update;
            chips._unsubscribeDv = true;
            chips.chipsList = [chip('keep')];
            chips.datavalue$.next(['keep']);
            expect(chips.chipsList).toHaveLength(1);
            expect(update).not.toHaveBeenCalled();
        });

        describe('updateQueryModel', () => {
            it('skips custom data for plain values when no key can be derived', async () => {
                chips.datasetItems = [];
                chips.datafield = 'All Fields';
                chips.displayfield = undefined;
                chips.getTransformedData = jest.fn((val: any, isCustom: boolean) => [chip(val)]);
                const data = ['plain'];
                await chips.updateQueryModel(data);
                expect(data).toEqual(['plain']);
                expect(chips.getTransformedData).toHaveBeenCalledWith('plain', true);
                expect(chips.chipsList[0].iscustom).toBe(true);
            });

            it('handles an empty response from the data source', async () => {
                chips.datasetItems = [];
                chips.datafield = 'name';
                chips.allowonlyselect = false;
                jest.spyOn(chips, 'getDefaultModel').mockResolvedValue(undefined);
                chips.getTransformedData = (val: any) => [chip(val)];
                await chips.updateQueryModel(['x']);
                expect(chips.chipsList.map((c: any) => c.value)).toEqual(['x']);
                expect(chips.chipsList[0].iscustom).toBe(true);
            });

            it('ignores values that were already removed from the model while loading', async () => {
                chips.datasetItems = [];
                chips.datafield = 'name';
                chips.allowonlyselect = true;
                const data = ['ghost'];
                jest.spyOn(chips, 'getDefaultModel').mockImplementation(() => {
                    data.length = 0;
                    return Promise.resolve([]);
                });
                await chips.updateQueryModel(data);
                expect(data).toEqual([]);
                expect(chips.chipsList).toEqual([]);
            });
        });

        describe('addItem', () => {
            it('ignores an empty query when all fields are the data field', () => {
                chips.allowonlyselect = false;
                chips.datafield = 'All Fields';
                chips.searchComponent.query = '';
                const reset = jest.spyOn(chips, 'invokeOnChange').mockImplementation(() => undefined);
                chips.addItem({} as any, undefined);
                expect(reset).not.toHaveBeenCalled();
                expect(chips.chipsList).toEqual([]);
            });

            it('notifies the change with an empty event when none is supplied', () => {
                chips.allowonlyselect = false;
                chips.datafield = 'name';
                chips.searchComponent.query = 'abc';
                chips.getTransformedData = () => [chip('abc')];
                jest.spyOn(chips, 'invokeOnTouched').mockImplementation(() => undefined);
                const change = jest.spyOn(chips, 'invokeOnChange').mockImplementation(() => undefined);
                chips.addItem(undefined as any, undefined);
                expect(change).toHaveBeenCalledWith(['abc'], {}, true);
            });
        });

        describe('onPropertyChange', () => {
            it('prefers the bound display expression and image source', () => {
                chips.binddisplayexpression = 'bound.expr';
                chips.onPropertyChange('displayexpression', 'x', undefined);
                expect(chips.searchComponent.binddisplaylabel).toBe('bound.expr');
                chips.binddisplayimagesrc = 'bound.img';
                chips.onPropertyChange('displayimagesrc', 'x', undefined);
                expect(chips.searchComponent.binddisplayimagesrc).toBe('bound.img');
            });

            it('does nothing when disabling reorder on a widget that is not sortable', () => {
                const configure = jest.spyOn(chips, 'configureDnD').mockImplementation(() => undefined);
                chips.$element.removeClass('ui-sortable');
                chips.onPropertyChange('enablereorder', false, true);
                expect(configure).not.toHaveBeenCalled();
            });

            it('does not focus the search box when it is not rendered', () => {
                jest.useFakeTimers();
                const focus = jest.spyOn(chips, 'focusSearchBox').mockImplementation(() => undefined);
                chips.$element.find('.app-chip-input > input.app-textbox').remove();
                chips.onPropertyChange('autofocus', true, false);
                jest.runAllTimers();
                expect(focus).not.toHaveBeenCalled();
            });
        });
    });
});
