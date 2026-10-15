import { TestBed } from '@angular/core/testing';
import { App } from '@wm/core';
import { LazyLoadDirective } from './lazy-load.directive';

describe('LazyLoadDirective (cover)', () => {
    afterEach(() => {
        TestBed.resetTestingModule();
    });

    it('should resolve App through inject() when no injector is supplied (and then fail on the missing lView)', () => {
        const app = { name: 'injectedApp' };
        TestBed.configureTestingModule({ providers: [{ provide: App, useValue: app }] });
        TestBed.runInInjectionContext(() => {
            expect(() => new LazyLoadDirective(null as any, {} as any, {} as any)).toThrow(TypeError);
        });
    });
});
