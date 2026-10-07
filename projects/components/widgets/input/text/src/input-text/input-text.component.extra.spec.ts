import { Component, ViewChild } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { App, AppDefaults } from "@wm/core";
import { ToDatePipe } from "@wm/components/base";
import { DatePipe } from "@angular/common";
import { InputTextComponent } from "./input-text.component";
import {
    ComponentTestBase,
    ITestComponentDef,
    ITestModuleDef
} from "../../../../../base/src/test/common-widget.specs";
import { IMaskModule } from "angular-imask";
import { ComponentFixture, fakeAsync, tick } from "@angular/core/testing";
import { compileTestComponent, mockApp } from "projects/components/base/src/test/util/component-test-util";

const markup = `<wm-input name="text1">`;

@Component({
    standalone: false,
    template: markup
})

class InputTextWrapperComponent {
    @ViewChild(InputTextComponent, /* TODO: add static flag */ { static: true }) wmComponent: InputTextComponent
}

const testModuleDef: ITestModuleDef = {
    imports: [FormsModule, IMaskModule, InputTextComponent],
    declarations: [InputTextWrapperComponent],
    providers: [
        { provide: App, useValue: mockApp },
        { provide: ToDatePipe, useClass: ToDatePipe },
        { provide: DatePipe, useClass: DatePipe },
        { provide: AppDefaults, useClass: AppDefaults }
    ]
};


