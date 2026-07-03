import { DatePipe } from "@angular/common";
import { Component, ViewChild } from "@angular/core";
import { ComponentFixture, TestBed, waitForAsync } from "@angular/core/testing";
import { FormsModule } from "@angular/forms";
import { ToDatePipe } from "@wm/components/base";
import { App, AppDefaults, AbstractI18nService } from "@wm/core";
import { ITestModuleDef, ITestComponentDef, ComponentTestBase } from "projects/components/base/src/test/common-widget.specs";
import { mockApp, compileTestComponent, getHtmlSelectorElement } from "projects/components/base/src/test/util/component-test-util";
import { MockAbstractI18nService } from "projects/components/base/src/test/util/date-test-util";
import { ChipsetComponent } from "./chipset.component";
declare const _: any;

const markup = `<div wmChipset hint="chipset1" caption="Label" name="chipset1" tabindex="1"></div>`;
@Component({
    standalone: false,
    template: markup
})
class chipsetWrapperComponent {
    @ViewChild(ChipsetComponent, /* TODO: add static flag */ { static: true }) wmComponent: ChipsetComponent;
}

const chipsetModuleDef: ITestModuleDef = {
    imports: [FormsModule, ChipsetComponent],
    declarations: [chipsetWrapperComponent],
    providers: [
        { provide: App, useValue: mockApp },
        { provide: ToDatePipe, useClass: ToDatePipe },
        { provide: DatePipe, useClass: DatePipe },
        { provide: AppDefaults, useClass: AppDefaults },
        { provide: AbstractI18nService, useClass: MockAbstractI18nService }
    ]
};

const chipsetComponentDef: ITestComponentDef = {
    $unCompiled: $(markup),
    type: 'wm-chipset',
    widgetSelector: '[wmChipset]',
    testModuleDef: chipsetModuleDef,
    testComponent: chipsetWrapperComponent,
    inputElementSelector: 'li'
};

const chipsetTestBase: ComponentTestBase = new ComponentTestBase(chipsetComponentDef);
chipsetTestBase.verifyStyles();
chipsetTestBase.verifyAccessibility();

describe('Chipset component', () => {
    let wrapperComponent: chipsetWrapperComponent;
    let chipsetComponent: ChipsetComponent;
    let fixture: ComponentFixture<chipsetWrapperComponent>;

    beforeEach(waitForAsync(() => {
        fixture = compileTestComponent(chipsetModuleDef, chipsetWrapperComponent);
        wrapperComponent = fixture.componentInstance;
        chipsetComponent = wrapperComponent.wmComponent;
        fixture.detectChanges();
    }));

    it('should create chipset component', () => {
        expect(wrapperComponent).toBeTruthy();
    });

    it('should default to single-select mode with a radiogroup role', () => {
        expect(chipsetComponent.multiple).toBeFalsy();
        const el = getHtmlSelectorElement(fixture, '[wmChipset]');
        expect(el.nativeElement.getAttribute('role')).toBe('radiogroup');
    });

    it('should render a chip per dataset entry', () => {
        chipsetComponent.datasetItems = [
            { key: 'Option 1', value: 'Option 1', label: 'Option 1', selected: false },
            { key: 'Option 2', value: 'Option 2', label: 'Option 2', selected: false },
            { key: 'Option 3', value: 'Option 3', label: 'Option 3', selected: false }
        ] as any;
        fixture.detectChanges();
        const chips = fixture.debugElement.nativeElement.querySelectorAll('.chipset-chip');
        expect(chips.length).toBe(3);
    });

    it('should select a chip on click and fire onchange', () => {
        chipsetComponent.datasetItems = [
            { key: 'Option 1', value: 'Option 1', label: 'Option 1', selected: false },
            { key: 'Option 2', value: 'Option 2', label: 'Option 2', selected: false }
        ] as any;
        fixture.detectChanges();

        const changeSpy = jest.fn();
        (chipsetComponent as any).eventHandlers = new Map([['change', { callback: changeSpy, locals: {} }]]);

        const chips = fixture.debugElement.nativeElement.querySelectorAll('.chipset-chip');
        chips[0].click();
        fixture.detectChanges();

        expect(chipsetComponent.datasetItems[0].selected).toBe(true);
        expect(changeSpy).toHaveBeenCalled();
    });

    it('should switch to group role and allow multi-selection when selectionmode is multiple', () => {
        chipsetComponent.onPropertyChange('selectionmode', 'multiple');
        chipsetComponent.datasetItems = [
            { key: 'Option 1', value: 'Option 1', label: 'Option 1', selected: false },
            { key: 'Option 2', value: 'Option 2', label: 'Option 2', selected: false }
        ] as any;
        fixture.detectChanges();

        const el = getHtmlSelectorElement(fixture, '[wmChipset]');
        expect(el.nativeElement.getAttribute('role')).toBe('group');

        const chips = fixture.debugElement.nativeElement.querySelectorAll('.chipset-chip');
        chips[0].click();
        chips[1].click();
        fixture.detectChanges();

        expect(chipsetComponent.datasetItems[0].selected).toBe(true);
        expect(chipsetComponent.datasetItems[1].selected).toBe(true);
    });

    it('should not select a chip when the widget is disabled', () => {
        chipsetComponent.disabled = true;
        chipsetComponent.datasetItems = [
            { key: 'Option 1', value: 'Option 1', label: 'Option 1', selected: false }
        ] as any;
        fixture.detectChanges();

        const chips = fixture.debugElement.nativeElement.querySelectorAll('.chipset-chip');
        chips[0].click();
        fixture.detectChanges();

        expect(chipsetComponent.datasetItems[0].selected).toBeFalsy();
    });

    it('should render an avatar image when the resolved item has an imgSrc', () => {
        chipsetComponent.datasetItems = [
            { key: '1', value: '1', label: 'Option 1', selected: false, imgSrc: 'test.png', dataObject: {} }
        ] as any;
        fixture.detectChanges();
        const img = fixture.debugElement.nativeElement.querySelector('.chipset-chip-avatar');
        expect(img).not.toBeNull();
    });
});
