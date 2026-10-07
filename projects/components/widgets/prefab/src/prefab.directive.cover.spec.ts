import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { By } from '@angular/platform-browser';
import { PrefabDirective } from './prefab.directive';
import { App } from '@wm/core';
import { mockApp } from 'projects/components/base/src/test/util/component-test-util';
import * as base from '@wm/components/base';

jest.mock('@wm/components/base', () => ({
    ...jest.requireActual('@wm/components/base'),
    register: jest.fn()
}));

@Component({
    standalone: false,
    template: '<section wmPrefab prefabname="cov" name="covPrefab"></section>'
})
class HostComponent { }

describe('PrefabDirective cover', () => {
    let directive: PrefabDirective;

    beforeEach(() => {
        TestBed.configureTestingModule({
            declarations: [HostComponent],
            imports: [PrefabDirective],
            providers: [{ provide: App, useValue: mockApp }, { provide: 'EXPLICIT_CONTEXT', useValue: null }]
        });
        const fixture = TestBed.createComponent(HostComponent);
        directive = fixture.debugElement.query(By.directive(PrefabDirective)).injector.get(PrefabDirective);
        fixture.detectChanges();
    });

    it('registers props only once per widget type and always resolves propsReady', () => {
        const propsReady = jest.fn();
        directive.propsReady = propsReady;
        const config = { properties: { a: { type: 'string', value: 'x' } } };
        (base.register as jest.Mock).mockClear();

        directive.setProps(config);
        directive.setProps(config);

        expect(base.register).toHaveBeenCalledTimes(1);
        expect((base.register as jest.Mock).mock.calls[0][0]).toBe('wm-prefab-cov');
        expect(propsReady).toHaveBeenCalledTimes(2);
    });

    it('prepareProps defaults to no custom props when called without arguments', () => {
        const map = (directive as any).prepareProps();
        expect(map).toBeInstanceOf(Map);
        expect(map.has('a')).toBe(false);
    });

    it('handleEvent does not register events (no-op)', () => {
        expect((directive as any).handleEvent('click', jest.fn())).toBeUndefined();
    });

    it('prepareProps maps prop types and strips bind: values', () => {
        const map = (directive as any).prepareProps({
            s: { type: 'string', value: 'v' },
            b: { type: 'boolean', value: true },
            n: { type: 'number', value: 1 },
            c: { type: 'custom', value: 'bind:foo' }
        });
        expect(map.get('s')).toEqual({ type: base.PROP_TYPE.STRING, value: 'v' });
        expect(map.get('b').type).toBe(base.PROP_TYPE.BOOLEAN);
        expect(map.get('n').type).toBe(base.PROP_TYPE.NUMBER);
        expect(map.get('c')).toEqual({ type: 'custom', value: undefined });
    });

    it('onStyleChange leaves overflow untouched for non-height keys', () => {
        const el = directive.nativeElement as HTMLElement;
        el.style.overflow = '';
        directive.onStyleChange('width', '10px', '');
        expect(el.style.overflow).toBe('');
    });
});
