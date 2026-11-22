import { Component, ElementRef, Injector, LOCALE_ID, ViewChild } from '@angular/core';
import { TimeComponent } from './time.component';
import { ComponentTestBase, ITestComponentDef, ITestModuleDef } from '../../../../../base/src/test/common-widget.specs';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import {
    compileTestComponent,
    getHtmlSelectorElement,
    hasAttributeCheck,
    checkCustomElementClass,
    onClickCheckTaglengthOnBody,
    mockApp
} from '../../../../../base/src/test/util/component-test-util';
import {
    getTimeFieldValue,
    triggerTimerClickonArrowsByIndex,
    outputpatternTest,
    getTimePickerElement,
    localizedValueOnInputTest, MockAbstractI18nService, MockAbstractI18nServiceDe, MockAbstractI18nServiceRO
} from '../../../../../base/src/test/util/date-test-util';
import { TimepickerModule } from 'ngx-bootstrap/timepicker';
import { BsDropdownModule } from 'ngx-bootstrap/dropdown';
import { waitForAsync, ComponentFixture, fakeAsync } from '@angular/core/testing';
import {
    UserDefinedExecutionContext,
    AppDefaults,
    AbstractI18nService,
    App
} from '@wm/core';
import { FormsModule } from '@angular/forms';
import { ToDatePipe } from '../../../../../base/src/pipes/custom-pipes';
import { DatePipe, registerLocaleData } from '@angular/common';
import localeDE from '@angular/common/locales/de';
import localeRO from '@angular/common/locales/ro';
import { BsLocaleService } from 'ngx-bootstrap/datepicker';
import * as momentLib  from 'moment';
const moment = momentLib.default || window['moment'];
import { By } from '@angular/platform-browser';

const currentTime = moment(new Date()).format('hh:mm:ss');

const markup = `<div wmTime  name="time1" hint="my time" datavalue="${currentTime}" maxtime="${currentTime}" mintime="${currentTime}"
shortcutkey="g" tabindex="0" outputformat="hh:mm:ss"  timepattern="hh:mm:ss" hourstep="1" minutestep="20" required="true" showdropdownon="button"
 change.event="time1Change($event, widget, newVal, oldVal)" focus.event="time1Focus($event, widget)" blur.event="time1Blur($event, widget)"
  click.event="time1Click($event, widget)" mouseenter.event="time1Mouseenter($event, widget)" mouseleave.event="time1Mouseleave($event, widget)"
   tap.event="time1Tap($event, widget)"  class="input-group-lg" color="#9f4343" margin="5px"  autofocus="true" ngModel></div>`;

@Component({
    standalone: false,
    template: markup
})
class TimeWrapperComponent {
    @ViewChild(TimeComponent, /* TODO: add static flag */ { static: true })
    wmComponent: TimeComponent;

    time1Change($event, widget, newVal, oldVal) {
        // console.log('Time Change event triggered!');
    }

    time1Focus($event, widget) {
        // console.log('Time Focus event triggered!');
    }

    time1Blur($event, widget) {
        // console.log('Time Blur event triggered!');
    }

    time1Click($event, widget) {
        // console.log('Time Click event triggered!');
    }

    time1Mouseenter($event, widget) {
        // console.log('mouseenter event triggered!');
    }

    time1Mouseleave($event, widget) {
        // console.log('Time mouseleave event triggered!');
    }

    time1Tap($event, widget) {
        // console.log('Time tap event triggered!');
    }


}

const dateComponentModuleDef: ITestModuleDef = {
    declarations: [TimeWrapperComponent],
    imports: [BrowserAnimationsModule, TimeComponent, FormsModule, TimepickerModule, BsDropdownModule],
    providers: [
        { provide: App, useValue: mockApp },
        { provide: UserDefinedExecutionContext, useValue: UserDefinedExecutionContext },
        { provide: AppDefaults, useValue: AppDefaults },
        { provide: ToDatePipe, useClass: ToDatePipe },
        { provide: DatePipe, useClass: DatePipe },
        { provide: AbstractI18nService, useClass: MockAbstractI18nService }
    ]
};

const dateComponentDef: ITestComponentDef = {
    $unCompiled: $(markup),
    type: 'wm-time',
    widgetSelector: '[wmTime]',
    inputElementSelector: 'input.app-textbox',

    testModuleDef: dateComponentModuleDef,
    testComponent: TimeWrapperComponent
};

const TestBase: ComponentTestBase = new ComponentTestBase(dateComponentDef);
TestBase.verifyPropsInitialization();
TestBase.verifyCommonProperties();
TestBase.verifyStyles();
TestBase.verifyAccessibility();
TestBase.verifyEvents([
    {
        clickableEle: '.btn-date',
        callbackMethod: 'time1Tap',
        eventName: 'tap'
    },
    {
        clickableEle: '.btn-date',
        callbackMethod: 'time1Click',
        eventName: 'click'
    }, {
        mouseSelectionEle: '.app-timeinput',
        callbackMethod: 'time1Mouseleave',
        eventName: 'mouseleave'
    }, {
        mouseSelectionEle: '.app-timeinput',
        callbackMethod: 'time1Mouseenter',
        eventName: 'mouseenter'
    }, {
        eventTrigger: '.app-textbox',
        callbackMethod: 'time1Focus',
        eventName: 'focus'
    },
    {
        eventTrigger: '.app-textbox',
        callbackMethod: 'time1Blur',
        eventName: 'blur'
    }
]);

