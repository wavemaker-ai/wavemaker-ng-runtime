import { ComponentFixture, waitForAsync } from '@angular/core/testing';
import { Component, ViewChild } from '@angular/core';
import { CircleProgressOptions } from 'ng-circle-progress';
import { FormsModule } from '@angular/forms';
import { App } from '@wm/core';
import { provideAsWidgetRef } from '@wm/components/base';
import { ITestModuleDef } from 'projects/components/base/src/test/common-widget.specs';
import { compileTestComponent, mockApp } from 'projects/components/base/src/test/util/component-test-util';
import { ProgressCircleComponent } from './progress-circle.component';

@Component({
    standalone: false,
    template: `<div wmProgressCircle name="coverCircle" tabindex="1"></div>`
})
class CoverCircleWrapper {
    @ViewChild(ProgressCircleComponent, { static: true }) wmComponent: ProgressCircleComponent;
}

const moduleDef: ITestModuleDef = {
    imports: [FormsModule, ProgressCircleComponent],
    declarations: [CoverCircleWrapper],
    providers: [
        { provide: App, useValue: mockApp },
        provideAsWidgetRef(ProgressCircleComponent),
        { provide: CircleProgressOptions, useValue: CircleProgressOptions }
    ]
};

describe('ProgressCircleComponent - cover branches', () => {
    let fixture: ComponentFixture<CoverCircleWrapper>;
    let cmp: any;

    beforeEach(waitForAsync(() => {
        fixture = compileTestComponent(moduleDef, CoverCircleWrapper);
        cmp = fixture.componentInstance.wmComponent;
        fixture.detectChanges();
    }));

    afterEach(() => jest.restoreAllMocks());

    it('appends the percent sign to the rendered value when units are shown', () => {
        jest.spyOn(cmp.circleRef, 'render').mockImplementation(() => undefined);
        $(cmp.nativeElement).append('<svg><text><tspan>40</tspan></text></svg>');
        cmp.options.showUnits = true;
        cmp._redraw();
        expect(cmp.displayValue).toBe('40%');
        cmp.options.showUnits = false;
        cmp._redraw();
        expect(cmp.displayValue).toBe('40');
    });

    it('does not show title and subtitle unless the caption is inside', () => {
        cmp.redraw = jest.fn();
        cmp.captionplacement = 'bottom';
        cmp.options.title = 'untouched';
        cmp.updateDisplayValueFormat();
        expect(cmp.options.showTitle).toBe(false);
        expect(cmp.options.showSubtitle).toBe(false);
        expect(cmp.options.title).toBe('untouched');
        expect(cmp.redraw).toHaveBeenCalled();
    });

    it('destroys when the redraw function cannot be cancelled', () => {
        cmp.redraw = jest.fn();
        expect(() => cmp.ngOnDestroy()).not.toThrow();
        expect(cmp.redraw).toBeNull();
        expect(cmp.circleRef).toBeNull();
    });
});
