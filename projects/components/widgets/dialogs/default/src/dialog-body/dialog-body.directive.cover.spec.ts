import { Subject } from 'rxjs';

jest.mock('@wm/core', () => ({
    ...jest.requireActual('@wm/core'),
    setAttr: jest.fn(),
    setCSS: jest.fn(),
    addClass: jest.fn(),
}));

import { setAttr } from '@wm/core';
import { DialogBodyDirective } from './dialog-body.directive';

describe('DialogBodyDirective remaining branches', () => {
    afterEach(() => {
        document.body.innerHTML = '';
        document.body.className = '';
        jest.clearAllMocks();
    });

    it('moves only the modal-container when no backdrop exists in the microfrontend scenario', () => {
        const host = document.createElement('div');
        host.className = 'wm-app';
        const container = document.createElement('modal-container');
        document.body.appendChild(host);
        document.body.appendChild(container);
        const el = document.createElement('div');
        const onShown = new Subject<void>();
        const renderer: any = { appendChild: jest.fn() };
        new DialogBodyDirective({ nativeElement: el } as any, {} as any, { onShown } as any, renderer);
        onShown.next();
        expect(renderer.appendChild).toHaveBeenCalledTimes(1);
        expect(renderer.appendChild).toHaveBeenCalledWith(host, container);
    });

    it('skips width/tabindex/name attributes when the element is not inside an .app-dialog', () => {
        document.body.classList.add('wm-app');
        const el = document.createElement('div');
        document.body.appendChild(el);
        const onShown = new Subject<void>();
        const dialogRef: any = { width: '300px', tabindex: 0, name: 'dlg' };
        new DialogBodyDirective({ nativeElement: el } as any, dialogRef, { onShown } as any, { appendChild: jest.fn() } as any);
        onShown.next();
        expect(setAttr).not.toHaveBeenCalled();
    });

    it('tolerates the shown callback firing before the subscription handle is assigned', () => {
        document.body.classList.add('wm-app');
        const el = document.createElement('div');
        const unsubscribe = jest.fn();
        const onShown: any = { subscribe: (cb: any) => { cb(); return { unsubscribe }; } };
        let directive: any;
        expect(() => {
            directive = new DialogBodyDirective({ nativeElement: el } as any, {} as any, { onShown } as any, {} as any);
        }).not.toThrow();
        expect(unsubscribe).not.toHaveBeenCalled();
        directive.ngOnDestroy();
        expect(unsubscribe).toHaveBeenCalledTimes(1);
    });
});
