import { Component, ViewChild } from '@angular/core';
import { App, isInsecureContentRequest } from '@wm/core';
import { StylableComponent } from '@wm/components/base';
import { TrustAsPipe } from '@wm/components/base';
import { compileTestComponent, mockApp } from 'projects/components/base/src/test/util/component-test-util';
import { IframeComponent } from './iframe.component';

jest.mock('@wm/core', () => {
    const actual = jest.requireActual('@wm/core');
    return { ...actual, isInsecureContentRequest: jest.fn(actual.isInsecureContentRequest) };
});

@Component({
    standalone: false,
    template: `<div wmIframe name="iframeExtra" iframesrc="//example.com"></div>`
})
class IframeExtraHost {
    @ViewChild(IframeComponent, { static: true }) wmComponent: IframeComponent;
}

const moduleDef = {
    imports: [IframeComponent],
    declarations: [IframeExtraHost],
    providers: [
        { provide: App, useValue: { ...mockApp } },
        { provide: TrustAsPipe, useClass: TrustAsPipe }
    ]
};

describe('IframeComponent extra coverage', () => {
    let fixture;
    let iframe: IframeComponent;

    beforeEach(() => {
        fixture = compileTestComponent(moduleDef, IframeExtraHost);
        iframe = fixture.componentInstance.wmComponent;
        fixture.detectChanges();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('clears the source when iframesrc is empty', () => {
        iframe.iframesrc = '';
        iframe.onPropertyChange('iframesrc', '');
        expect(iframe._iframesrc).toBeUndefined();
        expect(iframe.showContentLoadError).toBe(false);
    });

    it('encodes the url when encodeurl is set', () => {
        const transform = jest.spyOn((iframe as any).trustAsPipe, 'transform');
        iframe.iframesrc = 'https://example.com/a b';
        iframe.encodeurl = true;
        iframe.onPropertyChange('encodeurl', true);
        expect(transform).toHaveBeenCalledWith('https://example.com/a%20b', expect.anything());
        expect(iframe.showContentLoadError).toBe(false);
    });

    it('flags insecure content and sets the error message', () => {
        (iframe as any).appLocale = { MESSAGE_ERROR_CONTENT_DISPLAY: 'Cannot display' };
        iframe.iframesrc = 'http://insecure.example.com';
        (isInsecureContentRequest as jest.Mock).mockReturnValueOnce(true);
        iframe.onPropertyChange('iframesrc', iframe.iframesrc);
        expect(iframe.showContentLoadError).toBe(true);
        expect((iframe as any).errorMsg).toBe('Cannot display http://insecure.example.com');
        expect((iframe as any).hintMsg).toBe((iframe as any).errorMsg);
        expect(iframe._iframesrc).toBeDefined();
    });

    it('delegates other keys to the parent', () => {
        const spy = jest.spyOn(StylableComponent.prototype as any, 'onPropertyChange');
        iframe.onPropertyChange('hint', 'hello');
        expect(spy).toHaveBeenCalledWith('hint', 'hello', undefined);
        spy.mockRestore();
    });
});
