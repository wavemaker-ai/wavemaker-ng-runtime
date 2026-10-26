import { DependsonDirective } from './dependson.directive';
import { Live_Operations } from '@wm/components/base';
import { DataSource } from '@wm/core';

const createMockDialogService = () => ({
    open: jest.fn(),
    close: jest.fn()
});

const createMockUnsubscribe = () => jest.fn();

const createMockApp = () => ({
    subscribe: jest.fn().mockReturnValue(createMockUnsubscribe()),
    notify: jest.fn(),
    Widgets: {} as any
});

const createMockForm = () => ({
    operationType: undefined,
    isSelected: false,
    isUpdateMode: false,
    isLayoutDialog: false,
    setFormData: jest.fn(),
    edit: jest.fn(),
    new: jest.fn()
});

const createDirective = (dialogId?: string, dependson = 'table1') => {
    const dialogService = createMockDialogService();
    const app = createMockApp();
    const directive = new DependsonDirective(dialogId as any, dependson, dialogService as any, app as any);
    return { directive, dialogService, app };
};

describe('DependsonDirective', () => {
    describe('constructor', () => {
        it('should mark the form as dialog-layout when a dialogid is provided', () => {
            const { directive } = createDirective('myDialog');
            expect((directive as any).isLayoutDialog).toBeTruthy();
            expect((directive as any).dialogId).toEqual('myDialog');
        });

        it('should not be in dialog layout when no dialogid is provided', () => {
            const { directive } = createDirective(undefined);
            expect((directive as any).isLayoutDialog).toBeFalsy();
        });

        it('should subscribe to the wm-event bus', () => {
            const { app } = createDirective();
            expect(app.subscribe).toHaveBeenCalledWith('wm-event', expect.any(Function));
        });
    });

    describe('ngAfterContentInit', () => {
        it('should use the already-projected form when present', () => {
            const { directive, app } = createDirective();
            const form = createMockForm();
            (directive as any).formChildren = { first: form, changes: { subscribe: jest.fn() } };
            directive.ngAfterContentInit();
            expect((directive as any).form).toBe(form);
            expect(app.notify).toHaveBeenCalledWith('setup-cud-listener', 'table1');
        });

        it('should listen for the form to appear later when it is not yet projected (dialog mode)', () => {
            const { directive } = createDirective();
            const changesSubscribeSpy = jest.fn();
            (directive as any).formChildren = { first: null, changes: { subscribe: changesSubscribeSpy } };
            directive.ngAfterContentInit();
            expect(changesSubscribeSpy).toHaveBeenCalled();
        });

        it('should call onFormRender once the form arrives via the changes stream', () => {
            const { directive } = createDirective('myDialog');
            let changesCallback: any;
            (directive as any).formChildren = {
                first: null,
                changes: { subscribe: (cb: any) => { changesCallback = cb; } }
            };
            const onFormRenderSpy = jest.spyOn(directive as any, 'onFormRender');
            directive.ngAfterContentInit();
            const form = createMockForm();
            changesCallback({ first: form });
            expect((directive as any).form).toBe(form);
            expect(onFormRenderSpy).toHaveBeenCalled();
        });
    });

    describe('handleEvent (via the wm-event subscription)', () => {
        it('should ignore events for a different widget', () => {
            const { directive } = createDirective();
            const form = createMockForm();
            (directive as any).form = form;
            (directive as any).handleEvent({ widgetName: 'other', eventName: Live_Operations.UPDATE, row: {} });
            expect(form.edit).not.toHaveBeenCalled();
        });

        it('should open the dialog on update in dialog mode', () => {
            const { directive, dialogService } = createDirective('myDialog');
            (directive as any).form = createMockForm();
            (directive as any).handleEvent({ widgetName: 'table1', eventName: Live_Operations.UPDATE, row: { id: 1 } });
            expect(dialogService.open).toHaveBeenCalledWith('myDialog');
        });

        it('should edit the row inline on update outside dialog mode', () => {
            const { directive } = createDirective();
            const form = createMockForm();
            (directive as any).form = form;
            (directive as any).handleEvent({ widgetName: 'table1', eventName: Live_Operations.UPDATE, row: { id: 1 } });
            expect(form.operationType).toEqual(Live_Operations.UPDATE);
            expect(form.edit).toHaveBeenCalled();
        });

        it('should open the dialog on insert in dialog mode', () => {
            const { directive, dialogService } = createDirective('myDialog');
            (directive as any).form = createMockForm();
            (directive as any).handleEvent({ widgetName: 'table1', eventName: Live_Operations.INSERT });
            expect(dialogService.open).toHaveBeenCalledWith('myDialog');
        });

        it('should create a new row inline on insert outside dialog mode', () => {
            const { directive } = createDirective();
            const form = createMockForm();
            (directive as any).form = form;
            (directive as any).handleEvent({ widgetName: 'table1', eventName: Live_Operations.INSERT });
            expect(form.operationType).toEqual(Live_Operations.INSERT);
            expect(form.new).toHaveBeenCalled();
        });

        it('should delegate delete to the dependent widget', () => {
            const { directive, app } = createDirective();
            app.Widgets.table1 = { call: jest.fn() };
            (directive as any).handleEvent({ widgetName: 'table1', eventName: Live_Operations.DELETE, row: { id: 5 } });
            expect(app.Widgets.table1.call).toHaveBeenCalledWith('delete', { row: { id: 5 } });
        });

        it('should reset update mode on read outside dialog mode', () => {
            const { directive } = createDirective();
            const form = createMockForm();
            form.isUpdateMode = true;
            (directive as any).form = form;
            (directive as any).handleEvent({ widgetName: 'table1', eventName: Live_Operations.READ });
            expect(form.isUpdateMode).toBeFalsy();
        });

        it('should not touch update mode on read inside dialog mode', () => {
            const { directive } = createDirective('myDialog');
            const form = createMockForm();
            form.isUpdateMode = true;
            (directive as any).form = form;
            (directive as any).handleEvent({ widgetName: 'table1', eventName: Live_Operations.READ });
            expect(form.isUpdateMode).toBeTruthy();
        });

        it('should re-list records on rerender when a dataSource is provided', () => {
            const { directive } = createDirective();
            const dataSource = { execute: jest.fn() };
            (directive as any).handleEvent({ widgetName: 'table1', eventName: 'rerender', dataSource });
            expect(dataSource.execute).toHaveBeenCalledWith(DataSource.Operation.LIST_RECORDS, expect.objectContaining({ operation: 'list' }));
        });

        it('should do nothing on rerender without a dataSource', () => {
            const { directive } = createDirective();
            expect(() => (directive as any).handleEvent({ widgetName: 'table1', eventName: 'rerender' })).not.toThrow();
        });

        it('should select the last row on selectedItemChange for a single-select table', () => {
            const { directive } = createDirective();
            const form = createMockForm();
            (directive as any).form = form;
            const table = { multiselect: false };
            (directive as any).handleEvent({ widgetName: 'table1', eventName: 'selectedItemChange', row: [{ id: 1 }, { id: 2 }], table });
            expect(form.setFormData).toHaveBeenCalledWith({ id: 2 });
        });

        it('should select the first row on selectedItemChange for a multiselect table', () => {
            const { directive } = createDirective();
            const form = createMockForm();
            (directive as any).form = form;
            const table = { multiselect: true };
            (directive as any).handleEvent({ widgetName: 'table1', eventName: 'selectedItemChange', row: [{ id: 1 }, { id: 2 }], table });
            expect(form.setFormData).toHaveBeenCalledWith({ id: 1 });
        });

        it('should do nothing on selectedItemChange without a table', () => {
            const { directive } = createDirective();
            const form = createMockForm();
            (directive as any).form = form;
            (directive as any).handleEvent({ widgetName: 'table1', eventName: 'selectedItemChange', row: [{ id: 1 }] });
            expect(form.setFormData).not.toHaveBeenCalled();
        });

        it('should clear the edit-mode flag on resetEditMode', () => {
            const { directive } = createDirective();
            (directive as any).editMode = true;
            (directive as any).handleEvent({ widgetName: 'table1', eventName: 'resetEditMode' });
            expect((directive as any).editMode).toBeFalsy();
        });
    });

    describe('onFormRender', () => {
        it('should do nothing when there is no form', () => {
            const { directive } = createDirective('myDialog');
            (directive as any).form = null;
            expect(() => (directive as any).onFormRender()).not.toThrow();
        });

        it('should do nothing outside dialog mode', () => {
            const { directive } = createDirective();
            (directive as any).form = createMockForm();
            expect(() => (directive as any).onFormRender()).not.toThrow();
        });

        it('should complete a pending update once the dialog form renders', () => {
            jest.useFakeTimers();
            const { directive } = createDirective('myDialog');
            const form = createMockForm();
            (directive as any).form = form;
            (directive as any).currentOp = Live_Operations.UPDATE;
            (directive as any).onFormRender();
            expect(form.isLayoutDialog).toBeTruthy();
            jest.advanceTimersByTime(250);
            expect(form.edit).toHaveBeenCalled();
            jest.useRealTimers();
        });

        it('should complete a pending insert once the dialog form renders', () => {
            jest.useFakeTimers();
            const { directive } = createDirective('myDialog');
            const form = createMockForm();
            (directive as any).form = form;
            (directive as any).currentOp = Live_Operations.INSERT;
            (directive as any).onFormRender();
            jest.advanceTimersByTime(250);
            expect(form.new).toHaveBeenCalled();
            jest.useRealTimers();
        });

        it('should do nothing after the timeout when the pending op is neither update nor insert', () => {
            jest.useFakeTimers();
            const { directive } = createDirective('myDialog');
            const form = createMockForm();
            (directive as any).form = form;
            (directive as any).currentOp = Live_Operations.READ;
            (directive as any).onFormRender();
            jest.advanceTimersByTime(250);
            expect(form.edit).not.toHaveBeenCalled();
            expect(form.new).not.toHaveBeenCalled();
            jest.useRealTimers();
        });
    });

    describe('ngOnDestroy', () => {
        it('should unsubscribe from both the form-children changes and the event bus', () => {
            const { directive } = createDirective();
            const formUnsubscribe = jest.fn();
            (directive as any).formSubscription = { unsubscribe: formUnsubscribe };
            const eventUnsubscribe = (directive as any).eventSubscription;
            directive.ngOnDestroy();
            expect(formUnsubscribe).toHaveBeenCalled();
            expect(eventUnsubscribe).toHaveBeenCalled();
        });

        it('should not throw when there is no form subscription', () => {
            const { directive } = createDirective();
            (directive as any).formSubscription = null;
            expect(() => directive.ngOnDestroy()).not.toThrow();
        });

        it('should not throw when there is no event subscription', () => {
            const { directive } = createDirective();
            (directive as any).formSubscription = null;
            (directive as any).eventSubscription = undefined;
            expect(() => directive.ngOnDestroy()).not.toThrow();
        });
    });
});
