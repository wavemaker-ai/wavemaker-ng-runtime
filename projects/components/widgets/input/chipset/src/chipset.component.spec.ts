import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { By } from '@angular/platform-browser';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { DatePipe } from '@angular/common';
import { AbstractI18nService, App, AppDefaults, PartialRefProvider } from '@wm/core';
import { ToDatePipe } from '@wm/components/base';
import { mockApp } from 'projects/components/base/src/test/util/component-test-util';
import { MockAbstractI18nService } from 'projects/components/base/src/test/util/date-test-util';
import { ChipsetComponent } from './chipset.component';

class TestChipsetComponent extends ChipsetComponent {
    public testHandleEvent(node: HTMLElement, eventName: string, callback: Function, locals: any) {
        this.handleEvent(node, eventName, callback, locals);
    }
}

describe('ChipsetComponent', () => {
    let component: TestChipsetComponent;
    let fixture: ComponentFixture<TestChipsetComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            declarations: [],
            imports: [FormsModule, ReactiveFormsModule, TestChipsetComponent],
            schemas: [NO_ERRORS_SCHEMA],
            providers: [
                { provide: App, useValue: mockApp },
                { provide: ToDatePipe, useClass: ToDatePipe },
                { provide: DatePipe, useClass: DatePipe },
                { provide: AppDefaults, useClass: AppDefaults },
                { provide: AbstractI18nService, useClass: MockAbstractI18nService },
                PartialRefProvider
            ]
        }).compileComponents();
    });

    beforeEach(() => {
        fixture = TestBed.createComponent(TestChipsetComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should default to single-selection mode', () => {
        expect(component.multiple).toBeFalsy();
    });

    it('should default host role to radiogroup in single-select mode', () => {
        expect(component.hostRole).toBe('radiogroup');
    });

    it('should switch host role to group in multi-select mode', () => {
        component.onPropertyChange('selectionmode', 'multiple');
        expect(component.multiple).toBeTruthy();
        expect(component.hostRole).toBe('group');
    });

    it('should clear datavalue when selectionmode changes', () => {
        component.datasetItems = [
            { key: '1', value: '1', label: 'Option 1', selected: true } as any
        ];
        component.onPropertyChange('selectionmode', 'multiple');
        expect(component.datavalue).toEqual([]);
    });

    describe('chip selection (single-select)', () => {
        beforeEach(() => {
            component.datasetItems = [
                { key: '1', value: '1', label: 'Option 1', selected: false },
                { key: '2', value: '2', label: 'Option 2', selected: false },
            ] as any;
            fixture.detectChanges();
        });

        it('should render chips based on datasetItems', () => {
            const chips = fixture.debugElement.queryAll(By.css('.chipset-chip'));
            expect(chips.length).toBe(2);
        });

        it('should select a chip on activate', () => {
            const item = component.datasetItems[0];
            component.onChipActivate({} as Event, item);
            expect(component.modelByKey).toBe('1');
            expect(item.selected).toBe(true);
        });

        it('should be a no-op re-activating an already-selected chip', () => {
            const item = component.datasetItems[0];
            item.selected = true;
            const beforeChangeSpy = jest.spyOn(component as any, 'invokeEventCallback');
            component.onChipActivate({} as Event, item);
            expect(beforeChangeSpy).not.toHaveBeenCalledWith('beforechange', expect.anything());
        });

        it('should not allow selection when disabled', () => {
            component.disabled = true;
            const item = component.datasetItems[0];
            component.onChipActivate({} as Event, item);
            expect(item.selected).toBe(false);
        });

        it('should not allow selection when readonly', () => {
            component.readonly = true;
            const item = component.datasetItems[0];
            component.onChipActivate({} as Event, item);
            expect(item.selected).toBe(false);
        });

        it('should not allow selection when the individual chip is disabled', () => {
            component.disableitem = true;
            (component as any).setupDisableItemWatchers();
            const item = component.datasetItems[0];
            component.onChipActivate({} as Event, item);
            expect(item.selected).toBe(false);
        });

        it('should cancel the change when beforechange returns false', () => {
            jest.spyOn(component as any, 'invokeEventCallback').mockImplementation((eventName: any) => {
                return eventName === 'beforechange' ? false : undefined;
            });
            const item = component.datasetItems[0];
            component.onChipActivate({} as Event, item);
            expect(item.selected).toBe(false);
        });

        it('should fire select event when a chip becomes selected', () => {
            const callbackSpy = jest.spyOn(component as any, 'invokeEventCallback');
            const item = component.datasetItems[0];
            component.onChipActivate({} as Event, item);
            expect(callbackSpy).toHaveBeenCalledWith('select', expect.objectContaining({ $item: item }));
        });

        it('should fire deselect event for the previously selected chip when switching selection', () => {
            const first = component.datasetItems[0];
            const second = component.datasetItems[1];
            component.onChipActivate({} as Event, first);

            const callbackSpy = jest.spyOn(component as any, 'invokeEventCallback');
            component.onChipActivate({} as Event, second);
            expect(callbackSpy).toHaveBeenCalledWith('deselect', expect.objectContaining({ $item: first }));
            expect(callbackSpy).toHaveBeenCalledWith('select', expect.objectContaining({ $item: second }));
        });
    });

    describe('chip selection (multi-select)', () => {
        beforeEach(() => {
            component.onPropertyChange('selectionmode', 'multiple');
            component.datasetItems = [
                { key: '1', value: '1', label: 'Option 1', selected: false },
                { key: '2', value: '2', label: 'Option 2', selected: false },
            ] as any;
            fixture.detectChanges();
        });

        it('should allow multiple chips to be selected', () => {
            component.onChipActivate({} as Event, component.datasetItems[0]);
            component.onChipActivate({} as Event, component.datasetItems[1]);
            expect(component.datasetItems[0].selected).toBe(true);
            expect(component.datasetItems[1].selected).toBe(true);
        });

        it('should deselect a selected chip on re-activation', () => {
            const item = component.datasetItems[0];
            component.onChipActivate({} as Event, item);
            expect(item.selected).toBe(true);
            component.onChipActivate({} as Event, item);
            expect(item.selected).toBe(false);
        });
    });

    describe('keyboard navigation', () => {
        beforeEach(() => {
            component.datasetItems = [
                { key: '1', value: '1', label: 'Option 1', selected: false },
                { key: '2', value: '2', label: 'Option 2', selected: false },
                { key: '3', value: '3', label: 'Option 3', selected: false },
            ] as any;
            (component as any).updateActiveItem();
            fixture.detectChanges();
        });

        it('should move active chip forward on ArrowRight', () => {
            const focusSpy = jest.spyOn(component as any, 'focusChipForItem').mockImplementation(() => {});
            const first = component.datasetItems[0];
            component.onChipKeyDown({ key: 'ArrowRight', preventDefault: () => {} } as any, first);
            expect(component.activeItem).toBe(component.datasetItems[1]);
            expect(focusSpy).toHaveBeenCalled();
        });

        it('should wrap around to the first chip on ArrowRight from the last chip', () => {
            jest.spyOn(component as any, 'focusChipForItem').mockImplementation(() => {});
            const last = component.datasetItems[2];
            component.onChipKeyDown({ key: 'ArrowRight', preventDefault: () => {} } as any, last);
            expect(component.activeItem).toBe(component.datasetItems[0]);
        });

        it('should wrap around to the last chip on ArrowLeft from the first chip', () => {
            jest.spyOn(component as any, 'focusChipForItem').mockImplementation(() => {});
            const first = component.datasetItems[0];
            component.onChipKeyDown({ key: 'ArrowLeft', preventDefault: () => {} } as any, first);
            expect(component.activeItem).toBe(component.datasetItems[2]);
        });

        it('should skip disabled chips while navigating', () => {
            jest.spyOn(component as any, 'focusChipForItem').mockImplementation(() => {});
            jest.spyOn(component, 'isChipDisabled').mockImplementation((item: any) => item.key === '2');
            const first = component.datasetItems[0];
            component.onChipKeyDown({ key: 'ArrowRight', preventDefault: () => {} } as any, first);
            expect(component.activeItem).toBe(component.datasetItems[2]);
        });

        it('should activate the chip on Enter key', () => {
            const activateSpy = jest.spyOn(component, 'onChipActivate');
            const item = component.datasetItems[0];
            component.onChipKeyDown({ key: 'Enter', preventDefault: () => {} } as any, item);
            expect(activateSpy).toHaveBeenCalledWith(expect.anything(), item);
        });

        it('should activate the chip on Space key', () => {
            const activateSpy = jest.spyOn(component, 'onChipActivate');
            const item = component.datasetItems[0];
            component.onChipKeyDown({ key: ' ', preventDefault: () => {} } as any, item);
            expect(activateSpy).toHaveBeenCalledWith(expect.anything(), item);
        });
    });

    describe('leading icon/avatar (FR-010)', () => {
        it('should have no leading visual when neither displayimagesrc nor iconclass/iconurl resolve', () => {
            component.datasetItems = [
                { key: '1', value: '1', label: 'Option 1', selected: false, dataObject: {} }
            ] as any;
            fixture.detectChanges();
            const img = fixture.debugElement.query(By.css('.chipset-chip-avatar'));
            const icon = fixture.debugElement.query(By.css('wm-app-icon'));
            expect(img).toBeNull();
            expect(icon).toBeNull();
        });

        it('should render an avatar image when the item has an imgSrc', () => {
            component.datasetItems = [
                { key: '1', value: '1', label: 'Option 1', selected: false, imgSrc: 'test.png', dataObject: {} }
            ] as any;
            fixture.detectChanges();
            const img = fixture.debugElement.query(By.css('.chipset-chip-avatar'));
            expect(img).not.toBeNull();
        });

        it('should render wm-app-icon when iconclass/iconurl resolve and no imgSrc is present', () => {
            component.iconclass = 'icon';
            component.datasetItems = [
                { key: '1', value: '1', label: 'Option 1', selected: false, dataObject: { icon: 'wi wi-star' } }
            ] as any;
            fixture.detectChanges();
            const icon = fixture.debugElement.query(By.css('wm-app-icon'));
            expect(icon).not.toBeNull();
        });

        it('should prefer the avatar image over the icon when both resolve', () => {
            component.iconclass = 'icon';
            component.datasetItems = [
                { key: '1', value: '1', label: 'Option 1', selected: false, imgSrc: 'test.png', dataObject: { icon: 'wi wi-star' } }
            ] as any;
            fixture.detectChanges();
            const img = fixture.debugElement.query(By.css('.chipset-chip-avatar'));
            const icon = fixture.debugElement.query(By.css('wm-app-icon'));
            expect(img).not.toBeNull();
            expect(icon).toBeNull();
        });
    });

    describe('disableitem', () => {
        it('should treat all chips as disabled when the static disableitem property is true', () => {
            component.disableitem = true;
            component.datasetItems = [
                { key: '1', value: '1', label: 'Option 1', selected: false }
            ] as any;
            (component as any).setupDisableItemWatchers();
            expect(component.isChipDisabled(component.datasetItems[0])).toBe(true);
        });
    });

    describe('programmatic datavalue change', () => {
        it('should fire select/deselect/change events when datavalue is set programmatically', () => {
            component.datasetItems = [
                { key: '1', value: '1', label: 'Option 1', selected: false },
                { key: '2', value: '2', label: 'Option 2', selected: false },
            ] as any;
            const callbackSpy = jest.spyOn(component as any, 'invokeEventCallback');
            component.datavalue = '1';
            expect(component.datasetItems[0].selected).toBe(true);
            expect(callbackSpy).toHaveBeenCalledWith('select', expect.objectContaining({ $item: component.datasetItems[0] }));
        });
    });
});