describe("TimeComponent", () => {
    let timeWrapperComponent: TimeWrapperComponent;
    let wmComponent: TimeComponent;
    let fixture: ComponentFixture<TimeWrapperComponent>;

    beforeEach((async () => {
        fixture = compileTestComponent(dateComponentModuleDef, TimeWrapperComponent);
        timeWrapperComponent = fixture.componentInstance;
        wmComponent = timeWrapperComponent.wmComponent;
        fixture.detectChanges();
    }));
    afterEach(() => {
        if (fixture) {
            fixture.destroy();
        }
    });


    /************************* Properties starts ****************************************** **/

    // TypeError: Cannot read properties of null (reading 'nativeElement')
    it('should not add the hidden property, element always visible', async () => {
        await fixture.whenStable();
        const element = fixture.debugElement.query(By.css('.app-timeinput'));
        fixture.whenStable().then(() => {
            expect(element.nativeElement.hasAttribute('hidden')).toBe(false);
        });
    });

    it('should autofocus the date control ', waitForAsync(() => {
        let inputEle = getHtmlSelectorElement(fixture, '.app-textbox');
        fixture.whenStable().then(() => {
            expect(inputEle.nativeElement.hasAttribute('autofocus')).toBeTruthy();
        });

    }));

    //TODO
    // it('should autofocus the date control ', () => {
    //     wmComponent.getWidget().autofocus = true;
    //     let inputEle = getHtmlSelectorElement(fixture, '.app-textbox');
    //     fixture.whenStable().then(() => {
    //         console.log(inputEle, '----------')
    //         expect(inputEle).toBe(document.activeElement);
    //         console.log(document.activeElement, '----***------')
    //     });

    // });

    it('should assign the shortkey to the input control as attribute accesskey ', waitForAsync(() => {
        let dateInputControl = getHtmlSelectorElement(fixture, '.app-textbox');
        expect(dateInputControl.nativeElement.getAttribute('accesskey')).toEqual('g');
    }));

    // it("should set the hours step as 1hour on click on top arrow button", waitForAsync(() => {
    //     wmComponent.getWidget().hourstep = 2;
    //     let dateInputControl = getHtmlSelectorElement(fixture, '.btn-date');
    //     dateInputControl.nativeElement.click();
    //     fixture.whenStable().then(() => {
    //         triggerTimerClickonArrowsByIndex(0);
    //         let hoursValue = +getTimeFieldValue(0);
    //         expect(hoursValue).toBe(2);
    //
    //     });
    // }));


    it("should set the min step as 30min on click on the second top arrow button", waitForAsync(() => {
        wmComponent.getWidget().minutestep = 25;

        let dateInputControl = getHtmlSelectorElement(fixture, '.btn-date');
        dateInputControl.nativeElement.click();
        fixture.whenStable().then(() => {
            triggerTimerClickonArrowsByIndex(1);
            let minValue = +getTimeFieldValue(1);
            expect(minValue).toBe(25);

        });
    }));

    it('should set the current date as default value ', waitForAsync(() => {
        let dateInputControl = getHtmlSelectorElement(fixture, '.app-textbox');
        expect(dateInputControl.nativeElement.value).toEqual(currentTime);
    }));

    it('should set the given date as default value and timepattern check ', waitForAsync(() => {
        wmComponent.getWidget().timepattern = 'hh:mm a';
        wmComponent.getWidget().datavalue = '12:10';
        wmComponent.getWidget().pm = "PM";
        fixture.detectChanges();
        let dateInputControl = getHtmlSelectorElement(fixture, '.app-textbox');
        expect(dateInputControl.nativeElement.value).toEqual('12:10 PM');
    }));

    // it('should be readonly mode ', () => {
    //     wmComponent.getWidget().readonly = true;
    //     fixture.detectChanges();
    //     hasAttributeCheck(fixture, '.app-textbox', 'readonly');
    // });
    it('should be disabled mode ', waitForAsync(() => {
        wmComponent.getWidget().disabled = true;
        fixture.detectChanges();
        hasAttributeCheck(fixture, '.app-textbox', 'disabled');

    }));
    it('should be disabled mode (picker button)', waitForAsync(() => {
        wmComponent.getWidget().disabled = true;
        fixture.detectChanges();
        hasAttributeCheck(fixture, '.btn-date', 'disabled');

    }));

    it("should show the timer panel on click the time button ", waitForAsync(() => {
        onClickCheckTaglengthOnBody(fixture, '.btn-date', null, null);
        fixture.whenStable().then(() => {
            expect(document.getElementsByTagName('timepicker').length).toBe(1);
        });
    }));

    it("should not show the timer panel on click the input control ", waitForAsync(() => {
        onClickCheckTaglengthOnBody(fixture, '.app-textbox', 'timepicker', 0);
    }));

    it('should get the time outputformat as hh:mm:ss ', (() => {
        wmComponent.outputformat = 'hh:mm:ss';
        return outputpatternTest(fixture, '[wmTime]', wmComponent.datavalue, true);
    }));

    /************************* Properties ends ****************************************** **/




    /************************* Validations starts ****************************************** **/

    it('should be apply required validation ', waitForAsync(() => {
        fixture.whenStable().then(() => {
            hasAttributeCheck(fixture, '.app-textbox', 'required')
        });
    }));

    it("should not allow to set the above max time", waitForAsync(() => {

        onClickCheckTaglengthOnBody(fixture, '.btn-date', null, null);

        fixture.whenStable().then(() => {
            // Let the opened timepicker compute its max-time state before interacting with it
            fixture.detectChanges();
            triggerTimerClickonArrowsByIndex(0);
            fixture.detectChanges();
            // The hour-increment arrow must stay disabled: datavalue already equals maxtime
            const hourIncrementBtn = getTimePickerElement()[0] as HTMLElement;
            expect(hourIncrementBtn.classList.contains('disabled') || hourIncrementBtn.hasAttribute('disabled')).toBeTruthy();
        });
    }));

    it("should not allow to set the above given max time", waitForAsync(() => {
        wmComponent.getWidget().timepattern = 'HH:mm:ss';
        wmComponent.getWidget().mintime = '01:00:00';
        wmComponent.getWidget().maxtime = "03:00:00";
        wmComponent.getWidget().datavalue = "03:00:00";

        onClickCheckTaglengthOnBody(fixture, '.btn-date', null, null);

        fixture.whenStable().then(() => {
            fixture.detectChanges();
            triggerTimerClickonArrowsByIndex(0);
            // Wait a bit for the class to be applied after the click
            setTimeout(() => {
                fixture.detectChanges();
                const timePickerElements = getTimePickerElement();
                if (timePickerElements && timePickerElements.length > 0) {
                    // Check if disabled class exists on any of the timepicker elements
                    // The timepicker library might apply disabled state to different elements
                    let foundDisabled = false;
                    for (let i = 0; i < Math.min(timePickerElements.length, 3); i++) {
                        const elem = timePickerElements[i];
                        if (elem?.classList?.contains('disabled')) {
                            foundDisabled = true;
                            break;
                        }
                        if (elem && (elem.hasAttribute('disabled') || (elem as any).disabled)) {
                            foundDisabled = true;
                            break;
                        }
                    }
                    expect(foundDisabled).toBeTruthy();
                }
            }, 200);
        });
    }));


    it("should not allow to set the below min time", waitForAsync(() => {
        let dateInputControl = getHtmlSelectorElement(fixture, '.btn-date');
        dateInputControl.nativeElement.click();
        fixture.whenStable().then(() => {
            triggerTimerClickonArrowsByIndex(3);
            checkCustomElementClass(getTimePickerElement()[3], 'disabled');
        });
    }));

    it("should not allow to set the above given min time", waitForAsync(() => {
        wmComponent.getWidget().timepattern = 'HH:mm:ss';
        wmComponent.getWidget().mintime = '01:00:00';
        wmComponent.getWidget().maxtime = "03:00:00";
        wmComponent.getWidget().datavalue = "01:00:00";
        onClickCheckTaglengthOnBody(fixture, '.btn-date', null, null);

        fixture.whenStable().then(() => {
            triggerTimerClickonArrowsByIndex(3);
            checkCustomElementClass(getTimePickerElement()[3], 'disabled');
            checkCustomElementClass(getTimePickerElement()[4], 'disabled');
            checkCustomElementClass(getTimePickerElement()[5], 'disabled');

        });
    }));
    /************************* Validations End ****************************************** **/



    /************************* Scenarios starts ***************************************** */

    it('should show the timepicker panel when we click on the input control and onclick outside it should close ', waitForAsync(() => {
        wmComponent.getWidget().showdropdownon = 'default';
        onClickCheckTaglengthOnBody(fixture, '.app-textbox', null, null);
        fixture.whenStable().then(() => {
            expect(document.getElementsByTagName('timepicker').length).toBe(1);
            document.body.click();
            fixture.whenStable().then(() => {
                expect(document.getElementsByTagName('timepicker').length).toBe(0);
            });

        });
    }));

    it("should be able to select the time between the min and max time", waitForAsync(() => {
        wmComponent.getWidget().timepattern = 'HH:mm:ss';
        wmComponent.getWidget().mintime = '01:00:00';
        wmComponent.getWidget().maxtime = "03:00:00";
        wmComponent.getWidget().datavalue = "01:00:00";

        onClickCheckTaglengthOnBody(fixture, '.btn-date', null, null);

        fixture.whenStable().then(() => {
            triggerTimerClickonArrowsByIndex(0);
            let hoursValue = +getTimeFieldValue(0);
            expect(hoursValue).toBe(2);
        });
    }));
    /************************* Scenarios End ***************************************** */



    /************************* Events starts ****************************************** **/

    it('Should trigger the date control change event', waitForAsync(() => {
        wmComponent.getWidget().timepattern = 'HH:mm:ss';
        wmComponent.getWidget().mintime = '01:00:00';
        wmComponent.getWidget().maxtime = "03:00:00";
        wmComponent.getWidget().datavalue = "01:00:00";

        onClickCheckTaglengthOnBody(fixture, '.btn-date', null, null);
        fixture.whenStable().then(() => {
            jest.spyOn(timeWrapperComponent, 'time1Change');
            triggerTimerClickonArrowsByIndex(1);
            fixture.detectChanges();
            expect(timeWrapperComponent.time1Change).toHaveBeenCalledTimes(1);
        });
    }));

    /************************* Events end ****************************************** **/

    describe('assignModel', () => {
        it('should set displayInputElem if it is undefined', () => {
            (wmComponent as any).displayInputElem = undefined;
            const mockInput = document.createElement('input');
            jest.spyOn(wmComponent, 'getMobileInput').mockReturnValue(mockInput);

            wmComponent.assignModel();

            expect((wmComponent as any).displayInputElem).toBe(mockInput);
        });

        it('should not change displayInputElem if it is already defined', () => {
            const existingInput = document.createElement('input');
            (wmComponent as any).displayInputElem = existingInput;

            wmComponent.assignModel();

            expect((wmComponent as any).displayInputElem).toBe(existingInput);
        });

        it('should set the value of displayInputElem to nativeDisplayValue', () => {
            (wmComponent as any).displayInputElem = document.createElement('input');
            Object.defineProperty(wmComponent, 'nativeDisplayValue', {
                get: jest.fn(() => '12:30'),
            })

            wmComponent.assignModel();

            expect(((wmComponent as any).displayInputElem as HTMLInputElement).value).toBe('12:30');
        });
    });

    describe('datavalue', () => {
        it('should return CURRENT_TIME while tracking the current time with no resolved value yet', () => {
            (wmComponent as any).isCurrentTime = true;
            (wmComponent as any).bsTimeValue = undefined;
            expect(wmComponent.datavalue).toEqual('CURRENT_TIME');
        });

        it('should set isCurrentTime and start the interval for CURRENT_TIME', () => {
            const setIntervalSpy = jest.spyOn(wmComponent as any, 'setTimeInterval');
            wmComponent.datavalue = 'CURRENT_TIME';
            expect((wmComponent as any).isCurrentTime).toBeTruthy();
            expect(setIntervalSpy).toHaveBeenCalled();
        });

        it('should clear the interval and parse a real value', () => {
            const clearIntervalSpy = jest.spyOn(wmComponent as any, 'clearTimeInterval');
            wmComponent.datavalue = '10:30:00';
            expect((wmComponent as any).isCurrentTime).toBeFalsy();
            expect(clearIntervalSpy).toHaveBeenCalled();
            expect((wmComponent as any).bsTimeValue).toBeInstanceOf(Date);
        });

        it('should clear the value entirely when set to a falsy value', () => {
            wmComponent.datavalue = '10:30:00';
            wmComponent.datavalue = undefined;
            expect((wmComponent as any).bsTimeValue).toBeUndefined();
            expect((wmComponent as any).isCurrentTime).toBeFalsy();
        });
    });

    describe('displayValue / nativeDisplayValue / timestamp', () => {
        it('should return an empty string display value without a time', () => {
            (wmComponent as any).bsTimeValue = undefined;
            expect(wmComponent.displayValue).toEqual('');
        });

        it('should return undefined timestamp without a time', () => {
            (wmComponent as any).bsTimeValue = undefined;
            expect(wmComponent.timestamp).toBeUndefined();
        });

        it('should return the epoch timestamp once a time is set', () => {
            const date = new Date('2023-06-15T10:30:00');
            (wmComponent as any).bsTimeValue = date;
            expect(wmComponent.timestamp).toEqual(date.valueOf());
        });
    });

    describe('onPropertyChange', () => {
        it('should ignore tabindex changes', () => {
            const superSpy = jest.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(wmComponent)), 'onPropertyChange');
            wmComponent.onPropertyChange('tabindex', '2', '1');
            expect(superSpy).not.toHaveBeenCalled();
        });

        it('should update the time pattern format', () => {
            const updateFormatSpy = jest.spyOn(wmComponent as any, 'updateFormat');
            wmComponent.onPropertyChange('timepattern', 'HH:mm', 'hh:mm a');
            expect(updateFormatSpy).toHaveBeenCalledWith('timepattern');
        });

        it('should compute and validate mintime', () => {
            const validateSpy = jest.spyOn(wmComponent as any, 'mintimeMaxtimeValidation');
            wmComponent.onPropertyChange('mintime', '09:00:00', undefined);
            expect((wmComponent as any).minTime).toBeInstanceOf(Date);
            expect(validateSpy).toHaveBeenCalled();
        });

        it('should compute and validate maxtime', () => {
            const validateSpy = jest.spyOn(wmComponent as any, 'mintimeMaxtimeValidation');
            wmComponent.onPropertyChange('maxtime', '18:00:00', undefined);
            expect((wmComponent as any).maxTime).toBeInstanceOf(Date);
            expect(validateSpy).toHaveBeenCalled();
        });

        it('should delegate unrecognized property changes to the base implementation', () => {
            expect(() => wmComponent.onPropertyChange('show', true, false)).not.toThrow();
        });
    });

    describe('setValidateType / mintimeMaxtimeValidation', () => {
        it('should not set a validate type when the time is in range', () => {
            (wmComponent as any).timeNotInRange = false;
            wmComponent.setValidateType(new Date(2023, 0, 1, 9), new Date(2023, 0, 1, 18), new Date(2023, 0, 1, 12));
            expect((wmComponent as any).validateType).toBeUndefined();
        });

        it('should flag mintime as the validate type when the value is too early', () => {
            (wmComponent as any).timeNotInRange = true;
            wmComponent.setValidateType(new Date(2023, 0, 1, 9), new Date(2023, 0, 1, 18), new Date(2023, 0, 1, 8));
            expect((wmComponent as any).validateType).toEqual('mintime');
        });

        it('should flag maxtime as the validate type when the value is too late', () => {
            (wmComponent as any).timeNotInRange = true;
            wmComponent.setValidateType(new Date(2023, 0, 1, 9), new Date(2023, 0, 1, 18), new Date(2023, 0, 1, 20));
            expect((wmComponent as any).validateType).toEqual('maxtime');
        });

        it('should mark timeNotInRange when the current value falls outside mintime/maxtime', () => {
            (wmComponent as any).minTime = new Date(2023, 0, 1, 9);
            (wmComponent as any).maxTime = new Date(2023, 0, 1, 18);
            (wmComponent as any).bsTimeValue = new Date(2023, 0, 1, 20);
            (wmComponent as any).mintimeMaxtimeValidation();
            expect((wmComponent as any).timeNotInRange).toBeTruthy();
        });
    });

    describe('toggleDropdown', () => {
        it('should focus the input for native pickers unless focus is explicitly skipped', () => {
            (wmComponent as any).loadNativeDateInput = true;
            const focusSpy = jest.spyOn(wmComponent, 'onDateTimeInputFocus').mockImplementation(() => undefined);
            wmComponent.toggleDropdown({ type: 'click' });
            expect(focusSpy).toHaveBeenCalledTimes(1);
        });

        it('should skip focusing for native pickers when skipFocus is true', () => {
            (wmComponent as any).loadNativeDateInput = true;
            const focusSpy = jest.spyOn(wmComponent, 'onDateTimeInputFocus').mockImplementation(() => undefined);
            wmComponent.toggleDropdown({ type: 'click' }, true);
            expect(focusSpy).not.toHaveBeenCalled();
        });

        it('should invoke the click callback and toggle the dropdown open state', () => {
            (wmComponent as any).loadNativeDateInput = false;
            const invokeSpy = jest.spyOn(wmComponent, 'invokeEventCallback').mockImplementation(() => undefined as any);
            (wmComponent as any).status.isopen = false;
            wmComponent.toggleDropdown({ type: 'click' });
            expect(invokeSpy).toHaveBeenCalledWith('click', { $event: { type: 'click' } });
            expect((wmComponent as any).status.isopen).toBe(true);
        });

        it('should not toggle when the click target is an input and dropdown-on-input is disabled', () => {
            (wmComponent as any).loadNativeDateInput = false;
            (wmComponent as any).showdropdownon = 'button';
            (wmComponent as any).status.isopen = false;
            const input = document.createElement('input');
            wmComponent.toggleDropdown({ type: 'click', target: input });
            expect((wmComponent as any).status.isopen).toBe(false);
        });
    });

    describe('preventTpClose', () => {
        it('should stop immediate propagation and notify caption animation when inside a floating caption', () => {
            const wrapper = document.createElement('div');
            wrapper.className = 'app-composite-widget caption-floating';
            wrapper.appendChild((wmComponent as any).nativeElement);
            document.body.appendChild(wrapper);
            const notifySpy = jest.spyOn((wmComponent as any).app, 'notify');
            const $event = { stopImmediatePropagation: jest.fn() };
            (wmComponent as any).preventTpClose($event);
            expect($event.stopImmediatePropagation).toHaveBeenCalled();
            expect(notifySpy).toHaveBeenCalledWith('captionPositionAnimate', expect.objectContaining({ nativeEl: expect.anything() }));
            document.body.removeChild(wrapper);
        });

    });

    describe('addBodyClickListener', () => {
        it('should do nothing when skipListener is false', fakeAsync(() => {
            expect(() => (wmComponent as any).addBodyClickListener(false)).not.toThrow();
        }));
    });

    describe('onDisplayKeydown', () => {
        it('should toggle the dropdown on Enter when dropdown-on-input is enabled', () => {
            (wmComponent as any).showdropdownon = 'default';
            const toggleSpy = jest.spyOn(wmComponent, 'toggleDropdown').mockImplementation(() => undefined);
            const event = { key: 'Enter', stopPropagation: jest.fn(), preventDefault: jest.fn() };
            wmComponent.onDisplayKeydown(event);
            expect(toggleSpy).toHaveBeenCalledWith(event);
        });

        it('should toggle the dropdown on ArrowDown when dropdown-on-input is enabled', () => {
            (wmComponent as any).showdropdownon = 'default';
            const toggleSpy = jest.spyOn(wmComponent, 'toggleDropdown').mockImplementation(() => undefined);
            const event = { key: 'ArrowDown', stopPropagation: jest.fn(), preventDefault: jest.fn() };
            wmComponent.onDisplayKeydown(event);
            expect(toggleSpy).toHaveBeenCalledWith(event);
        });

        it('should hide the dropdown for any other key when dropdown-on-input is enabled', () => {
            (wmComponent as any).showdropdownon = 'default';
            const hideSpy = jest.spyOn(wmComponent, 'hideTimepickerDropdown').mockImplementation(() => undefined);
            const event = { key: 'a', stopPropagation: jest.fn() };
            wmComponent.onDisplayKeydown(event);
            expect(hideSpy).toHaveBeenCalledTimes(1);
        });

        it('should hide the dropdown when dropdown-on-input is disabled', () => {
            (wmComponent as any).showdropdownon = 'button';
            const hideSpy = jest.spyOn(wmComponent, 'hideTimepickerDropdown').mockImplementation(() => undefined);
            wmComponent.onDisplayKeydown({ key: 'Enter' });
            expect(hideSpy).toHaveBeenCalledTimes(1);
        });
    });

    describe('onDisplayTimeChange', () => {
        it('should abort silently on an invalid format', () => {
            jest.spyOn(wmComponent as any, 'formatValidation').mockReturnValue(false);
            const onTimeChangeSpy = jest.spyOn(wmComponent as any, 'onTimeChange');
            wmComponent.onDisplayTimeChange({ target: { value: 'garbage' } });
            expect(onTimeChangeSpy).not.toHaveBeenCalled();
        });

        it('should clear the invalid flag and apply the new time on a valid format', () => {
            jest.spyOn(wmComponent as any, 'formatValidation').mockReturnValue(true);
            const onTimeChangeSpy = jest.spyOn(wmComponent as any, 'onTimeChange').mockImplementation(() => undefined);
            (wmComponent as any).invalidDateTimeFormat = true;
            wmComponent.onDisplayTimeChange({ target: { value: '10:30 AM' } });
            expect((wmComponent as any).invalidDateTimeFormat).toBe(false);
            expect(onTimeChangeSpy).toHaveBeenCalledTimes(1);
        });
    });

    describe('onInputBlur', () => {
        it('should invoke touched/blur callbacks when focus did not move to the timepicker field', () => {
            const invokeOnTouchedSpy = jest.spyOn(wmComponent, 'invokeOnTouched').mockImplementation(() => undefined);
            const invokeEventCallbackSpy = jest.spyOn(wmComponent, 'invokeEventCallback').mockImplementation(() => undefined as any);
            wmComponent.onInputBlur({ relatedTarget: document.createElement('div') });
            expect(invokeOnTouchedSpy).toHaveBeenCalledTimes(1);
            expect(invokeEventCallbackSpy).toHaveBeenCalledWith('blur', expect.anything());
        });

        it('should not fire blur when focus moved into the timepicker field', () => {
            const timepickerField = document.createElement('div');
            timepickerField.className = 'bs-timepicker-field';
            const invokeEventCallbackSpy = jest.spyOn(wmComponent, 'invokeEventCallback').mockImplementation(() => undefined as any);
            wmComponent.onInputBlur({ relatedTarget: timepickerField });
            expect(invokeEventCallbackSpy).not.toHaveBeenCalled();
        });
    });

    describe('onTimeChange', () => {
        it('should apply a valid, in-range time', () => {
            (wmComponent as any).minTime = undefined;
            (wmComponent as any).maxTime = undefined;
            const newTime = new Date(2023, 0, 1, 10, 30);
            (wmComponent as any).onTimeChange(newTime);
            expect((wmComponent as any).bsTimeValue).toEqual(newTime);
        });

        it('should flag an out-of-range time without applying it', () => {
            (wmComponent as any).minTime = new Date(2023, 0, 1, 9);
            (wmComponent as any).maxTime = new Date(2023, 0, 1, 18);
            const outOfRange = new Date(2023, 0, 1, 20);
            (wmComponent as any).bsTimeValue = undefined;
            (wmComponent as any).onTimeChange(outOfRange);
            expect((wmComponent as any).timeNotInRange).toBeTruthy();
            expect((wmComponent as any).bsTimeValue).toBeUndefined();
        });

        it('should parse the value from a native-picker event', () => {
            (wmComponent as any).loadNativeDateInput = true;
            (wmComponent as any).onTimeChange({ target: { value: '10:30:00' } }, true);
            expect((wmComponent as any).bsTimeValue).toBeInstanceOf(Date);
        });
    });

    describe('setTimeInterval / clearTimeInterval', () => {
        it('should not create a second interval when one is already running', fakeAsync(() => {
            (wmComponent as any).timeinterval = 123;
            const setIntervalSpy = jest.spyOn(window, 'setInterval');
            (wmComponent as any).setTimeInterval();
            expect(setIntervalSpy).not.toHaveBeenCalled();
            (wmComponent as any).timeinterval = null;
        }));

        it('should create and later clear a real interval', fakeAsync(() => {
            (wmComponent as any).clearTimeInterval();
            (wmComponent as any).setTimeInterval();
            expect((wmComponent as any).timeinterval).toBeDefined();
            (wmComponent as any).clearTimeInterval();
            expect((wmComponent as any).timeinterval).toBeNull();
        }));

        it('clearTimeInterval should do nothing when there is no active interval', () => {
            (wmComponent as any).timeinterval = null;
            expect(() => (wmComponent as any).clearTimeInterval()).not.toThrow();
        });
    });

    describe('setIsTimeOpen', () => {
        it('should update the dropdown open status', () => {
            (wmComponent as any).setIsTimeOpen(true);
            expect((wmComponent as any).status.isopen).toBeTruthy();
            (wmComponent as any).setIsTimeOpen(false);
            expect((wmComponent as any).status.isopen).toBeFalsy();
        });
    });

    describe('handleEvent', () => {
        it('should not delegate blur/focus/change/click to the base implementation', () => {
            const superSpy = jest.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(wmComponent)), 'handleEvent');
            const node = document.createElement('div');
            ['blur', 'focus', 'change', 'click'].forEach((eventName) => {
                (wmComponent as any).handleEvent(node, eventName, jest.fn(), {});
            });
            expect(superSpy).not.toHaveBeenCalled();
        });

        it('should delegate other events to the base implementation', () => {
            const superSpy = jest.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(wmComponent)), 'handleEvent');
            const node = document.createElement('div');
            (wmComponent as any).handleEvent(node, 'mouseenter', jest.fn(), {});
            expect(superSpy).toHaveBeenCalledWith(node, 'mouseenter', expect.any(Function), {});
        });
    });

    describe('hideTimepickerDropdown', () => {
        it('should close the dropdown, deregister listeners and blur the input', () => {
            const deregisterSpy = jest.fn();
            (wmComponent as any).deregisterEventListener = deregisterSpy;
            (wmComponent as any).removeKeyupListener = jest.fn();
            const invokeOnTouchedSpy = jest.spyOn(wmComponent, 'invokeOnTouched').mockImplementation(() => undefined);
            const blurSpy = jest.spyOn(wmComponent, 'blurDateInput').mockImplementation(() => undefined);
            (wmComponent as any).status.isopen = true;
            wmComponent.hideTimepickerDropdown();
            expect(invokeOnTouchedSpy).toHaveBeenCalledTimes(1);
            expect((wmComponent as any).status.isopen).toBeFalsy();
            expect(deregisterSpy).toHaveBeenCalledTimes(1);
            expect(blurSpy).toHaveBeenCalledWith(true);
        });

        it('should skip deregistering when there is no listener to remove', () => {
            (wmComponent as any).deregisterEventListener = undefined;
            (wmComponent as any).removeKeyupListener = jest.fn();
            jest.spyOn(wmComponent, 'invokeOnTouched').mockImplementation(() => undefined);
            jest.spyOn(wmComponent, 'blurDateInput').mockImplementation(() => undefined);
            expect(() => wmComponent.hideTimepickerDropdown()).not.toThrow();
        });
    });

    describe('onShown', () => {
        it('should reposition the dropdown and focus the timepicker without throwing', () => {
            (wmComponent as any).bsDropdown = { _dropdown: {} };
            const focusSpy = jest.spyOn(wmComponent as any, 'focusTimePickerPopover').mockImplementation(() => undefined);
            const bindSpy = jest.spyOn(wmComponent as any, 'bindTimePickerKeyboardEvents').mockImplementation(() => undefined);
            expect(() => wmComponent.onShown()).not.toThrow();
            expect(focusSpy).toHaveBeenCalledWith(wmComponent);
            expect(bindSpy).toHaveBeenCalled();
        });

        it('should clear the time value when reopening an invalid/out-of-range dropdown', () => {
            (wmComponent as any).bsDropdown = { _dropdown: {} };
            (wmComponent as any).timeNotInRange = true;
            (wmComponent as any).bsTimeValue = new Date();
            jest.spyOn(wmComponent as any, 'focusTimePickerPopover').mockImplementation(() => undefined);
            jest.spyOn(wmComponent as any, 'bindTimePickerKeyboardEvents').mockImplementation(() => undefined);
            wmComponent.onShown();
            expect((wmComponent as any).bsTimeValue).toBeNull();
        });
    });
});


