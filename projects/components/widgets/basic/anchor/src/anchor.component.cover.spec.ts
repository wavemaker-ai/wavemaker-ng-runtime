import { Component, ViewChild } from '@angular/core';
import { ComponentFixture } from '@angular/core/testing';
import { App } from '@wm/core';
import { compileTestComponent, mockApp } from 'projects/components/base/src/test/util/component-test-util';
import { AnchorComponent } from './anchor.component';
import { ITestModuleDef } from '../../../../base/src/test/common-widget.specs';

@Component({
    standalone: false,
    template: '<a wmAnchor name="coverAnchor" hyperlink="http://x.com"></a>',
})
class HostComponent {
    @ViewChild(AnchorComponent, { static: true }) wmComponent: AnchorComponent;
}

const moduleDef: ITestModuleDef = {
    imports: [AnchorComponent],
    declarations: [HostComponent],
    providers: [{ provide: App, useValue: mockApp }],
};

describe('AnchorComponent - cover', () => {
    let fixture: ComponentFixture<HostComponent>;
    let anchor: any;

    beforeEach(() => {
        fixture = compileTestComponent(moduleDef, HostComponent);
        anchor = fixture.componentInstance.wmComponent;
        fixture.detectChanges();
    });

    afterEach(() => jest.restoreAllMocks());

    describe('processEventAttr', () => {
        it('flags navigation to the current page', () => {
            (anchor.inj.get(App) as any).activePageName = 'Home';
            anchor.processEventAttr('click', 'Actions.goToPage_Other.invoke(); Actions.goToPage_Home.invoke()');
            expect(anchor.hasNavigationToCurrentPageExpr).toBe(true);
            expect(anchor.goToPageName).toBe('Other');
        });

        it('keeps the first target page when several go to page calls exist', () => {
            (anchor.inj.get(App) as any).activePageName = 'Home';
            anchor.hasGoToPageExpr = false;
            anchor.hasNavigationToCurrentPageExpr = false;
            anchor.processEventAttr('click', 'Actions.goToPage_A.invoke(); Actions.goToPage_B.invoke()');
            expect(anchor.hasGoToPageExpr).toBe(true);
            expect(anchor.goToPageName).toBe('A');
            expect(anchor.hasNavigationToCurrentPageExpr).toBeFalsy();
        });

        it('does not re-evaluate once navigation to the current page is known', () => {
            anchor.hasNavigationToCurrentPageExpr = true;
            anchor.hasGoToPageExpr = false;
            anchor.processEventAttr('click', 'Actions.goToPage_Z.invoke()');
            expect(anchor.hasGoToPageExpr).toBe(false);
        });

        it('ignores expressions that are not navigation calls', () => {
            anchor.hasGoToPageExpr = false;
            anchor.processEventAttr('click', 'Variables.x.invoke()');
            expect(anchor.hasGoToPageExpr).toBeFalsy();
        });
    });

    describe('ngAfterViewInit', () => {
        it('cancels a previous highlight subscription before subscribing again', () => {
            const cancelOld = jest.fn();
            const cancelNew = jest.fn();
            anchor.hasGoToPageExpr = true;
            anchor.cancelSubscription = cancelOld;
            jest.spyOn(anchor.app, 'subscribe').mockReturnValue(cancelNew);
            anchor.ngAfterViewInit();
            expect(cancelOld).toHaveBeenCalledTimes(1);
            expect(anchor.cancelSubscription).toBe(cancelNew);
        });
    });

    describe('ngOnDestroy', () => {
        it('copes with a missing native element', () => {
            const el = anchor.nativeElement;
            Object.defineProperty(anchor, 'nativeElement', { value: undefined, configurable: true });
            expect(() => anchor.ngOnDestroy()).not.toThrow();
            Object.defineProperty(anchor, 'nativeElement', { value: el, configurable: true });
        });
    });
});
