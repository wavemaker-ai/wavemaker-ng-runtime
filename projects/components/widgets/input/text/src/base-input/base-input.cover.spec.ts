import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule, NgModel } from '@angular/forms';
import { Component, ElementRef, Injector } from '@angular/core';
import { IWidgetConfig, WidgetConfig } from '@wm/components/base';
import { BaseInput } from './base-input';
import { addClass, App } from '@wm/core';
import { mockApp } from 'projects/components/base/src/test/util/component-test-util';
import { BaseFormCustomComponent } from '@wm/components/input/base-form-custom';

jest.mock('@wm/core', () => ({
    ...jest.requireActual('@wm/core'),
    addClass: jest.fn(),
    styler: jest.fn()
}));
class MockWidgetConfig implements IWidgetConfig {
    widgetType: string = 'wm-input';
    widgetSubType?: string = 'text';
    hostClass?: string;
    displayType?: string;
}
class MockNgModel {
    update = { next: jest.fn() };
    valid = true;
}
// Mock Injector
class MockInjector extends Injector {
    get(token: any): any {
        if (token === WidgetConfig) {
            return new MockWidgetConfig();
        }
        if (token === App) return mockApp;
        if (token === NgModel) return new MockNgModel();
        return null;
    }
}

@Component({
    standalone: false,
    template: '<input [(ngModel)]="value">'
})
class TestInputComponent extends BaseInput {
    inputEl: ElementRef;
    ngModel: NgModel;

    constructor(inj: Injector) {
        super(inj, inj.get(WidgetConfig), null);
    }

    protected initWidget() { }
    protected setInitProps(): void { }
}

describe('BaseInput - cover branches', () => {
    let component: TestInputComponent;
    let fixture: ComponentFixture<TestInputComponent>;
    let mockInjector: MockInjector;

    const setup = async (updateOnAttr?: string) => {
        TestBed.resetTestingModule();
        await TestBed.configureTestingModule({
            declarations: [TestInputComponent],
            imports: [FormsModule],
            providers: [
                { provide: Injector, useValue: mockInjector },
                { provide: WidgetConfig, useClass: MockWidgetConfig },
                { provide: App, useValue: mockApp },
                { provide: NgModel, useClass: MockNgModel }
            ]
        }).compileComponents();
        const orig = HTMLElement.prototype.getAttribute;
        if (updateOnAttr) {
            jest.spyOn(HTMLElement.prototype, 'getAttribute').mockImplementation(function (this: HTMLElement, name: string) {
                return name === 'updateon' ? updateOnAttr : orig.call(this, name);
            });
        }
        fixture = TestBed.createComponent(TestInputComponent);
        component = fixture.componentInstance;
        Object.defineProperty(component, 'widgetType', { get: () => 'wm-input' });
        Object.defineProperty(component, 'widgetSubType', { get: () => 'text' });
        component.inputEl = fixture.debugElement.query(input => input.nativeElement instanceof HTMLInputElement);
        component.ngModel = fixture.debugElement.injector.get(NgModel);
        fixture.detectChanges();
    };

    beforeEach(() => {
        mockInjector = new MockInjector();
    });

    afterEach(() => jest.restoreAllMocks());

    it('maps the default update mode to change when the attribute says so', async () => {
        await setup('default');
        expect(component.ngModelOptions.updateOn).toBe('change');
    });

    it('uses the update mode of the attribute as it is otherwise', async () => {
        await setup('blur');
        expect(component.ngModelOptions.updateOn).toBe('blur');
    });

    it('follows the updateon property', async () => {
        await setup();
        (component as any).onPropertyChange('updateon', 'default', undefined);
        expect(component.ngModelOptions.updateOn).toBe('change');
        (component as any).onPropertyChange('updateon', 'blur', 'default');
        expect(component.ngModelOptions.updateOn).toBe('blur');
    });

    it('does not touch the input classes when there is no input element', async () => {
        await setup();
        const switchClassSpy = jest.spyOn(require('@wm/core'), 'switchClass');
        component.inputEl = { nativeElement: null } as any;
        (component as any).onPropertyChange('class', 'a', 'b');
        expect(switchClassSpy).not.toHaveBeenCalled();
    });

    it('updates the model with the unmasked value of the mask', async () => {
        await setup();
        component.imask = { maskRef: { unmaskedValue: '12345' } };
        component.flushViewChanges('(123) 45');
        expect(component.ngModel.update.next).toHaveBeenCalledWith('12345');
        component.imask = { maskRef: { unmaskedValue: '' } };
        component.flushViewChanges('raw');
        expect(component.ngModel.update.next).toHaveBeenLastCalledWith('raw');
    });
});
