import { LiveActionsDirective } from './live-actions.directive';
import { Live_Operations } from '@wm/components/base';

jest.mock('@wm/components/base', () => ({
    ...jest.requireActual('@wm/components/base'),
    performDataOperation: jest.fn()
}));

import { performDataOperation } from '@wm/components/base';

const createMockDataNavigator = () => ({
    dataSize: 10,
    pageCount: 2,
    dn: { currentPage: 1 },
    calculatePagingValues: jest.fn(),
    navigatePage: jest.fn((index, _a, _b, cb) => cb({ rows: [] }))
});

const createMockWidget = () => ({
    name: 'table1',
    selecteditem: { id: 1 },
    navigation: 'None',
    dataNavigator: null,
    datasource: {
        execute: jest.fn().mockReturnValue(Promise.resolve({ rows: [] })),
        category: 'wm.LiveVariable'
    },
    confirmdelete: undefined,
    deleteoktext: undefined,
    deletecanceltext: undefined
});

const createMockApp = () => ({
    notify: jest.fn(),
    notifyApp: jest.fn(),
    appLocale: { MESSAGE_DELETE_RECORD: 'Delete Record?', MESSAGE_DELETE_RECORD_SUCCESS: 'Deleted!' }
});

const createMockDialogService = () => ({
    showAppConfirmDialog: jest.fn(),
    closeAppConfirmDialog: jest.fn()
});

const createDirective = (widget: any) => {
    const app = createMockApp();
    const dialogService = createMockDialogService();
    const directive = new LiveActionsDirective(widget, app as any, dialogService as any);
    return { directive, app, dialogService };
};