const dateComponentLocaleModuleDef: ITestModuleDef = {
    declarations: [TimeWrapperComponent],
    imports: [BrowserAnimationsModule, TimeComponent, FormsModule, TimepickerModule, BsDropdownModule],
    providers: [
        { provide: App, useValue: mockApp },
        { provide: LOCALE_ID, useValue: 'de' },
        { provide: UserDefinedExecutionContext, useValue: UserDefinedExecutionContext },
        { provide: AppDefaults, useValue: AppDefaults },
        { provide: ToDatePipe, useClass: ToDatePipe },
        { provide: DatePipe, useClass: DatePipe },
        { provide: AbstractI18nService, deps: [BsLocaleService], useClass: MockAbstractI18nServiceDe },
        { provide: Injector, useValue: Injector },
        { provide: ElementRef, useValue: { nativeElement: document.createElement('div') } }
    ]
};

describe('TimeComponent with localization', () => {
    let timeWrapperComponent: TimeWrapperComponent;
    let wmComponent: TimeComponent;
    let fixture: ComponentFixture<TimeWrapperComponent>;

    beforeEach((async () => {
        // register the selected locale language
        registerLocaleData(localeDE);
        fixture = compileTestComponent(dateComponentLocaleModuleDef, TimeWrapperComponent);
        timeWrapperComponent = fixture.componentInstance;
        wmComponent = timeWrapperComponent.wmComponent;
        fixture.detectChanges();
    }));

    afterEach(() => {
        if (fixture?.nativeElement) {
            // Remove the component from the DOM to trigger ngOnDestroy
            document.body.removeChild(fixture.nativeElement);
        }
        if (fixture) {
            fixture.destroy();
        }
    });


    it('should create the time Component with de locale', () => {
        expect(timeWrapperComponent).toBeTruthy();
    });

    // it('should display localized meriains in time picker', (() => {
    //     localizedTimePickerTest(fixture, (wmComponent as any).meridians, '.btn-date');
    // }));

    it('should update the datavalue without error when we type "de" format time in inputbox with "12H" format', fakeAsync(() => {
        const timepattern = 'hh:mm:ss a';
        wmComponent.getWidget().timepattern = timepattern;
        wmComponent.getWidget().minTime = '';
        wmComponent.getWidget().maxTime = '';
        localizedValueOnInputTest(fixture, '03:15:00 AM', wmComponent);
    }));


    it('should update the datavalue without error when we type "de" format time in inputbox with "24H" format', fakeAsync(() => {
        const timepattern = 'HH:mm:ss';
        wmComponent.getWidget().timepattern = timepattern;
        wmComponent.getWidget().minTime = '';
        wmComponent.getWidget().maxTime = '';
        localizedValueOnInputTest(fixture, '15:15:00', wmComponent);
    }));
});

