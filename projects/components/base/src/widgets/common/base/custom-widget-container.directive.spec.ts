import { CustomWidgetContainerDirective } from './custom-widget-container.directive';
import { ComponentType } from '@wm/core';

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe('CustomWidgetContainerDirective', () => {
    let componentInstance: any;
    let vcRef: any;
    let elRef: any;
    let inj: any;
    let envInjector: any;
    let app: any;
    let customWidgetRefProvider: any;
    let nativeElement: HTMLElement;
    let componentRefNativeElement: HTMLElement;
    let consoleErrorSpy: jest.SpyInstance;

    const create = (widgetname: string) => new CustomWidgetContainerDirective(
        componentInstance,
        vcRef,
        elRef,
        inj,
        envInjector,
        app,
        widgetname,
        customWidgetRefProvider
    );

    beforeEach(() => {
        componentInstance = {};
        nativeElement = document.createElement('div');
        componentRefNativeElement = document.createElement('span');
        elRef = { nativeElement };
        inj = {};
        envInjector = {};
        app = {};
        vcRef = {
            createComponent: jest.fn().mockReturnValue({
                location: { nativeElement: componentRefNativeElement }
            }),
            clear: jest.fn()
        };
        customWidgetRefProvider = {
            getComponentFactoryRef: jest.fn().mockResolvedValue(function FakeWidgetComponent() {})
        };
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    });

    afterEach(() => {
        consoleErrorSpy.mockRestore();
    });

    it('should log an error and skip loading when widgetname is not provided', async () => {
        create('');
        await flush();

        expect(consoleErrorSpy).toHaveBeenCalledWith('Custom widget name is required');
        expect(vcRef.createComponent).not.toHaveBeenCalled();
    });

    it('should resolve the component factory and append it to the native element', async () => {
        create('myCustomWidget');
        await flush();

        expect(customWidgetRefProvider.getComponentFactoryRef).toHaveBeenCalledWith('myCustomWidget', ComponentType.WIDGET);
        expect(vcRef.createComponent).toHaveBeenCalledWith(expect.any(Function), {
            index: 0,
            environmentInjector: envInjector,
            injector: inj
        });
        expect(nativeElement.contains(componentRefNativeElement)).toBe(true);
    });

    it('should log an error when the component factory could not be resolved', async () => {
        customWidgetRefProvider.getComponentFactoryRef.mockResolvedValue(undefined);
        create('missingWidget');
        await flush();

        expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to load custom widget: missingWidget');
        expect(vcRef.createComponent).not.toHaveBeenCalled();
    });

    it('should log an error when loading the widget throws', async () => {
        const error = new Error('boom');
        customWidgetRefProvider.getComponentFactoryRef.mockRejectedValue(error);
        create('erroringWidget');
        await flush();

        expect(consoleErrorSpy).toHaveBeenCalledWith('Error creating custom widget erroringWidget:', error);
    });

    describe('ngOnDestroy', () => {
        it('should clear the view container and release the element reference', async () => {
            const directive = create('myCustomWidget');
            await flush();

            directive.ngOnDestroy();

            expect(vcRef.clear).toHaveBeenCalled();
            expect(directive.elRef).toBeNull();
        });

        it('should not throw when the view container reference is already gone', async () => {
            const directive = create('myCustomWidget');
            await flush();
            directive.vcRef = null;

            expect(() => directive.ngOnDestroy()).not.toThrow();
        });
    });
});
