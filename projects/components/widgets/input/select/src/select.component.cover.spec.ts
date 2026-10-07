import { Component, ViewChild } from '@angular/core';
import { ComponentFixture } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { AbstractI18nService, App, AppDefaults } from '@wm/core';
import { ToDatePipe } from '@wm/components/base';
import { compileTestComponent, mockApp } from '../../../../base/src/test/util/component-test-util';
import { MockAbstractI18nService } from '../../../../base/src/test/util/date-test-util';
import { SelectComponent } from './select.component';

jest.mock('@wm/core', () => ({
    ...jest.requireActual('@wm/core'),
    isIos: jest.fn(() => false),
    isSafari: jest.fn(() => false),
}));

import { isIos } from '@wm/core';

@Component({
    standalone: false,
    template: `<wm-select name="sel2"></wm-select>`,
})
class HostComponent {
    @ViewChild(SelectComponent, { static: true }) wmComponent: SelectComponent;
}

const moduleDef = {
    imports: [FormsModule, SelectComponent],
    declarations: [HostComponent],
    providers: [
        { provide: App, useValue: mockApp },
        { provide: ToDatePipe, useClass: ToDatePipe },
        { provide: DatePipe, useClass: DatePipe },
        { provide: AppDefaults, useClass: AppDefaults },
        { provide: AbstractI18nService, useClass: MockAbstractI18nService },
    ],
};

describe('SelectComponent cover', () => {
    let fixture: ComponentFixture<HostComponent>;
    let cmp: any;

    beforeEach(() => {
        (isIos as jest.Mock).mockReturnValue(false);
        fixture = compileTestComponent(moduleDef, HostComponent);
        cmp = fixture.componentInstance.wmComponent;
        fixture.detectChanges();
    });

    afterEach(() => {
        jest.useRealTimers();
        fixture.destroy();
    });

    it('handleEvent does not register blur/change (template handles them) but forwards other events to the select element', () => {
        const proto = Object.getPrototypeOf(Object.getPrototypeOf(Object.getPrototypeOf(cmp)));
        const spy = jest.spyOn(proto, 'handleEvent').mockImplementation(() => {});
        const cb = jest.fn();
        cmp.handleEvent(cmp.nativeElement, 'blur', cb, {});
        cmp.handleEvent(cmp.nativeElement, 'change', cb, {});
        expect(spy).not.toHaveBeenCalled();
        cmp.handleEvent(cmp.nativeElement, 'click', cb, {});
        expect(spy).toHaveBeenCalledWith(cmp.selectEl.nativeElement, 'click', cb, {});
        spy.mockRestore();
    });

    it('onSelectValueChange passes an empty object when no event is supplied', () => {
        const spy = jest.spyOn(cmp, 'invokeOnChange').mockImplementation(() => {});
        cmp.onSelectValueChange(undefined);
        expect(spy).toHaveBeenCalledWith(cmp.datavalue, {}, true);
    });

    it('does not remove ng-invalid after the timeout if the select no longer has the untouched/valid/invalid classes', () => {
        jest.useFakeTimers();
        const el: HTMLElement = cmp.selectEl.nativeElement;
        el.className = 'ng-untouched ng-valid';
        cmp.onPropertyChange('class', 'ng-untouched ng-invalid');
        // state changes before the timeout fires: select became touched and invalid
        el.className = 'ng-touched ng-invalid';
        jest.runAllTimers();
        expect(el.classList.contains('ng-invalid')).toBe(true);
    });

    it('removes ng-invalid after the timeout when the select is still untouched, valid and invalid', () => {
        jest.useFakeTimers();
        const el: HTMLElement = cmp.selectEl.nativeElement;
        el.className = 'ng-untouched ng-valid';
        cmp.onPropertyChange('class', 'ng-untouched ng-invalid');
        el.className = 'ng-untouched ng-valid ng-invalid';
        jest.runAllTimers();
        expect(el.classList.contains('ng-invalid')).toBe(false);
    });

    describe('checkForFloatingLabel', () => {
        let wrapper: JQuery;

        beforeEach(() => {
            wrapper = $('<div class="app-composite-widget caption-floating"></div>');
            wrapper.append(cmp.selectEl.nativeElement);
            $(document.body).append(wrapper);
        });

        afterEach(() => {
            wrapper.remove();
        });

        it('mousedown without datavalue and without placeholder leaves the placeholder option text untouched', () => {
            cmp.placeholder = '';
            cmp.datavalue = undefined;
            const opt = cmp.selectEl.nativeElement.querySelector('#placeholderOption');
            opt.textContent = 'keep';
            cmp.checkForFloatingLabel({ type: 'mousedown' });
            expect(opt.textContent).toBe('keep');
        });

        it('mousedown without datavalue and with placeholder sets the option text', () => {
            cmp.placeholder = 'Pick me';
            cmp.datavalue = undefined;
            cmp.checkForFloatingLabel({ type: 'mousedown' });
            expect(cmp.selectEl.nativeElement.querySelector('#placeholderOption').textContent).toBe('Pick me');
        });

        it('blur without datavalue and placeholder just removes the float-active class', () => {
            cmp.placeholder = '';
            cmp.datavalue = undefined;
            wrapper.addClass('float-active');
            cmp.checkForFloatingLabel({ type: 'blur' });
            expect(wrapper.hasClass('float-active')).toBe(false);
        });

        it('blur without datavalue but with placeholder clears the option text', () => {
            cmp.placeholder = 'Pick';
            cmp.datavalue = undefined;
            const opt = cmp.selectEl.nativeElement.querySelector('#placeholderOption');
            opt.textContent = 'Pick';
            cmp.checkForFloatingLabel({ type: 'blur' });
            expect(opt.textContent).toBe('');
        });

        it('on iOS without placeholder the placeholder option is removed and the value reset when there is no datavalue', () => {
            (isIos as jest.Mock).mockReturnValue(true);
            cmp.placeholder = '';
            cmp.datavalue = undefined;
            cmp.checkForFloatingLabel({ type: 'blur' });
            expect(cmp.selectEl.nativeElement.querySelector('#placeholderOption')).toBeNull();
            expect(cmp.selectEl.nativeElement.value).toBe('');
        });

        it('on iOS without placeholder, removing the option keeps the native value when a datavalue exists', () => {
            (isIos as jest.Mock).mockReturnValue(true);
            cmp.placeholder = '';
            const sel: HTMLSelectElement = cmp.selectEl.nativeElement;
            sel.insertAdjacentHTML('beforeend', '<option value="x">x</option>');
            sel.value = 'x';
            cmp.datavalue = 'x';
            cmp.checkForFloatingLabel({ type: 'blur' });
            expect(sel.querySelector('#placeholderOption')).toBeNull();
            expect(sel.value).toBe('x');
        });

        it('on iOS removePlaceholderOption is a no-op when the placeholder option is already gone', () => {
            (isIos as jest.Mock).mockReturnValue(true);
            cmp.placeholder = '';
            cmp.selectEl.nativeElement.querySelector('#placeholderOption').remove();
            expect(() => cmp.checkForFloatingLabel({ type: 'blur' })).not.toThrow();
        });
    });
});
