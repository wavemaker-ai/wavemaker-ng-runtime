import { Component, ViewChild } from '@angular/core';
import { SwitchComponent } from './switch.component';
import { ComponentTestBase, ITestComponentDef, ITestModuleDef } from '../../../../base/src/test/common-widget.specs';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { ComponentFixture, waitForAsync } from '@angular/core/testing';
import { compileTestComponent, mockApp } from '../../../../base/src/test/util/component-test-util';
import { AbstractI18nService, App, AppDefaults } from '@wm/core';
import { MockAbstractI18nService } from '../../../../base/src/test/util/date-test-util';
import { ToDatePipe } from '@wm/components/base';

const markup = `<div wmSwitch #wm_switch1="wmSwitch" [attr.aria-label]="wm_switch1.arialabel || 'Switch button'" datavalue="yes" show="true" width="800" height="200" hint="Switch button" tabindex="0" disabled="false" name="switch1"></div>`;

@Component({
    standalone: false,
    template: markup
})
class SwitchWrapperComponent {
    @ViewChild(SwitchComponent, /* TODO: add static flag */ { static: true }) wmComponent: SwitchComponent;
}
const testModuleDef: ITestModuleDef = {
    imports: [FormsModule, SwitchComponent],
    declarations: [SwitchWrapperComponent],
    providers: [
        { provide: App, useValue: mockApp },
        { provide: ToDatePipe, useClass: ToDatePipe },
        { provide: DatePipe, useClass: DatePipe },
        { provide: AppDefaults, useClass: AppDefaults },
        { provide: AbstractI18nService, useClass: MockAbstractI18nService }
    ]
};


