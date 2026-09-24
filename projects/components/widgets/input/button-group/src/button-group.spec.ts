import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChangeDetectionStrategy, Component, DebugElement, Injector } from '@angular/core';
import { By } from '@angular/platform-browser';
import { ButtonGroupDirective } from './button-group.directive';
import { App } from '@wm/core';
import { mockApp } from 'projects/components/base/src/test/util/component-test-util';

@Component({
    standalone: false,
    // Angular 22 changed the default changeDetection strategy for components with no
    // explicit setting (see .claude/skills/angular-upgrade/patterns/runtime.md §27a).
    // This inline test component was never swept by that fix, so it silently picked up
    // the new default, and a second fixture.detectChanges() stopped re-checking it.
    changeDetection: ChangeDetectionStrategy.Eager,
    template: `
      <div wmButtonGroup>
        <button class="app-button">Button 1</button>
        <button class="app-button">Button 2</button>
        <button class="app-button">Button 3</button>
      </div>
    `
})
class TestComponent { }

describe('ButtonGroupDirective', () => {
    let fixture: ComponentFixture<TestComponent>;
    let buttonGroupElement: DebugElement;
    let buttonGroupDirective: ButtonGroupDirective;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [ButtonGroupDirective],
            declarations: [TestComponent,],
            providers: [Injector,
                { provide: App, useValue: mockApp },
            ]
        }).compileComponents();

        fixture = TestBed.createComponent(TestComponent);
        buttonGroupElement = fixture.debugElement.query(By.directive(ButtonGroupDirective));
        buttonGroupDirective = buttonGroupElement.injector.get(ButtonGroupDirective);
        fixture.detectChanges();
    });

    it('should create an instance', () => {
        expect(buttonGroupDirective).toBeTruthy();
    });

    it('should apply vertical class when vertical property is set', () => {
        buttonGroupDirective.vertical = true;
        fixture.detectChanges();
        expect(buttonGroupElement.nativeElement.classList.contains('btn-group-vertical')).toBeTruthy();
    });

    it('should select a button on click', () => {
        const buttons = buttonGroupElement.queryAll(By.css('.app-button'));
        buttons[1].nativeElement.click();
        fixture.detectChanges();
        expect(buttons[1].nativeElement.classList.contains('selected')).toBeTruthy();
    });

    it('should deselect previously selected button when a new button is clicked', () => {
        const buttons = buttonGroupElement.queryAll(By.css('.app-button'));
        buttons[0].nativeElement.click();
        fixture.detectChanges();
        expect(buttons[0].nativeElement.classList.contains('selected')).toBeTruthy();

        buttons[2].nativeElement.click();
        fixture.detectChanges();
        expect(buttons[0].nativeElement.classList.contains('selected')).toBeFalsy();
        expect(buttons[2].nativeElement.classList.contains('selected')).toBeTruthy();
    });
});