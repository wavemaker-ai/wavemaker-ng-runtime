import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { TableColumnGroupDirective } from './table-column-group.directive';
import { TableComponent } from '../table.component';
import { setHeaderConfigForTable } from '@wm/components/base';
import { mockApp } from 'projects/components/base/src/test/util/component-test-util';
import { App } from '@wm/core';

jest.mock('@wm/components/base', () => ({
    ...jest.requireActual('@wm/components/base'),
    setHeaderConfigForTable: jest.fn()
}));

@Component({
    standalone: false,
    template: '<div wmTableColumnGroup></div>'
})
class HostComponent { }

describe('TableColumnGroupDirective cover', () => {
    it('uses the column index when nested inside a named parent group', () => {
        const table = { headerConfig: { h: 1 }, callDataGridMethod: jest.fn() } as any;
        TestBed.configureTestingModule({
            imports: [TableColumnGroupDirective],
            declarations: [HostComponent],
            providers: [
                { provide: TableComponent, useValue: table },
                { provide: 'EXPLICIT_CONTEXT', useValue: {} },
                { provide: App, useValue: mockApp }
            ]
        });
        const fixture = TestBed.createComponent(HostComponent);
        const directive = fixture.debugElement.children[0].injector.get(TableColumnGroupDirective);
        directive.group = { name: 'parentGroup' } as any;
        directive.name = 'child';
        jest.spyOn(directive, 'getAttr').mockImplementation((k: string) => (k === 'index' ? '3' : '7') as any);
        (setHeaderConfigForTable as jest.Mock).mockClear();

        directive.ngOnInit();

        expect(setHeaderConfigForTable).toHaveBeenCalledWith(table.headerConfig, directive.config, 'parentGroup', 3);
    });

    it('falls back to an empty displayName when caption is cleared', () => {
        const table = { headerConfig: {}, callDataGridMethod: jest.fn() } as any;
        TestBed.configureTestingModule({
            imports: [TableColumnGroupDirective],
            declarations: [HostComponent],
            providers: [
                { provide: TableComponent, useValue: table },
                { provide: 'EXPLICIT_CONTEXT', useValue: {} },
                { provide: App, useValue: mockApp }
            ]
        });
        const fixture = TestBed.createComponent(HostComponent);
        const directive = fixture.debugElement.children[0].injector.get(TableColumnGroupDirective);
        directive.config = { field: 'f', displayName: 'old' };
        directive.onPropertyChange('caption', undefined);
        expect(directive.config.displayName).toBe('');
        expect(table.callDataGridMethod).toHaveBeenCalledWith('setColumnProp', 'f', 'displayName', undefined, true);
    });
});
