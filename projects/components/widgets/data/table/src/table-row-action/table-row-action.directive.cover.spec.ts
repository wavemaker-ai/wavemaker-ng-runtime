import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { App } from '@wm/core';
import { Context } from '@wm/components/base';
import { mockApp } from 'projects/components/base/src/test/util/component-test-util';
import { TableRowActionDirective } from './table-row-action.directive';
import { TableComponent } from '../table.component';

@Component({
    standalone: false,
    template: '<div wmTableRowAction></div>',
})
class HostComponent {}

describe('TableRowActionDirective - cover', () => {
    let table: any;
    let directive: any;
    let host: any;

    beforeEach(async () => {
        table = {
            editRow: jest.fn(),
            deleteRow: jest.fn(),
            addNewRow: jest.fn(),
            registerRowActions: jest.fn(),
        };
        await TestBed.configureTestingModule({
            declarations: [HostComponent],
            imports: [TableRowActionDirective],
            providers: [
                { provide: TableComponent, useValue: table },
                { provide: App, useValue: mockApp },
            ],
        }).compileComponents();
        const fixture = TestBed.createComponent(HostComponent);
        host = fixture.debugElement.children[0];
        directive = host.injector.get(TableRowActionDirective);
        fixture.detectChanges();
    });

    it('exposes row operations on the context that delegate to the table', () => {
        const context: any = host.injector.get(Context)[0];
        const evt = { type: 'click' };
        context.editRow(evt);
        context.deleteRow(evt);
        context.addNewRow(evt);
        expect(table.editRow).toHaveBeenCalledWith(evt);
        expect(table.deleteRow).toHaveBeenCalledWith(evt);
        expect(table.addNewRow).toHaveBeenCalledWith(evt);
    });

    describe('getTitle', () => {
        it('prefers the title and falls back to the display name or empty text', () => {
            directive.title = 'T';
            expect(directive.getTitle()).toBe('T');
            directive.title = undefined;
            directive['display-name'] = 'D';
            expect(directive.getTitle()).toBe('D');
            directive['display-name'] = undefined;
            expect(directive.getTitle()).toBe('');
        });
    });

    describe('populateAction', () => {
        it('builds the button definition from the configured properties', () => {
            Object.assign(directive, {
                key: 'k', show: true, class: 'c', iconclass: 'i', action: 'a()', accessroles: 'r', disabled: false,
                tabindex: '3', hyperlink: 'h', target: '_blank', conditionalclass: 'cc', conditionalstyle: { a: 1 },
                title: 'tt',
            });
            directive['display-name'] = 'Name';
            directive['widget-type'] = 'anchor';
            directive.populateAction();
            expect(directive.buttonDef).toEqual({
                key: 'k', displayName: 'Name', show: true, class: 'c', iconclass: 'i', title: 'tt', action: 'a()',
                accessroles: 'r', disabled: false, tabindex: 3, widgetType: 'anchor', hyperlink: 'h', target: '_blank',
                conditionalclass: 'cc', conditionalstyle: { a: 1 },
            });
        });

        it('applies defaults for the unset properties', () => {
            Object.assign(directive, {
                caption: undefined, class: undefined, iconclass: undefined, tabindex: undefined, target: undefined,
                conditionalclass: undefined, conditionalstyle: undefined, title: undefined,
            });
            directive['display-name'] = undefined;
            directive['widget-type'] = undefined;
            directive.populateAction();
            expect(directive.buttonDef).toMatchObject({
                displayName: '', class: '', iconclass: '', title: '', tabindex: undefined, widgetType: 'button',
                target: '', conditionalclass: '', conditionalstyle: {},
            });
        });

        it('falls back to the caption for the display name', () => {
            directive['display-name'] = undefined;
            directive.caption = 'Cap';
            directive.populateAction();
            expect(directive.buttonDef.displayName).toBe('Cap');
        });
    });

    it('registers the row action on init and releases references on destroy', () => {
        expect(table.registerRowActions).toHaveBeenCalledWith(directive.buttonDef);
        directive.ngOnDestroy();
        expect(directive.table).toBeNull();
        expect(directive.buttonDef).toBeNull();
    });
});
