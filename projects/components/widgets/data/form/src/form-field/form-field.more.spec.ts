import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Component, ViewChild } from '@angular/core';
import { App, Viewport } from '@wm/core';
import { ListComponent } from '@wm/components/data/list';
import { compileTestComponent, mockApp } from 'projects/components/base/src/test/util/component-test-util';
import { FormFieldDirective } from './form-field.directive';
import { FormComponent } from '../form.component';

@Component({
    standalone: false,
    template: `<div wmFormField name="field1"></div>`,
})
class HostComponent {
    @ViewChild(FormFieldDirective, { static: true }) wmComponent: FormFieldDirective;
}

@Component({
    standalone: false,
    template: `<div wmFormField name="field2" dataset="a,b"></div>`,
})
class DatasetHostComponent {
    @ViewChild(FormFieldDirective, { static: true }) wmComponent: FormFieldDirective;
}

const moduleDef = {
    declarations: [HostComponent, DatasetHostComponent],
    imports: [ReactiveFormsModule, FormFieldDirective],
    providers: [
        FormBuilder,
        { provide: App, useValue: mockApp },
        { provide: FormComponent, useValue: FormComponent },
        { provide: Viewport, useValue: Viewport },
        { provide: ListComponent, useValue: ListComponent },
    ],
};

const makeForm = (extra: any = {}) =>
    ({
        registerFormFields: jest.fn(),
        onFieldValueChange: jest.fn(),
        ngform: new FormGroup({}),
        formdata: {},
        isUpdateMode: false,
        ...extra,
    } as any);