describe('SwitchComponent - additional behaviour', () => {
    let fixture: ComponentFixture<SwitchWrapperComponent>;
    let cmp: any;

    const event = () => ({ preventDefault: jest.fn() } as any);
    const setItems = (values: string[]) => {
        cmp.datasetItems = values.map((value, i) => ({ key: value, value, label: value, selected: false, index: i }));
        cmp.btnwidth = 100 / values.length;
    };

    beforeEach(() => {
        fixture = compileTestComponent(testModuleDef, SwitchWrapperComponent);
        cmp = fixture.componentInstance.wmComponent;
        fixture.detectChanges();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    describe('selecting options', () => {
        beforeEach(() => {
            setItems(['one', 'two', 'three']);
        });

        it('does nothing for an empty data set', () => {
            cmp.datasetItems = [];
            expect(() => cmp.selectOptAtIndex(0)).not.toThrow();
        });

        it('sets the model by the value of the option at the index', () => {
            cmp.selectOptAtIndex(1);
            expect(cmp._modelByValue).toBe('two');
        });

        it('selects an option, highlights it and raises change events', () => {
            const change = jest.spyOn(cmp, 'invokeOnChange');
            const touched = jest.spyOn(cmp, 'invokeOnTouched');
            cmp.selectOpt(event(), 2, cmp.datasetItems[2]);
            expect(cmp.selectedItem.value).toBe('three');
            expect(cmp.datavalue).toBe('three');
            expect(change).toHaveBeenCalled();
            expect(touched).toHaveBeenCalled();
        });

        it('ignores clicks while disabled', () => {
            cmp.disabled = true;
            const change = jest.spyOn(cmp, 'invokeOnChange');
            cmp.selectOpt(event(), 1, cmp.datasetItems[1]);
            expect(change).not.toHaveBeenCalled();
        });

        it('keeps the selection when the selected option of a longer switch is clicked again', () => {
            cmp.selectOpt(event(), 1, cmp.datasetItems[1]);
            const highlight = jest.spyOn(cmp, 'updateHighlighter');
            cmp.selectOpt(event(), 1, cmp.datasetItems[1]);
            expect(highlight).not.toHaveBeenCalled();
            expect(cmp.selectedItem.value).toBe('two');
        });

        it('highlights the other option when the selected option of a two option switch is clicked again', () => {
            setItems(['yes', 'no']);
            const highlight = jest.spyOn(cmp, 'updateHighlighter').mockImplementation(() => undefined);
            cmp.selectOpt(event(), 0, cmp.datasetItems[0]);
            cmp.selectOpt(event(), 1, cmp.datasetItems[1]);
            expect(highlight).toHaveBeenCalledTimes(2);
            const last = cmp.selectedItem;
            cmp.selectOpt(event(), cmp.datasetItems.indexOf(last), last);
            expect(cmp.selectedItem).not.toBe(last);
        });

        it('collects several selected options when multiple is enabled', () => {
            cmp.multiple = true;
            cmp.selectOpt(event(), 0, cmp.datasetItems[0]);
            cmp.selectOpt(event(), 2, cmp.datasetItems[2]);
            expect(cmp.datasetItems[0].selected).toBe(true);
            expect(cmp.datasetItems[2].selected).toBe(true);
            expect(cmp.modelByKey).toEqual([cmp.datasetItems[0].key, cmp.datasetItems[2].key]);
            cmp.selectOpt(event(), 0, cmp.datasetItems[0]);
            expect(cmp.datasetItems[0].selected).toBe(false);
            expect(cmp.selectedItem.value).toBe('three');
        });

        it('moves the highlighter with or without animation', () => {
            const handler = { css: jest.fn(), animate: jest.fn() };
            const jq = jest.spyOn($.fn, 'find').mockReturnValue(handler as any);
            jest.spyOn(cmp, 'setSelectedValue').mockImplementation(() => undefined);
            cmp.btnwidth = 33;
            cmp.selectedItem = cmp.datasetItems[1];
            cmp.updateHighlighter(true);
            expect(handler.css).toHaveBeenCalledWith('left', '33%');
            cmp.updateHighlighter(false);
            expect(handler.animate).toHaveBeenCalledWith({ left: '33%' }, 300);
            cmp.selectedItem = undefined;
            cmp.updateHighlighter(true);
            expect(handler.css).toHaveBeenLastCalledWith('left', '-33%');
            jq.mockRestore();
        });
    });

    describe('properties', () => {
        it('removes the disabled attribute when it is switched off', () => {
            cmp.nativeElement.setAttribute('disabled', 'true');
            cmp.onPropertyChange('disabled', false);
            expect(cmp.nativeElement.hasAttribute('disabled')).toBe(false);
        });

        it.each([
            [undefined, []],
            [null, []],
            ['   ', []],
            ['help', ['help']],
        ])('normalises the hint %p', (hint, expected) => {
            cmp.onPropertyChange('hint', hint);
            expect(cmp.hint).toEqual(expected);
        });
    });

    describe('options and styles', () => {
        it('toggles the overflow when the height changes', async () => {
            cmp.onStyleChange('height', '100px');
            await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
            expect(cmp.nativeElement.style.overflow).toBe('auto');
            cmp.onStyleChange('height', '');
            await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
            expect(cmp.nativeElement.style.overflow).toBe('');
            expect(() => cmp.onStyleChange('width', '10px')).not.toThrow();
        });

        it('sizes the overlay by the number of options and refreshes the selection', () => {
            setItems(['a', 'b', 'c', 'd']);
            cmp._debounceSetSelectedValue = jest.fn();
            cmp.updateSwitchOptions();
            expect(cmp.btnwidth).toBe(25);
            expect(cmp._debounceSetSelectedValue).toHaveBeenCalledWith(true);
        });

        it('selects the flagged item when a value is present', () => {
            setItems(['a', 'b', 'c']);
            cmp.datasetItems[2].selected = true;
            jest.spyOn(cmp, 'datavalue', 'get').mockReturnValue('c');
            cmp.setSelectedValue();
            expect(cmp.selectedItem.value).toBe('c');
        });

        it('keeps the width for multi select switches', () => {
            setItems(['a', 'b']);
            cmp.btnwidth = 7;
            cmp.multiple = true;
            cmp.updateSwitchOptions();
            expect(cmp.btnwidth).toBe(7);
        });

        it('does not pick a selected item without a value', () => {
            setItems(['a', 'b']);
            cmp.datasetItems[0].selected = true;
            cmp.selectedItem = undefined;
            jest.spyOn(cmp, 'datavalue', 'get').mockReturnValue(undefined);
            cmp.toBeProcessedDatavalue = undefined;
            cmp.setSelectedValue();
            expect(cmp.selectedItem).toBeUndefined();
        });
    });
});
