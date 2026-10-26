import { waitForAsync, ComponentFixture, TestBed } from '@angular/core/testing';
import { ChangeDetectionStrategy, Component, ViewChild } from '@angular/core';
import { By } from '@angular/platform-browser';
import { CardComponent } from './card.component';
import { MenuAdapterComponent } from '@wm/components/navigation/menu';
import { App, removeAttr, setAttr } from '@wm/core';
import { mockApp } from 'projects/components/base/src/test/util/component-test-util';

jest.mock('@wm/core', () => ({
    ...jest.requireActual('@wm/core'),
    removeAttr: jest.fn(),
    setAttr: jest.fn(),
}));

jest.mock('@wm/components/base', () => ({
    ...jest.requireActual('@wm/components/base'),
    styler: jest.fn(),
    APPLY_STYLES_TYPE: { SHELL: 'shell', INNER_SHELL: 'inner_shell' },
}));

import { styler } from '@wm/components/base';

@Component({
    standalone: false,
    // Angular 22 changed the default changeDetection strategy for components with no
    // explicit setting (see .claude/skills/angular-upgrade/patterns/runtime.md §27a).
    // Pin it here to match the pre-22 default behavior these tests rely on.
    changeDetection: ChangeDetectionStrategy.Eager,
    template: `
        <div>
            <div wmCard name="testcard" title="Test Card" subheading="Subheading"></div>
        </div>
    `
})
class CardWrapperComponent {
    @ViewChild(CardComponent, { static: true })
    cardComponent: CardComponent;
}

