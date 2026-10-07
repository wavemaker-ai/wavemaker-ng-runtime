import { TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { App, UserDefinedExecutionContext } from '@wm/core';
import { mockApp } from 'projects/components/base/src/test/util/component-test-util';
import { MenuDropdownComponent } from './menu-dropdown.component';
import { MenuComponent } from '../menu.component';

describe('MenuDropdownComponent (cover)', () => {
    const create = (menu: any) => {
        TestBed.configureTestingModule({
            imports: [MenuDropdownComponent],
            providers: [
                { provide: App, useValue: mockApp },
                UserDefinedExecutionContext,
                { provide: MenuComponent, useValue: { nativeElement: document.createElement('div'), setMenuPosition: jest.fn(), menualign: 'left', ...menu } }
            ],
            schemas: [NO_ERRORS_SCHEMA]
        });
        const fixture = TestBed.createComponent(MenuDropdownComponent);
        fixture.componentInstance.items = [];
        fixture.detectChanges();
        return fixture.componentInstance;
    };

    afterEach(() => TestBed.resetTestingModule());

    it('should not add animation classes when animateitems is not set', () => {
        const cmp: any = create({ animateitems: '', menuposition: 'down,right' });
        expect(cmp.nativeElement.classList.contains('animated')).toBe(false);
        expect(cmp.nativeElement.classList.contains('left')).toBe(true);
    });

    it('should fall back to the default animation name for an unknown menu position', () => {
        const cmp: any = create({ animateitems: 'scale', menuposition: 'sideways' });
        expect(cmp.nativeElement.classList.contains('animated')).toBe(true);
        expect(cmp.nativeElement.classList.contains('wmScaleInLeft')).toBe(true);
    });

    it('should default the position to "up,right" when the menu position has a single part', () => {
        const cmp: any = create({ animateitems: 'fade', menuposition: 'down' });
        const grand = document.createElement('div');
        const parent = document.createElement('div');
        grand.appendChild(parent);
        parent.appendChild(cmp.nativeElement);
        cmp.hasExecutedCallback = false;
        cmp.callback([{ isIntersecting: false }], null);
        expect(cmp.menuRef.menuposition).toBe('up,right');
        expect(cmp.menuRef.setMenuPosition).toHaveBeenCalled();
        expect(parent.classList.contains('dropup')).toBe(true);
    });
});
