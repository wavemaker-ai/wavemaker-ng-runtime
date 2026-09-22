import { Subject } from 'rxjs';

jest.mock('@wm/core', () => ({
    ...jest.requireActual('@wm/core'),
    setAttr: jest.fn(),
    setCSS: jest.fn(),
    addClass: jest.fn(),
}));

import { setAttr, setCSS, addClass } from '@wm/core';
import { DialogBodyDirective } from './dialog-body.directive';

const createDom = () => {
    const appDialog = document.createElement('div');
    appDialog.className = 'app-dialog';
    const modalContent = document.createElement('div');
    modalContent.className = 'modal-content';
    const dialogBodyEl = document.createElement('div');
    modalContent.appendChild(dialogBodyEl);
    appDialog.appendChild(modalContent);
    document.body.appendChild(appDialog);
    return { appDialog, modalContent, dialogBodyEl };
};

const createDirective = (dialogBodyEl: HTMLElement, dialogRefOverrides: any = {}) => {
    const onShown = new Subject<void>();
    const bsModal: any = { onShown };
    const dialogRef: any = {
        sheet: false,
        sheetPosition: undefined,
        animation: undefined,
        width: undefined,
        height: undefined,
        tabindex: undefined,
        name: undefined,
        ...dialogRefOverrides,
    };
    const renderer: any = { appendChild: jest.fn() };
    const elRef: any = { nativeElement: dialogBodyEl };
    const directive = new DialogBodyDirective(elRef, dialogRef, bsModal, renderer);
    return { directive, onShown, dialogRef, renderer };
};