describe('CardComponent', () => {
    let wrapperComponent: CardWrapperComponent;
    let cardComponent: CardComponent;
    let fixture: ComponentFixture<CardWrapperComponent>;

    beforeEach(waitForAsync(() => {
        TestBed.configureTestingModule({
            imports: [CardComponent],
            declarations: [CardWrapperComponent],
            providers: [
                { provide: App, useValue: mockApp },
                { provide: 'EXPLICIT_CONTEXT', useValue: null },
            ],
        })
            .compileComponents();

        fixture = TestBed.createComponent(CardWrapperComponent);
        wrapperComponent = fixture.componentInstance;
        cardComponent = wrapperComponent.cardComponent;
        fixture.detectChanges();
    }));

    it('should create the Card Component', () => {
        expect(wrapperComponent).toBeTruthy();
        expect(cardComponent).toBeTruthy();
    });

    it('should have default host class applied', () => {
        const cardHost = fixture.debugElement.query(By.css('[wmCard]'));
        expect(cardHost.nativeElement.classList.contains('app-card')).toBe(true);
        expect(cardHost.nativeElement.classList.contains('card')).toBe(true);
        expect(cardHost.nativeElement.classList.contains('app-card')).toBe(true);
    });

    it('should call removeAttr on parent and setAttr on element in ngOnInit', () => {
        expect(removeAttr).toHaveBeenCalledWith(cardComponent.nativeElement.parentElement, 'tabindex');
        expect(setAttr).toHaveBeenCalledWith(cardComponent.nativeElement, 'tabindex', 0);
    });

    it('should set showHeader to true when title is set via onPropertyChange', () => {
        cardComponent.title = 'My Title';
        cardComponent.onPropertyChange('title', 'My Title');
        expect(cardComponent.showHeader).toBe(true);
    });

    it('should set showHeader to true when subheading is set via onPropertyChange', () => {
        cardComponent.subheading = 'My Subheading';
        cardComponent.onPropertyChange('subheading', 'My Subheading');
        expect(cardComponent.showHeader).toBe(true);
    });

    it('should set showHeader to true when iconclass is set via onPropertyChange', () => {
        cardComponent.iconclass = 'wm-sl sl-user';
        cardComponent.onPropertyChange('iconclass', 'wm-sl sl-user');
        expect(cardComponent.showHeader).toBe(true);
    });

    it('should set showHeader to true when iconurl is set via onPropertyChange', () => {
        cardComponent.iconurl = 'https://example.com/icon.png';
        cardComponent.onPropertyChange('iconurl', 'https://example.com/icon.png');
        expect(cardComponent.showHeader).toBe(true);
    });

    it('should set showHeader to true when actions is set via onPropertyChange', () => {
        cardComponent.actions = '[]';
        cardComponent.onPropertyChange('actions', '[]');
        expect(cardComponent.showHeader).toBe(true);
    });

    it('should set showHeader to false when all header-related props are empty', () => {
        cardComponent.title = '';
        cardComponent.subheading = '';
        cardComponent.iconclass = '';
        cardComponent.iconurl = '';
        cardComponent.actions = '';
        cardComponent.onPropertyChange('title', '');
        expect(cardComponent.showHeader).toBe(false);
    });

    it('should call super.onPropertyChange for non-header keys', () => {
        const superSpy = jest.spyOn(MenuAdapterComponent.prototype, 'onPropertyChange');
        cardComponent.onPropertyChange('class', 'custom-class');
        expect(superSpy).toHaveBeenCalledWith('class', 'custom-class', undefined);
    });

    it('should show header section in DOM when showHeader is true', () => {
        cardComponent.showHeader = true;
        cardComponent.title = 'Visible Title';
        fixture.detectChanges();
        const headerEl = fixture.debugElement.query(By.css('.card-header'));
        expect(headerEl).toBeTruthy();
        const headingEl = fixture.debugElement.query(By.css('.card-heading'));
        expect(headingEl?.nativeElement.textContent).toContain('Visible Title');
    });

    it('should not show header section when showHeader is false', () => {
        cardComponent.showHeader = false;
        fixture.detectChanges();
        const headerEl = fixture.debugElement.query(By.css('.card-header'));
        expect(headerEl).toBeFalsy();
    });

    it('should call styler with SHELL on host and INNER_SHELL on cardContainerWrapper in lifecycle', () => {
        expect(styler).toHaveBeenCalledWith(cardComponent.nativeElement, cardComponent, 'shell');
        expect(styler).toHaveBeenCalledWith(
            cardComponent['cardContainerElRef']?.nativeElement,
            cardComponent,
            'inner_shell'
        );
    });

    it('should set tabindex for accessibility via setAttr in ngOnInit', () => {
        expect(setAttr).toHaveBeenCalledWith(cardComponent.nativeElement, 'tabindex', 0);
    });

    describe('ngOnDestroy', () => {
        it('should remove keydown listener and clear reference', () => {
            const removeListenerSpy = jest.fn();
            cardComponent['keydownListener'] = removeListenerSpy;
            cardComponent.ngOnDestroy();
            expect(removeListenerSpy).toHaveBeenCalled();
            expect(cardComponent['keydownListener']).toBeNull();
        });

        it('should clear cardContainerElRef', () => {
            cardComponent.ngOnDestroy();
            expect(cardComponent['cardContainerElRef']).toBeNull();
        });

        it('should handle ngOnDestroy when keydownListener is not set', () => {
            cardComponent['keydownListener'] = null;
            expect(() => cardComponent.ngOnDestroy()).not.toThrow();
        });
    });

    describe('onPropertyChange header derivation', () => {
        it('should set showHeader true when only title has value', () => {
            cardComponent.title = 'Title';
            cardComponent.subheading = '';
            cardComponent.iconclass = '';
            cardComponent.iconurl = '';
            cardComponent.actions = '';
            cardComponent.onPropertyChange('title', 'Title');
            expect(cardComponent.showHeader).toBe(true);
        });

        it('should set showHeader false when title becomes empty and no other header props', () => {
            cardComponent.title = '';
            cardComponent.subheading = '';
            cardComponent.iconclass = '';
            cardComponent.iconurl = '';
            cardComponent.actions = '';
            cardComponent.onPropertyChange('title', '');
            expect(cardComponent.showHeader).toBe(false);
        });
    });
});
