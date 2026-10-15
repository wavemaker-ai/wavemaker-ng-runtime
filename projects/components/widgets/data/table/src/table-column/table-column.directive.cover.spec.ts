import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { FormBuilder, FormControl, ReactiveFormsModule } from '@angular/forms';
import { App, AppDefaults, FormWidgetType } from '@wm/core';
import { mockApp } from 'projects/components/base/src/test/util/component-test-util';
import { TableColumnDirective } from './table-column.directive';
import { TableComponent } from '../table.component';
import { isDataSetWidget } from '@wm/components/base';
import * as core from '@wm/core';

jest.mock('@wm/core', () => {
    const actual = jest.requireActual('@wm/core');
    return { ...actual, $watch: jest.fn((...args: any[]) => actual.$watch(...args)) };
});
jest.mock('@wm/components/base', () => ({
    ...jest.requireActual('@wm/components/base'),
    isDataSetWidget: jest.fn(),
}));

@Component({
    standalone: false,
    template: '<div wmTableColumn showinfilter="false" readonly="true" type="timestamp"></div>',
})
class HostComponent {}

describe('TableColumnDirective - cover', () => {
    let fixture: ComponentFixture<HostComponent>;
    let directive: any;
    let table: any;

    beforeEach(async () => {
        jest.clearAllMocks();
        table = {
            redraw: jest.fn(),
            registerColumns: jest.fn(),
            headerConfig: [],
            filtermode: 'multicolumn',
            registerFormField: jest.fn(),
            renderDynamicFilterColumn: jest.fn(),
            editmode: 'inline',
            callDataGridMethod: jest.fn(),
            ngform: {
                addControl: jest.fn(),
                markAsUntouched: jest.fn(),
                controls: { testField: new FormControl(), _new_testField: new FormControl() },
            },
            fb: new FormBuilder(),
            datasource: { execute: jest.fn(() => false) },
            binddataset: 'Variables.x.dataSet',
        };
        await TestBed.configureTestingModule({
            declarations: [HostComponent],
            imports: [ReactiveFormsModule, TableColumnDirective],
            providers: [
                { provide: TableComponent, useValue: table },
                { provide: AppDefaults, useValue: { dateFormat: 'yyyy-MM-dd', timeFormat: 'HH:mm:ss', dateTimeFormat: 'yyyy-MM-dd HH:mm:ss' } },
                { provide: App, useValue: mockApp },
            ],
        }).compileComponents();
        fixture = TestBed.createComponent(HostComponent);
        directive = fixture.debugElement.children[0].injector.get(TableColumnDirective);
        fixture.detectChanges();
    });

    afterEach(() => jest.useRealTimers());

    const emitter = (value) => ({
        changes: { subscribe: (cb) => { cb(value); return { unsubscribe: jest.fn() }; } },
    });

    describe('FieldDef registered for inline widgets', () => {
        it('proxies focus, setProperty and getProperty to the inline widget', () => {
            const widget: any = { focus: jest.fn(), datavalue: 'a', other: 1 };
            directive._isRowFilter = false;
            directive._isInlineEditable = true;
            directive._isNewEditableRow = false;
            directive.fieldValidations = { formwidget: undefined };
            directive.setUpInlineWidget = jest.fn();
            directive._inlineInstances = emitter({ first: { widget } });
            directive.binding = 'testField';
            directive.ngAfterContentInit();
            const [name, def] = table.registerFormField.mock.calls.pop();
            expect(name).toBe('testField');
            def.focus();
            expect(widget.focus).toHaveBeenCalled();
            def.setProperty('value', 'b');
            expect(widget.datavalue).toBe('b');
            def.setProperty('other', 2);
            expect(widget.other).toBe(2);
            expect(def.getProperty('value')).toBe('b');
            expect(def.getProperty('other')).toBe(2);
        });
    });

    it('renders the dynamic filter column in ngAfterViewInit when a template exists', () => {
        const tmpl: any = {};
        directive.filterTemplateRef = tmpl;
        directive.ngAfterViewInit();
        expect(table.renderDynamicFilterColumn).toHaveBeenCalledWith(tmpl);
        table.renderDynamicFilterColumn.mockClear();
        directive.filterTemplateRef = undefined;
        directive.ngAfterViewInit();
        expect(table.renderDynamicFilterColumn).not.toHaveBeenCalled();
    });

    it('uses the column index for registering header config of grouped columns', () => {
        directive.group = { name: 'grp' };
        directive.initState = new Map();
        table.headerConfig = [];
        directive.ngOnInit();
        expect(table.registerColumns).toHaveBeenCalled();
    });

    describe('form controls', () => {
        it('addFormControl does nothing when destroyed or without a form', () => {
            table.ngform.addControl.mockClear();
            directive.table = { ngform: null };
            directive.addFormControl();
            expect(table.ngform.addControl).not.toHaveBeenCalled();
        });

        it('setUpControls skips upload widgets', () => {
            directive._isInlineEditable = true;
            directive._isRowFilter = false;
            directive.editWidgetType = FormWidgetType.UPLOAD;
            table.ngform.addControl.mockClear();
            directive.setUpControls();
            expect(table.ngform.addControl).not.toHaveBeenCalled();
        });

        it('setUpControls tolerates a missing new row control', () => {
            directive._isInlineEditable = true;
            directive._isNewEditableRow = true;
            directive._isRowFilter = false;
            directive.editWidgetType = 'text';
            directive.binding = 'zzz';
            table.ngform.controls = { zzz: new FormControl() };
            table.ngform.addControl.mockClear();
            directive.setUpControls();
            expect(table.ngform.addControl).toHaveBeenCalledWith('zzz', expect.anything());
            expect(table.ngform.addControl).toHaveBeenCalledWith('zzz_new', expect.anything());
            expect(directive.getFormControl('_new')).toBeNull();
        });
    });

    it('updates the filter dataset from the watched table dataset', () => {
        (isDataSetWidget as jest.Mock).mockReturnValue(true);
        directive._isRowFilter = true;
        directive.filterwidget = 'select';
        directive.bindfilterdataset = undefined;
        directive.widget = {};
        table.datasource.execute.mockReturnValue(false);
        (core.$watch as jest.Mock).mockClear();
        directive.loadFilterData();
        const call = (core.$watch as jest.Mock).mock.calls.find((c) => c[0] === 'Variables.x.dataSet');
        expect(call).toBeDefined();
        call[3]([1, 2]);
        expect(directive.widget.filterdataset).toEqual([1, 2]);
    });

    describe('populateFieldDef', () => {
        const run = (props: any) => {
            Object.assign(directive, props);
            directive.populateFieldDef();
        };

        it('honours showinfilter and readonly attributes', () => {
            run({ show: true });
            expect(directive.showinfilter).toBe('false');
            expect(directive.readonly).toBe(true);
        });

        it('derives the filter widget for columns without a type', () => {
            run({ type: undefined, filterwidget: undefined });
            expect(directive.filterwidget).toBeTruthy();
        });

        it('keeps show for dynamic tables', () => {
            table.isdynamictable = true;
            run({ show: 'dyn' });
            expect(directive.showinfilter).toBe('dyn');
        });

        it('sets time and date time patterns from app defaults or defaults', () => {
            run({ type: 'time', formatpattern: 'toDate', datepattern: undefined });
            expect(directive.datepattern).toBe('HH:mm:ss');
            run({ type: 'timestamp', formatpattern: 'toDate', datepattern: undefined });
            expect(directive.datepattern).toBe('yyyy-MM-dd HH:mm:ss');
            directive.appDefaults = {};
            run({ type: 'datetime', formatpattern: 'toDate', datepattern: undefined });
            expect(directive.datepattern).toBeTruthy();
            run({ type: 'localdatetime', formatpattern: 'toDate', datepattern: undefined });
            expect(directive.datepattern).toBeUndefined();
        });
    });

    describe('onPropertyChange caption', () => {
        beforeEach(() => {
            directive._propsInitialized = true;
            directive.field = 'f1';
        });

        it('falls back to an empty caption', () => {
            directive.onPropertyChange('caption', undefined, 'x');
            expect(directive.displayName).toBe('');
        });

        it('only updates the matching header when the column is already registered', () => {
            table.headerConfig = [{ field: 'other', displayName: 'o' }, { field: 'f1', displayName: 'old' }];
            directive.onPropertyChange('caption', 'New', 'old');
            expect(table.headerConfig[0].displayName).toBe('o');
            expect(table.headerConfig[1].displayName).toBe('New');
        });
    });

    describe('ngOnDestroy', () => {
        it('copes with missing query lists, validations and notify fields', () => {
            directive._filterInstances = undefined;
            directive._inlineInstances = undefined;
            directive._inlineInstancesNew = undefined;
            directive.fieldValidations = undefined;
            directive.fieldValidations_new = undefined;
            directive.notifyForFields = undefined;
            directive.observeOnFields = undefined;
            expect(() => directive.ngOnDestroy()).not.toThrow();
            expect(directive.table).toBeNull();
            expect(directive.group).toBeNull();
        });
    });
});
