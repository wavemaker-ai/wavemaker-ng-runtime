import { ElementRef, Injector } from '@angular/core';
import { App } from '@wm/core';
import { ItemTemplateDirective } from './item-template.directive';
import { StylableComponent } from '../base/stylable.component';
import { mockApp } from '../../../test/util/component-test-util';

describe('ItemTemplateDirective - cover', () => {
    let directive: any;

    beforeEach(() => {
        const el = document.createElement('div');
        const inj: any = {
            get: jest.fn((token) => (token === ElementRef ? { nativeElement: el } : token === App ? mockApp : null)),
            _lView: [null, null, null, null, null, null, null, null, { index: 3, $implicit: 'x' }],
            _tNode: { attrs: [] },
        };
        directive = new ItemTemplateDirective(inj as Injector, { nativeElement: el } as ElementRef, mockApp as unknown as App, null);
        jest.spyOn(StylableComponent.prototype, 'ngOnDestroy').mockImplementation(() => undefined);
    });

    afterEach(() => jest.restoreAllMocks());

    it('releases all references on destroy', () => {
        const context = directive.context;
        const params = { item: { a: 1 }, other: 2 };
        directive.partialParams = params;
        directive.userComponentParams = { dataObject: {} };
        directive.content = 'content';
        directive.viewContainerRef = {} as any;

        directive.ngOnDestroy();

        expect(Object.keys(context)).toHaveLength(0);
        expect(directive.context).toBeNull();
        expect(Object.keys(params)).toHaveLength(0);
        expect(directive.partialParams).toBeNull();
        expect(directive.userComponentParams).toBeNull();
        expect(directive.content).toBeNull();
        expect(directive.viewContainerRef).toBeNull();
        expect(StylableComponent.prototype.ngOnDestroy).toHaveBeenCalled();
    });

    it('destroys cleanly when the context and partial params are already gone', () => {
        directive.context = null;
        directive.partialParams = undefined;
        expect(() => directive.ngOnDestroy()).not.toThrow();
        expect(directive.context).toBeNull();
        expect(directive.partialParams).toBeUndefined();
    });
});
