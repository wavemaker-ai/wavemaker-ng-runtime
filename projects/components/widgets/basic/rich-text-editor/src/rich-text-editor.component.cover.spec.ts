import { ComponentFixture } from '@angular/core/testing';
import { Component, ViewChild } from '@angular/core';
import { RichTextEditorComponent } from './rich-text-editor.component';
import { compileTestComponent, mockApp } from '../../../../base/src/test/util/component-test-util';
import { ITestModuleDef } from '../../../../base/src/test/common-widget.specs';
import { SanitizePipe } from '@wm/components/base';
import 'summernote/dist/summernote-lite.min.js';
import { App } from '@wm/core';

jest.setTimeout(60000);

const markup = `<div wmRichTextEditor name="rte_cover"></div>`;

@Component({
    standalone: false,
    template: markup
})
class HostComponent {
    @ViewChild(RichTextEditorComponent, { static: true }) wmComponent: RichTextEditorComponent;
}

const moduleDef: ITestModuleDef = {
    declarations: [HostComponent],
    imports: [RichTextEditorComponent],
    providers: [
        { provide: App, useValue: mockApp },
        { provide: SanitizePipe, useClass: SanitizePipe }
    ]
};

describe('RichTextEditorComponent cover', () => {
    let fixture: ComponentFixture<HostComponent>;
    let cmp: RichTextEditorComponent;

    beforeEach(() => {
        fixture = compileTestComponent(moduleDef, HostComponent);
        cmp = fixture.componentInstance.wmComponent;
        fixture.detectChanges();
    });

    it('overridden summernote button factory adds the bs3 "btn" class in its callback', () => {
        const btn = ($ as any).summernote.ui_template.button({ contents: 'x' });
        expect(typeof btn.callback).toBe('function');
        const $node = $('<button></button>');
        btn.callback($node, {});
        expect($node.hasClass('btn')).toBe(true);
    });

    it('datavalue setter ignores null and undefined', () => {
        const spy = jest.spyOn(cmp, 'performEditorOperation');
        cmp.datavalue = undefined;
        cmp.datavalue = null;
        expect(spy).not.toHaveBeenCalled();
    });

    it('enables the editor when disabled/readonly turn false and disables when true', () => {
        const spy = jest.spyOn(cmp, 'performEditorOperation');
        cmp.onPropertyChange('disabled', false);
        expect(spy).toHaveBeenLastCalledWith('enable');
        cmp.onPropertyChange('readonly', true);
        expect(spy).toHaveBeenLastCalledWith('disable');
    });

    it('placeholder change is forwarded to the editor', () => {
        const spy = jest.spyOn(cmp, 'performEditorOperation');
        cmp.onPropertyChange('placeholder', 'type here');
        expect(spy).toHaveBeenCalledWith('placeholder', 'type here');
    });

    it('onStyleChange only reacts to height', () => {
        const spy = jest.spyOn(cmp, 'performEditorOperation');
        cmp.onStyleChange('width', '10px', '');
        expect(spy).not.toHaveBeenCalled();
        cmp.onStyleChange('height', '200px', '');
        expect(spy).toHaveBeenCalledWith('height', '200px');
    });

    it('onChange falls back to document.createEvent when the Event constructor is unavailable', () => {
        const OrigEvent = (global as any).Event;
        const createSpy = jest.spyOn(document, 'createEvent');
        const invokeSpy = jest.spyOn(cmp as any, 'invokeOnChange').mockImplementation(() => {});
        (global as any).Event = undefined;
        try {
            cmp.EDITOR_DEFAULT_OPTIONS.callbacks.onChange('<p>a</p>', null);
        } finally {
            (global as any).Event = OrigEvent;
        }
        expect(createSpy).toHaveBeenCalledWith('Event');
        const evt = invokeSpy.mock.calls[0][1] as any;
        expect(evt.type).toBe('change');
        expect(evt.bubbles).toBe(true);
    });
});