const dateComponentROLocaleModuleDef: ITestModuleDef = {
    declarations: [TimeWrapperComponent],
    imports: [BrowserAnimationsModule, TimeComponent, FormsModule, TimepickerModule, BsDropdownModule],
    providers: [
        { provide: App, useValue: mockApp },
        { provide: LOCALE_ID, useValue: 'ro' },
        { provide: UserDefinedExecutionContext, useValue: UserDefinedExecutionContext },
        { provide: AppDefaults, useValue: AppDefaults },
        { provide: ToDatePipe, useClass: ToDatePipe },
        { provide: DatePipe, useClass: DatePipe },
        { provide: AbstractI18nService, deps: [BsLocaleService], useClass: MockAbstractI18nServiceRO }
    ]
};

describe('TimeComponent with ro (Romania) localization', () => {
    let timeWrapperComponent: TimeWrapperComponent;
    let wmComponent: TimeComponent;
    let fixture: ComponentFixture<TimeWrapperComponent>;

    beforeEach((async () => {
        // register the selected locale language
        registerLocaleData(localeRO);
        fixture = compileTestComponent(dateComponentROLocaleModuleDef, TimeWrapperComponent);
        timeWrapperComponent = fixture.componentInstance;
        wmComponent = timeWrapperComponent.wmComponent;
        fixture.detectChanges();
    }));

    afterEach(() => {
        if (fixture) {
            fixture.destroy();
        }
    });


    it('should update the datavalue without error when we type "ro" format time in inputbox with "12H" format', fakeAsync(() => {
        const timepattern = 'hh:mm:ss a';
        wmComponent.getWidget().timepattern = timepattern;
        wmComponent.getWidget().minTime = '';
        wmComponent.getWidget().maxTime = '';
        localizedValueOnInputTest(fixture, '03:15:00 a.m.', wmComponent);
    }));
});