describe('LiveActionsDirective', () => {
    let widget: any;

    beforeEach(() => {
        jest.clearAllMocks();
        widget = createMockWidget();
    });

    describe('constructor', () => {
        it('should bind CRUD entry points onto the subscribed widget', () => {
            createDirective(widget);
            expect(widget.addRow).toBeInstanceOf(Function);
            expect(widget.updateRow).toBeInstanceOf(Function);
            expect(widget.deleteRow).toBeInstanceOf(Function);
            expect(widget.call).toBeInstanceOf(Function);
        });
    });

    describe('addRow / updateRow / deleteRow', () => {
        it('addRow should notify an insert event', () => {
            const { directive, app } = createDirective(widget);
            directive.addRow();
            expect(app.notify).toHaveBeenCalledWith('wm-event', { eventName: Live_Operations.INSERT, widgetName: 'table1', row: widget.selecteditem });
        });

        it('updateRow should notify an update event', () => {
            const { directive, app } = createDirective(widget);
            directive.updateRow();
            expect(app.notify).toHaveBeenCalledWith('wm-event', { eventName: Live_Operations.UPDATE, widgetName: 'table1', row: widget.selecteditem });
        });

        it('deleteRow should notify a delete event', () => {
            const { directive, app } = createDirective(widget);
            directive.deleteRow();
            expect(app.notify).toHaveBeenCalledWith('wm-event', { eventName: Live_Operations.DELETE, widgetName: 'table1', row: widget.selecteditem });
        });
    });

    describe('getRecords', () => {
        it('should refresh via the datasource when there is no data navigator', async () => {
            const { directive } = createDirective(widget);
            const success = jest.fn();
            directive.getRecords({ success }, Live_Operations.READ);
            await new Promise(process.nextTick);
            expect(widget.datasource.execute).toHaveBeenCalled();
            expect(success).toHaveBeenCalledWith({ rows: [] });
        });

        it('should surface an error when the datasource refresh fails', async () => {
            widget.datasource.execute.mockReturnValue(Promise.reject('boom'));
            const { directive, app } = createDirective(widget);
            directive.getRecords({ error: jest.fn() }, Live_Operations.READ);
            await new Promise(process.nextTick);
            expect(app.notifyApp).toHaveBeenCalledWith('boom', 'error', 'ERROR');
        });

        it('should shrink the page and go to the previous page on delete when the current page no longer exists', () => {
            const dataNavigator = createMockDataNavigator();
            dataNavigator.pageCount = 0;
            dataNavigator.dn.currentPage = 1;
            widget.navigation = 'Basic';
            widget.dataNavigator = dataNavigator;
            const { directive } = createDirective(widget);
            const success = jest.fn();
            directive.getRecords({ success }, Live_Operations.DELETE);
            expect(dataNavigator.dataSize).toEqual(9);
            expect(dataNavigator.navigatePage).toHaveBeenCalledWith('prev', null, true, expect.any(Function));
            expect(success).toHaveBeenCalled();
        });

        it('should stay on the current page on delete when later pages still exist', () => {
            const dataNavigator = createMockDataNavigator();
            widget.navigation = 'Basic';
            widget.dataNavigator = dataNavigator;
            const { directive } = createDirective(widget);
            directive.getRecords({ success: jest.fn() }, Live_Operations.DELETE);
            expect(dataNavigator.navigatePage).toHaveBeenCalledWith(undefined, null, true, expect.any(Function));
        });

        it('should navigate to the last page on insert', () => {
            const dataNavigator = createMockDataNavigator();
            widget.navigation = 'Basic';
            widget.dataNavigator = dataNavigator;
            const { directive } = createDirective(widget);
            directive.getRecords({ success: jest.fn() }, Live_Operations.INSERT);
            expect(dataNavigator.dataSize).toEqual(11);
            expect(dataNavigator.navigatePage).toHaveBeenCalledWith('last', null, true, expect.any(Function));
        });

        it('should stay on the current page on update', () => {
            const dataNavigator = createMockDataNavigator();
            widget.navigation = 'Basic';
            widget.dataNavigator = dataNavigator;
            const { directive } = createDirective(widget);
            directive.getRecords({ success: jest.fn() }, Live_Operations.UPDATE);
            expect(dataNavigator.navigatePage).toHaveBeenCalledWith('current', null, true, expect.any(Function));
        });
    });

    describe('call / performOperation', () => {
        it('should build request data with row/prevData for updates and delegate to updateRecord', () => {
            const { directive } = createDirective(widget);
            const performCUDSpy = jest.spyOn(directive as any, 'performCUDOperation').mockImplementation(() => undefined);
            const options = { row: { id: 1 }, rowData: { id: 1, name: 'old' }, prevData: { name: 'older' } };
            directive.call(Live_Operations.UPDATE, options, jest.fn(), jest.fn());
            expect(performCUDSpy).toHaveBeenCalledWith(
                expect.objectContaining({ row: options.row, rowData: options.rowData, prevData: options.prevData }),
                Live_Operations.UPDATE,
                options
            );
        });

        it('should delegate inserts to performCUDOperation', () => {
            const { directive } = createDirective(widget);
            const performCUDSpy = jest.spyOn(directive as any, 'performCUDOperation').mockImplementation(() => undefined);
            directive.call(Live_Operations.INSERT, { row: {} });
            expect(performCUDSpy).toHaveBeenCalled();
        });

        it('should show the delete confirmation dialog for deletes', () => {
            const { directive, dialogService } = createDirective(widget);
            directive.call(Live_Operations.DELETE, { row: {} });
            expect(dialogService.showAppConfirmDialog).toHaveBeenCalledWith(expect.objectContaining({
                title: 'Delete Record?'
            }));
        });

        it('should read records directly for the READ operation', () => {
            const { directive } = createDirective(widget);
            const getRecordsSpy = jest.spyOn(directive, 'getRecords').mockImplementation(() => undefined);
            directive.call(Live_Operations.READ, { row: {} });
            expect(getRecordsSpy).toHaveBeenCalledWith(expect.objectContaining({ row: {} }), Live_Operations.READ);
        });

        it('should attach the success/error callbacks onto the options', () => {
            const { directive } = createDirective(widget);
            const getRecordsSpy = jest.spyOn(directive, 'getRecords').mockImplementation(() => undefined);
            const success = jest.fn();
            const error = jest.fn();
            const options: any = { row: {} };
            directive.call(Live_Operations.READ, options, success, error);
            expect(options.success).toBe(success);
            expect(options.error).toBe(error);
            expect(getRecordsSpy).toHaveBeenCalled();
        });
    });

    describe('performCUDOperation (via insertRecord)', () => {
        it('should refresh records on success for a non-delete, non-crud-variable operation', async () => {
            (performDataOperation as jest.Mock).mockReturnValue(Promise.resolve({}));
            const { directive } = createDirective(widget);
            const getRecordsSpy = jest.spyOn(directive, 'getRecords').mockImplementation(() => undefined);
            (directive as any).insertRecord({ row: {} }, Live_Operations.INSERT, { row: {} });
            await new Promise(process.nextTick);
            expect(getRecordsSpy).toHaveBeenCalledWith({ row: {} }, Live_Operations.INSERT);
        });

        it('should surface an error when the response payload contains one', async () => {
            (performDataOperation as jest.Mock).mockReturnValue(Promise.resolve({ error: 'invalid' }));
            const { directive, app } = createDirective(widget);
            (directive as any).insertRecord({ row: {} }, Live_Operations.INSERT, { row: {}, error: jest.fn() });
            await new Promise(process.nextTick);
            expect(app.notifyApp).toHaveBeenCalledWith('invalid', 'error', 'ERROR');
        });

        it('should surface an error when the operation promise rejects', async () => {
            (performDataOperation as jest.Mock).mockReturnValue(Promise.reject('server down'));
            const { directive, app } = createDirective(widget);
            (directive as any).insertRecord({ row: {} }, Live_Operations.INSERT, { row: {}, error: jest.fn() });
            await new Promise(process.nextTick);
            expect(app.notifyApp).toHaveBeenCalledWith('server down', 'error', 'ERROR');
        });

        it('should refresh the list and notify success for a delete against a CrudVariable', async () => {
            widget.datasource.category = 'wm.CrudVariable';
            (performDataOperation as jest.Mock).mockReturnValue(Promise.resolve({}));
            const { directive, app } = createDirective(widget);
            (directive as any).updateRecord({ row: {} }, 'delete', { row: {}, success: jest.fn() });
            await new Promise(process.nextTick);
            await new Promise(process.nextTick);
            expect(widget.datasource.execute).toHaveBeenCalled();
            expect(app.notifyApp).toHaveBeenCalledWith('Deleted!', 'success');
        });

        it('should surface an error when the post-delete CrudVariable list refresh fails', async () => {
            widget.datasource.category = 'wm.CrudVariable';
            widget.datasource.execute.mockReturnValue(Promise.reject('refresh failed'));
            (performDataOperation as jest.Mock).mockReturnValue(Promise.resolve({}));
            const { directive, app } = createDirective(widget);
            const error = jest.fn();
            (directive as any).updateRecord({ row: {} }, 'delete', { row: {}, error });
            await new Promise(process.nextTick);
            await new Promise(process.nextTick);
            expect(widget.datasource.execute).toHaveBeenCalled();
            expect(app.notifyApp).toHaveBeenCalledWith('refresh failed', 'error', 'ERROR');
            expect(error).toHaveBeenCalledWith('refresh failed');
            // delete success toast still fires regardless of the refresh outcome
            expect(app.notifyApp).toHaveBeenCalledWith('Deleted!', 'success');
        });
    });

    describe('deleteRecord (via call)', () => {
        it('should perform the delete and close the confirm dialog on Ok', () => {
            const { directive, dialogService } = createDirective(widget);
            const performCUDSpy = jest.spyOn(directive as any, 'performCUDOperation').mockImplementation(() => undefined);
            directive.call(Live_Operations.DELETE, { row: {} });
            const config = dialogService.showAppConfirmDialog.mock.calls[0][0];
            config.onOk();
            expect(performCUDSpy).toHaveBeenCalled();
            expect(dialogService.closeAppConfirmDialog).toHaveBeenCalled();
        });

        it('should trigger the cancel callback and close the confirm dialog on Cancel', () => {
            const { directive, dialogService } = createDirective(widget);
            const cancelDeleteCallback = jest.fn();
            directive.call(Live_Operations.DELETE, { row: {}, cancelDeleteCallback });
            const config = dialogService.showAppConfirmDialog.mock.calls[0][0];
            config.onCancel();
            expect(cancelDeleteCallback).toHaveBeenCalled();
            expect(dialogService.closeAppConfirmDialog).toHaveBeenCalled();
        });

        it('should fall back to default confirmation copy when the widget does not customize it', () => {
            const { directive, dialogService } = createDirective(widget);
            directive.call(Live_Operations.DELETE, { row: {} });
            const config = dialogService.showAppConfirmDialog.mock.calls[0][0];
            expect(config.message).toEqual('Are you sure you want to delete this?');
            expect(config.oktext).toEqual('Ok');
            expect(config.canceltext).toEqual('Cancel');
        });

        it('should fall back to the default confirm-dialog title when appLocale has no message', () => {
            const { directive, dialogService } = createDirective(widget);
            (directive as any).app.appLocale.MESSAGE_DELETE_RECORD = undefined;
            directive.call(Live_Operations.DELETE, { row: {} });
            const config = dialogService.showAppConfirmDialog.mock.calls[0][0];
            expect(config.title).toEqual('Delete Record');
        });

        it('should use the widget-provided confirmation copy when customized', () => {
            widget.confirmdelete = 'Really delete?';
            widget.deleteoktext = 'Yes';
            widget.deletecanceltext = 'No';
            const { directive, dialogService } = createDirective(widget);
            directive.call(Live_Operations.DELETE, { row: {} });
            const config = dialogService.showAppConfirmDialog.mock.calls[0][0];
            expect(config.message).toEqual('Really delete?');
            expect(config.oktext).toEqual('Yes');
            expect(config.canceltext).toEqual('No');
        });
    });

    describe('ngOnDestroy', () => {
        it('should clear the widget, app and dialog service references', () => {
            const { directive } = createDirective(widget);
            directive.ngOnDestroy();
            expect((directive as any).subscribedWidget).toBeNull();
            expect((directive as any).app).toBeNull();
            expect((directive as any).dialogService).toBeNull();
        });
    });
});