describe('DialogBodyDirective', () => {
    afterEach(() => {
        document.body.innerHTML = '';
        document.body.className = '';
        jest.clearAllMocks();
    });

    it('should add the default dialog-body classes on construction', () => {
        const { dialogBodyEl } = createDom();
        createDirective(dialogBodyEl);
        expect(addClass).toHaveBeenCalledWith(dialogBodyEl, 'app-dialog-body modal-body');
    });

    it('should not react before the modal has shown', () => {
        const { dialogBodyEl, appDialog } = createDom();
        createDirective(dialogBodyEl);
        expect(appDialog.classList.contains('modal-sheet')).toBe(false);
    });

    it('should add sheet classes to the dialog root when configured as a sheet', () => {
        const { dialogBodyEl, appDialog } = createDom();
        const { onShown } = createDirective(dialogBodyEl, { sheet: true, sheetPosition: 'bottom' });
        onShown.next();
        expect(appDialog.classList.contains('modal-sheet')).toBe(true);
        expect(appDialog.classList.contains('sheet-position-bottom')).toBe(true);
    });

    it('should not add sheet classes when sheet is falsy', () => {
        const { dialogBodyEl, appDialog } = createDom();
        const { onShown } = createDirective(dialogBodyEl, { sheet: false });
        onShown.next();
        expect(appDialog.classList.contains('modal-sheet')).toBe(false);
    });

    it('should add the animation classes to the modal content when an animation is configured', () => {
        const { dialogBodyEl, modalContent } = createDom();
        const { onShown } = createDirective(dialogBodyEl, { animation: 'fadeIn' });
        onShown.next();
        expect(modalContent.classList.contains('animated')).toBe(true);
        expect(modalContent.classList.contains('fadeIn')).toBe(true);
    });

    it('should not touch the modal content classes when no animation is configured', () => {
        const { dialogBodyEl, modalContent } = createDom();
        const { onShown } = createDirective(dialogBodyEl);
        onShown.next();
        expect(modalContent.classList.contains('animated')).toBe(false);
    });

    it('should set the dialog root width, tabindex and name when the dialog root exists', () => {
        const { dialogBodyEl, appDialog } = createDom();
        const { onShown, dialogRef } = createDirective(dialogBodyEl, { width: '400px', tabindex: 2, name: 'myDialog' });
        onShown.next();
        expect(setCSS).toHaveBeenCalledWith(appDialog, 'width', '400px');
        expect(setAttr).toHaveBeenCalledWith(appDialog, 'tabindex', dialogRef.tabindex);
        expect(setAttr).toHaveBeenCalledWith(appDialog, 'name', dialogRef.name);
    });

    it('should not set width when width is not configured', () => {
        const { dialogBodyEl } = createDom();
        const { onShown } = createDirective(dialogBodyEl);
        onShown.next();
        expect(setCSS).not.toHaveBeenCalled();
    });

    it('should schedule the height css update asynchronously when height is configured', (done) => {
        const { dialogBodyEl } = createDom();
        const { onShown } = createDirective(dialogBodyEl, { height: '300px' });
        onShown.next();
        expect(setCSS).not.toHaveBeenCalledWith(dialogBodyEl, 'height', '300px');
        setTimeout(() => {
            expect(setCSS).toHaveBeenCalledWith(dialogBodyEl, 'height', '300px');
            done();
        }, 0);
    });

    it('should unsubscribe from onShown after the first emission', () => {
        const { dialogBodyEl, appDialog } = createDom();
        const { onShown } = createDirective(dialogBodyEl, { sheet: true, sheetPosition: 'top' });
        onShown.next();
        appDialog.classList.remove('sheet-position-top');
        onShown.next();
        expect(appDialog.classList.contains('sheet-position-top')).toBe(false);
    });

    it('should move an existing modal-backdrop and modal-container under a .wm-app host when the microfrontend body class is missing', () => {
        const { dialogBodyEl } = createDom();

        const wmAppHost = document.createElement('div');
        wmAppHost.className = 'wm-app';
        document.body.appendChild(wmAppHost);

        const backdrop = document.createElement('div');
        backdrop.className = 'modal-backdrop';
        document.body.appendChild(backdrop);

        const parentContainer = document.createElement('modal-container');
        document.body.appendChild(parentContainer);

        const { onShown, renderer } = createDirective(dialogBodyEl);
        onShown.next();

        expect(renderer.appendChild).toHaveBeenCalledWith(wmAppHost, backdrop);
        expect(renderer.appendChild).toHaveBeenCalledWith(wmAppHost, parentContainer);
    });

    it('should do nothing for the microfrontend branch when body already has the wm-app class', () => {
        const { dialogBodyEl } = createDom();
        document.body.classList.add('wm-app');

        const { onShown, renderer } = createDirective(dialogBodyEl);
        onShown.next();

        expect(renderer.appendChild).not.toHaveBeenCalled();
    });

    it('should do nothing for the microfrontend branch when no .wm-app host exists anywhere', () => {
        const { dialogBodyEl } = createDom();

        const backdrop = document.createElement('div');
        backdrop.className = 'modal-backdrop';
        document.body.appendChild(backdrop);
        const parentContainer = document.createElement('modal-container');
        document.body.appendChild(parentContainer);

        const { onShown, renderer } = createDirective(dialogBodyEl);
        onShown.next();

        expect(renderer.appendChild).not.toHaveBeenCalled();
    });

    describe('ngOnDestroy', () => {
        it('should clear the dialogRef reference', () => {
            const { dialogBodyEl } = createDom();
            const { directive } = createDirective(dialogBodyEl);
            directive.ngOnDestroy();
            expect((directive as any).dialogRef).toBeNull();
        });

        it('should be a no-op to destroy twice', () => {
            const { dialogBodyEl } = createDom();
            const { directive } = createDirective(dialogBodyEl);
            directive.ngOnDestroy();
            expect(() => directive.ngOnDestroy()).not.toThrow();
        });

        it('should be a no-op to destroy after the subscription already completed on its own', () => {
            const { dialogBodyEl } = createDom();
            const { directive, onShown } = createDirective(dialogBodyEl, { sheet: true, sheetPosition: 'top' });
            onShown.next();
            expect(() => directive.ngOnDestroy()).not.toThrow();
        });
    });
});