describe('FormFieldDirective - additional behaviour', () => {
    let fixture: ComponentFixture<HostComponent>;
    let field: any;

    beforeEach(() => {
        fixture = compileTestComponent(moduleDef, HostComponent);
        field = fixture.componentInstance.wmComponent;
        field.form = makeForm();
        field._fieldName = 'name';
        fixture.detectChanges();
    });

    afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    it('remembers that the user typed', () => {
        field._triggeredByUser = false;
        field.onKeydownHandler(new KeyboardEvent('keydown'));
        expect(field._triggeredByUser).toBe(true);
    });

    it('detects data set bound through the dataset attribute', () => {
        TestBed.resetTestingModule();
        const dsFixture = compileTestComponent(moduleDef, DatasetHostComponent);
        const dsField: any = dsFixture.componentInstance.wmComponent;
        expect(dsField.isDataSetBound).toBe(true);
    });

    describe('widget properties', () => {
        it('copies properties to the inner widget, mapping the input type for text fields', () => {
            field.formWidget = { widget: {} };
            field.widgettype = 'text';
            field.setFormWidget('inputtype', 'email');
            expect(field.formWidget.widget.type).toBe('email');
            field.widgettype = 'number';
            field.setFormWidget('inputtype', 'x');
            expect(field.formWidget.widget.inputtype).toBe('x');
            field.formWidget = undefined;
            expect(() => field.setFormWidget('a', 1)).not.toThrow();
        });

        it('copies properties to the max widget of range fields', () => {
            field.formWidgetMax = { widget: {} };
            field.setMaxFormWidget('placeholder', 'to');
            expect(field.formWidgetMax.widget.placeholder).toBe('to');
            field.formWidgetMax = undefined;
            expect(() => field.setMaxFormWidget('a', 1)).not.toThrow();
        });

        it('updates the element width and forwards style changes to the widgets', () => {
            const widget = jest.spyOn(field, 'setFormWidget').mockImplementation(() => undefined);
            const max = jest.spyOn(field, 'setMaxFormWidget').mockImplementation(() => undefined);
            field.onStyleChange('width', '120px');
            expect(field.$element[0].style.width).toBe('120px');
            expect(widget).toHaveBeenCalledWith('width', '120px');
            expect(max).toHaveBeenCalledWith('width', '120px');
            field.onStyleChange('color', 'red');
            expect(widget).toHaveBeenLastCalledWith('color', 'red');
        });

        it('reads display information from the widget', () => {
            field.formWidget = { displayValue: 'shown', timestamp: 123, charlength: 4 };
            expect([field.displayValue, field.timestamp, field.charlength]).toEqual(['shown', 123, 4]);
            field.formWidget = undefined;
            expect([field.displayValue, field.timestamp, field.charlength]).toEqual([undefined, undefined, undefined]);
        });
    });

    describe('range values', () => {
        it('reads and writes the max and min values', () => {
            field.formWidgetMax = { datavalue: 9 };
            expect(field.maxValue).toBe(9);
            field.ngform.addControl('name_max', new FormControl(''));
            field.maxValue = 5;
            expect(field._maxControl.value).toBe(5);
            field.ngform.removeControl('name_max');
            expect(() => { field.maxValue = 1; }).not.toThrow();
            field.value = 3;
            expect(field.minValue).toBe(field.value);
            field.minValue = 4;
            expect(field.value).toBe(field.minValue);
        });

        it('creates the max control and keeps it in sync for range fields', () => {
            TestBed.resetTestingModule();
            const fresh = compileTestComponent(moduleDef, HostComponent);
            const rangeField: any = fresh.componentInstance.wmComponent;
            rangeField.form = makeForm({ formdata: { age: 7 } });
            rangeField._fieldName = 'age';
            rangeField.isRange = 'true';
            fresh.detectChanges();
            expect(rangeField.ngform.controls.age_max).toBeDefined();
            expect(rangeField._maxControl).toBe(rangeField.ngform.controls.age_max);
            expect(rangeField._control.value).toBe(7);
        });
    });

    describe('controls', () => {
        it('exposes the reactive control and resets it', () => {
            expect(field._control).toBe(field.ngform.controls.name);
            field._control.setValue('x');
            field.reset();
            expect(field._control.value).toBeNull();
            field.ngform = undefined;
            expect(field._control).toBeUndefined();
            expect(() => field.reset()).not.toThrow();
        });

        it('gives fields inside lists unique control names', () => {
            TestBed.resetTestingModule();
            const fresh = compileTestComponent(moduleDef, HostComponent);
            const inList: any = fresh.componentInstance.wmComponent;
            const form = makeForm();
            form.ngform.addControl('item', new FormControl(''));
            form.ngform.addControl('item_1', new FormControl(''));
            inList.form = form;
            inList._fieldName = 'item';
            inList.parentList = { name: 'list' };
            fresh.detectChanges();
            expect(inList._fieldName).toBe('item_2');
            expect(form.ngform.controls.item_2).toBeDefined();
        });

        it('keeps the name for fields of the list form itself', () => {
            TestBed.resetTestingModule();
            const fresh = compileTestComponent(moduleDef, HostComponent);
            const inList: any = fresh.componentInstance.wmComponent;
            const list = { name: 'list' };
            inList.form = makeForm({ parentList: list });
            inList._fieldName = 'item';
            inList.parentList = list;
            fresh.detectChanges();
            expect(inList._fieldName).toBe('item');
        });
    });

    describe('events and display', () => {
        it('raises upload events with the previous and new files', () => {
            const invoke = jest.spyOn(field, 'invokeEventCallback').mockImplementation(() => undefined);
            field._oldUploadVal = 'old';
            const $event = { target: { files: ['f'] } };
            field.triggerUploadEvent($event, 'change');
            expect(invoke).toHaveBeenCalledWith('change', { $event, newVal: ['f'], oldVal: 'old' });
            expect(field._oldUploadVal).toEqual(['f']);
            field.triggerUploadEvent($event, 'click');
            expect(invoke).toHaveBeenLastCalledWith('click', { $event });
        });

        it('evaluates view mode expressions only when there is data', () => {
            expect(field.evaluateExpr(undefined, 'a', undefined)).toBeUndefined();
            expect(field.evaluateExpr({}, 'a', undefined)).toBeUndefined();
            expect(() => field.evaluateExpr({ first: 1 }, undefined, undefined)).not.toThrow();
            expect(() => field.evaluateExpr({ first: 1 }, 'first', 'expr', 'bind')).not.toThrow();
        });

        it('calls bound functions', () => {
            expect(field.boundFn(() => 7)).toBe(7);
        });
    });
});