describe('InputTextComponent - additional behaviour', () => {
    let fixture: ComponentFixture<InputTextWrapperComponent>;
    let cmp: any;

    beforeEach(() => {
        fixture = compileTestComponent(testModuleDef, InputTextWrapperComponent);
        cmp = fixture.componentInstance.wmComponent;
        fixture.detectChanges();
    });

    afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    const maskRef = (extra: any = {}) => ({ updateOptions: jest.fn(), updateCursor: jest.fn(), value: '', cursorPos: 0, ...extra });

    describe('computed classes', () => {
        it('flags leading and trailing icons', () => {
            cmp.leadingiconclass = 'wi wi-a';
            cmp.trailingiconurl = 'x.png';
            expect(cmp.computedClasses['with-leading-icon']).toBeTruthy();
            expect(cmp.computedClasses['with-trailing-icon']).toBeTruthy();
            cmp.leadingiconclass = undefined;
            cmp.trailingiconurl = undefined;
            expect(cmp.computedClasses['with-leading-icon']).toBeFalsy();
        });

        it('merges string and object conditional classes', () => {
            cmp.conditionalclass = 'cond';
            expect(cmp.computedClasses.cond).toBe(true);
            cmp.conditionalclass = { a: true, b: false };
            expect(cmp.computedClasses).toEqual(expect.objectContaining({ a: true, b: false }));
            cmp.conditionalclass = undefined;
            expect(Object.keys(cmp.computedClasses)).toEqual(['with-leading-icon', 'with-trailing-icon']);
        });
    });

    describe('mask', () => {
        it('is off without a display format', () => {
            cmp.displayformat = '';
            expect(cmp.mask).toBe(false);
        });

        it('applies the format with the supported definitions', () => {
            cmp.displayformat = '(999) 999';
            cmp.maskVal = '(999) 999';
            cmp.placeholder = '';
            const mask = cmp.mask;
            expect(mask.mask).toBe('(999) 999');
            expect(mask.definitions['9'].test('5')).toBe(true);
            expect(mask.definitions.A.test('a')).toBe(true);
            expect(mask.definitions.a.test('A')).toBe(false);
            expect(mask.definitions['*'].test('_')).toBe(true);
        });

        it('hides the format behind the placeholder until the input is focused', () => {
            cmp.displayformat = '99';
            cmp.placeholder = 'type';
            cmp.isFocused = false;
            expect(cmp.mask).toBe(false);
            cmp.isFocused = true;
            expect(cmp.mask).not.toBe(false);
        });
    });

    describe('display format on focus and blur', () => {
        it('marks the input focused on focus and when a value is present', () => {
            cmp.displayformat = '99';
            jest.useFakeTimers();
            cmp.imask = { maskRef: maskRef() };
            cmp.checkForDisplayFormat({ type: 'focus' });
            expect(cmp.isFocused).toBe(true);
            jest.spyOn(cmp, 'datavalue', 'get').mockReturnValue('12');
            cmp.checkForDisplayFormat({ type: 'blur' });
            expect(cmp.isFocused).toBe(true);
        });

        it('moves the cursor to the end of the entered value after focusing', () => {
            jest.useFakeTimers();
            cmp.displayformat = '(99) 99';
            const ref = maskRef({ value: '(12) __', cursorPos: 7 });
            cmp.imask = { maskRef: ref };
            cmp.checkForDisplayFormat({ type: 'focus' });
            jest.advanceTimersByTime(60);
            expect(ref.updateCursor).toHaveBeenCalledWith(5);
            ref.updateCursor.mockClear();
            ref.value = '1234';
            ref.cursorPos = 4;
            cmp.checkForDisplayFormat({ type: 'focus' });
            jest.advanceTimersByTime(60);
            expect(ref.updateCursor).not.toHaveBeenCalled();
            ref.value = '12';
            ref.cursorPos = 0;
            cmp.checkForDisplayFormat({ type: 'focus' });
            jest.advanceTimersByTime(60);
            expect(ref.updateCursor).toHaveBeenCalledWith(2);
        });

        it('lets the focus handler tolerate a missing mask reference', () => {
            jest.useFakeTimers();
            cmp.displayformat = '99';
            cmp.imask = undefined;
            expect(() => {
                cmp.checkForDisplayFormat({ type: 'focus' });
                jest.advanceTimersByTime(60);
            }).not.toThrow();
        });

        it('stops showing the format on blur without a value and clears leftover mask text', () => {
            cmp.displayformat = '(99)';
            const ref = maskRef({ value: '(__)' });
            cmp.imask = { maskRef: ref };
            jest.spyOn(cmp, 'datavalue', 'get').mockReturnValue('');
            cmp.checkForDisplayFormat({ type: 'blur' });
            expect(cmp.isFocused).toBe(false);
            expect(ref.updateOptions).toHaveBeenCalledWith({ lazy: true });
            expect(ref.value).toBe('');
        });

        it('keeps mask text on blur when it is empty already', () => {
            cmp.displayformat = '(99)';
            const ref = maskRef({ value: '' });
            cmp.imask = { maskRef: ref };
            jest.spyOn(cmp, 'datavalue', 'get').mockReturnValue(undefined);
            cmp.checkForDisplayFormat({ type: 'blur' });
            expect(ref.updateOptions).toHaveBeenCalled();
            expect(ref.value).toBe('');
        });

        it('shows the plain value when the display format is no longer applicable', () => {
            cmp.displayformat = '';
            const ref = maskRef();
            cmp.imask = { maskRef: ref };
            jest.spyOn(cmp, 'datavalue', 'get').mockReturnValue('abc');
            cmp.checkForDisplayFormat();
            expect(ref.updateOptions).toHaveBeenCalledWith({ lazy: true });
            expect(cmp.inputEl.nativeElement.value).toBe('abc');
        });

        it('does nothing without a display format and mask', () => {
            cmp.displayformat = '';
            cmp.imask = undefined;
            expect(() => cmp.checkForDisplayFormat()).not.toThrow();
        });
    });

    describe('events and lifecycle', () => {
        it('raises icon click events', () => {
            const spy = jest.spyOn(cmp, 'invokeEventCallback').mockImplementation(() => undefined);
            const $event = { type: 'click' };
            cmp.iconClickEvent($event, 'leadingiconclick');
            expect(spy).toHaveBeenCalledWith('leadingiconclick', { $event });
        });

        it('releases view references on destroy', () => {
            cmp.ngOnDestroy();
            expect(cmp.inputEl).toBeNull();
            expect(cmp.ngModel).toBeNull();
            expect(cmp.imask).toBeNull();
        });

        it.each([
            ['showdisplayformaton', 'keypress', true],
            ['showdisplayformaton', 'focus', false],
        ])('toggles lazy masking when %s is %s', (key, value, lazy) => {
            cmp.onPropertyChange(key, value, undefined);
            expect(cmp.lazy).toBe(lazy);
        });

        it('stores the mask value from the display format', () => {
            cmp.displayformat = '(99)';
            cmp.onPropertyChange('displayformat', '(99)', undefined);
            expect(cmp.maskVal).toBe('(99)');
        });
    });
});
