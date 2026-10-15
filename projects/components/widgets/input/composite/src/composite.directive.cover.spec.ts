import { ComponentFixture } from '@angular/core/testing';
import { Component, ViewChild } from '@angular/core';
import { CompositeDirective } from './composite.directive';
import { App } from '@wm/core';
import { WidgetRef } from '@wm/components/base';
import { compileTestComponent, mockApp } from 'projects/components/base/src/test/util/component-test-util';

@Component({
    standalone: false,
    template: `<div wmComposite name="compositeCover" captionposition="left"></div>`
})
class CompositeCoverWrapperComponent {
    @ViewChild(CompositeDirective, { static: true }) wmComponent: CompositeDirective;
}

const moduleDef = {
    declarations: [CompositeCoverWrapperComponent],
    providers: [
        { provide: App, useValue: mockApp },
        { provide: WidgetRef, useValue: { widget: {} } }
    ],
    imports: [CompositeDirective],
};

describe('CompositeDirective: coverage gaps', () => {
    let fixture: ComponentFixture<CompositeCoverWrapperComponent>;
    let component: any;

    beforeEach(() => {
        fixture = compileTestComponent(moduleDef, CompositeCoverWrapperComponent);
        component = fixture.componentInstance.wmComponent;
        fixture.detectChanges();
    });

    afterEach(() => jest.useRealTimers());

    it('does not touch sub components that were released before the delayed required assignment', () => {
        jest.useFakeTimers();
        const ref = { widget: { required: false } };
        component.componentRefs = [ref];
        component.required = true;
        component.assignRequiredToSubComponents();
        component.componentRefs = null;
        jest.advanceTimersByTime(60);
        expect(ref.widget.required).toBe(false);
    });

    it('does not schedule anything when the component is not required', () => {
        jest.useFakeTimers();
        const ref = { widget: { required: false } };
        component.componentRefs = [ref];
        component.required = false;
        component.assignRequiredToSubComponents();
        jest.advanceTimersByTime(60);
        expect(ref.widget.required).toBe(false);
    });

    it('destroys cleanly without sub component references', () => {
        component.componentRefs = null;
        expect(() => component.ngOnDestroy()).not.toThrow();
        expect(component.componentRefs).toBeNull();
    });
});
