import { ComponentFixture, fakeAsync, tick } from '@angular/core/testing';
import { Component, ViewChild } from '@angular/core';
import { LiveTableComponent } from './live-table.component';
import { App, AbstractDialogService } from '@wm/core';
import { compileTestComponent, mockApp } from 'projects/components/base/src/test/util/component-test-util';

const markup = `<div wmLiveTable></div>`;
const dialogMarkup = `<div wmLiveTable formlayout="dialog" dialogid="liveTableDialog"></div>`;

@Component({
    standalone: false,
    template: markup
})
class TestComponent {
    @ViewChild(LiveTableComponent, { static: true }) wmComponent: LiveTableComponent;
}

@Component({
    standalone: false,
    template: dialogMarkup
})
class DialogTestComponent {
    @ViewChild(LiveTableComponent, { static: true }) wmComponent: LiveTableComponent;
}

const mockDialogService = {
    open: jest.fn(),
    close: jest.fn()
};

const providers = [
    { provide: App, useValue: mockApp },
    { provide: AbstractDialogService, useValue: mockDialogService }
];

const testModuleDef = {
    declarations: [TestComponent],
    imports: [LiveTableComponent],
    providers
};

const dialogTestModuleDef = {
    declarations: [DialogTestComponent],
    imports: [LiveTableComponent],
    providers
};

const createMockForm = () => ({
    isDestroyed: false,
    isSelected: false,
    isUpdateMode: false,
    updateMode: false,
    getWidget: jest.fn().mockReturnValue({ formdata: null }),
    new: jest.fn(),
    edit: jest.fn(),
    clearData: jest.fn(),
    formFields: [{ $attrs: new Map(), widgettype: 'text' }]
});

const createMockTable = () => ({
    multiselect: false,
    gridOptions: { isNavTypeScrollOrOndemand: jest.fn().mockReturnValue(false) },
    isNewRowInserted: false,
    gridfirstrowselect: true,
    initiateSelectItem: jest.fn(),
    getNavigationTargetBySortInfo: jest.fn().mockReturnValue('sortTarget'),
    onRecordDelete: jest.fn(),
    updateVariable: jest.fn(),
    selectedItemChange$: { pipe: jest.fn().mockReturnValue({ subscribe: jest.fn() }) },
    datagridElement: { datatable: jest.fn() }
});

describe('LiveTableComponent', () => {
    let wmComponent: LiveTableComponent;
    let fixture: ComponentFixture<TestComponent>;
    let mockForm: any;
    let mockTable: any;

    beforeEach(() => {
        jest.clearAllMocks();
        fixture = compileTestComponent(testModuleDef, TestComponent);
        wmComponent = fixture.componentInstance.wmComponent;
        fixture.detectChanges();

        mockForm = createMockForm();
        mockTable = createMockTable();
        wmComponent.form = mockForm;
        (wmComponent as any).table = mockTable;
    });

    it('should create the component', () => {
        expect(wmComponent).toBeTruthy();
    });

    it('should not be in dialog layout mode by default', () => {
        expect(wmComponent.isLayoutDialog).toBeFalsy();
    });

    describe('openDialog / closeDialog', () => {
        it('should open the dialog via dialogService', () => {
            (wmComponent as any).dialogId = 'myDialog';
            wmComponent.openDialog();
            expect(mockDialogService.open).toHaveBeenCalledWith('myDialog', (wmComponent as any).viewParent);
        });

        it('should close the dialog via dialogService', () => {
            (wmComponent as any).dialogId = 'myDialog';
            wmComponent.closeDialog();
            expect(mockDialogService.close).toHaveBeenCalledWith('myDialog', (wmComponent as any).viewParent);
        });
    });

    describe('onDialogOpen', () => {
        it('should focus the first input when action is update', () => {
            const focusSpy = jest.spyOn(wmComponent, 'focusFirstInput').mockImplementation(() => {});
            wmComponent.onDialogOpen('update');
            expect(focusSpy).toHaveBeenCalled();
        });

        it('should focus the first input when the form has a bound default value', () => {
            const focusSpy = jest.spyOn(wmComponent, 'focusFirstInput').mockImplementation(() => {});
            mockForm.formFields[0].$attrs = new Map([['defaultvalue.bind', 'someExpr']]);
            wmComponent.onDialogOpen('add');
            expect(focusSpy).toHaveBeenCalled();
        });

        it('should not focus the first input when the first field is an autocomplete widget', () => {
            const focusSpy = jest.spyOn(wmComponent, 'focusFirstInput').mockImplementation(() => {});
            mockForm.formFields[0].widgettype = 'autocomplete';
            wmComponent.onDialogOpen('update');
            expect(focusSpy).not.toHaveBeenCalled();
        });

        it('should cope with a form that has no fields', () => {
            const focusSpy = jest.spyOn(wmComponent, 'focusFirstInput').mockImplementation(() => {});
            mockForm.formFields = [];
            wmComponent.onDialogOpen('add');
            expect(focusSpy).toHaveBeenCalled();
        });

        it('should focus the first input when action is add and there is no default value', () => {
            const focusSpy = jest.spyOn(wmComponent, 'focusFirstInput').mockImplementation(() => {});
            wmComponent.onDialogOpen('add');
            expect(focusSpy).toHaveBeenCalled();
        });
    });

    describe('setFormData', () => {
        it('should set formdata on the form widget when form is not destroyed', () => {
            mockForm.isDestroyed = false;
            wmComponent.setFormData({ id: 1 });
            expect(mockForm.getWidget().formdata).toEqual({ id: 1 });
        });

        it('should not touch formdata when form is destroyed', () => {
            mockForm.isDestroyed = true;
            wmComponent.setFormData({ id: 1 });
            expect(mockForm.getWidget).not.toHaveBeenCalled();
        });
    });

    describe('addNewRow (non-dialog mode)', () => {
        it('should select the form, clear formdata and call form.new()', () => {
            wmComponent.addNewRow();
            expect(mockForm.isSelected).toBeTruthy();
            expect(mockForm.new).toHaveBeenCalled();
        });
    });

    describe('updateRow (non-dialog mode)', () => {
        it('should set formdata on the selected row and call form.edit()', () => {
            const row = { id: 42 };
            wmComponent.updateRow(row, 'click');
            expect(mockForm.getWidget().formdata).toEqual(row);
            expect(mockForm.isSelected).toBeTruthy();
            expect(mockForm.edit).toHaveBeenCalled();
        });
    });

    describe('onCancel', () => {
        it('should set isUpdateMode to false', () => {
            mockForm.isUpdateMode = true;
            wmComponent.onCancel();
            expect(mockForm.isUpdateMode).toBeFalsy();
        });

        it('should not attempt to close a dialog outside dialog layout', () => {
            wmComponent.onCancel();
            expect(mockDialogService.close).not.toHaveBeenCalled();
        });
    });

    describe('onSelectedItemChange', () => {
        it('should return early when form is not set', () => {
            wmComponent.form = null;
            expect(() => wmComponent.onSelectedItemChange([{ id: 1 }])).not.toThrow();
        });

        it('should return early when table is not set', () => {
            (wmComponent as any).table = null;
            expect(() => wmComponent.onSelectedItemChange([{ id: 1 }])).not.toThrow();
        });

        it('should select the last item when multiselect is false', () => {
            mockTable.multiselect = false;
            wmComponent.onSelectedItemChange([{ id: 1 }, { id: 2 }]);
            expect(mockForm.getWidget().formdata).toEqual({ id: 2 });
        });

        it('should select the first item when multiselect is true', () => {
            mockTable.multiselect = true;
            wmComponent.onSelectedItemChange([{ id: 1 }, { id: 2 }]);
            expect(mockForm.getWidget().formdata).toEqual({ id: 1 });
        });

        it('should call form.edit() when already in update mode', () => {
            mockForm.isUpdateMode = true;
            wmComponent.onSelectedItemChange([{ id: 1 }]);
            expect(mockForm.edit).toHaveBeenCalled();
        });

        it('should clear selection and data when newValue is empty', () => {
            mockForm.isSelected = true;
            wmComponent.onSelectedItemChange([]);
            expect(mockForm.isSelected).toBeFalsy();
            expect(mockForm.clearData).toHaveBeenCalled();
        });
    });

    describe('onResult', () => {
        it('should mark isNewRowInserted on insert when nav type is scroll/ondemand', () => {
            mockTable.gridOptions.isNavTypeScrollOrOndemand.mockReturnValue(true);
            wmComponent.onResult('insert', { id: 1 }, false, false);
            expect(mockTable.isNewRowInserted).toBeTruthy();
        });

        it('should highlight the inserted row without newForm', () => {
            wmComponent.onResult('insert', { id: 1 }, false, false);
            expect(mockTable.initiateSelectItem).toHaveBeenCalledWith('sortTarget', { id: 1 });
        });

        it('should skip row highlight and reset gridfirstrowselect when newForm is true on insert', () => {
            wmComponent.onResult('insert', { id: 1 }, true, false);
            expect(mockTable.gridfirstrowselect).toBeFalsy();
            expect(mockTable.initiateSelectItem).toHaveBeenCalledWith('sortTarget', { id: 1 }, true);
        });

        it('should highlight the current row on update', () => {
            wmComponent.onResult('update', { id: 1 }, false, false);
            expect(mockTable.initiateSelectItem).toHaveBeenCalledWith('current', { id: 1 });
        });

        it('should keep a layout dialog open without reopening the form after a delete with a new form', () => {
            wmComponent.isLayoutDialog = true;
            const closeSpy = jest.spyOn(wmComponent, 'closeDialog').mockImplementation(() => {});
            wmComponent.onResult('delete', { id: 1 }, true, false);
            expect(closeSpy).not.toHaveBeenCalled();
        });

        it('should not treat a missing newForm as update mode', () => {
            wmComponent.onResult('update', { id: 1 }, undefined, undefined);
            expect(mockForm.isUpdateMode).toBe(false);
        });

        it('should call onRecordDelete on delete', () => {
            wmComponent.onResult('delete', { id: 1 }, false, false);
            expect(mockTable.onRecordDelete).toHaveBeenCalled();
        });

        it('should always update the table variable', () => {
            wmComponent.onResult('delete', { id: 1 }, false, false);
            expect(mockTable.updateVariable).toHaveBeenCalled();
        });

        it('should default isUpdateMode based on newForm when updateMode is not provided', () => {
            wmComponent.onResult('update', { id: 1 }, true, undefined);
            expect(mockForm.isUpdateMode).toBeTruthy();
        });

        it('should use the explicit updateMode when provided', () => {
            wmComponent.onResult('update', { id: 1 }, true, false);
            expect(mockForm.isUpdateMode).toBeFalsy();
        });
    });

    describe('showErrorMessage', () => {
        it('should notify the app with the access-denied message', () => {
            const notifySpy = jest.spyOn(mockApp, 'notifyApp');
            wmComponent.showErrorMessage();
            expect(notifySpy).toHaveBeenCalledWith(wmComponent.appLocale?.LABEL_ACCESS_DENIED, 'error');
        });
    });

    describe('onFormReady', () => {
        it('should set the form and trigger any queued action', fakeAsync(() => {
            const queuedFn = jest.fn();
            (wmComponent as any).$queue = [queuedFn];
            wmComponent.onFormReady(mockForm);
            expect(wmComponent.form).toBe(mockForm);
            tick();
            expect(queuedFn).toHaveBeenCalled();
        }));
    });

    describe('ngOnDestroy', () => {
        it('should unsubscribe, clear the table reference and empty the queue', () => {
            const unsubscribe = jest.fn();
            (wmComponent as any).selectedItemChangeSubscription = { unsubscribe };
            (wmComponent as any).$queue = [jest.fn()];
            wmComponent.ngOnDestroy();
            expect(unsubscribe).toHaveBeenCalled();
            expect(wmComponent.table).toBeNull();
            expect((wmComponent as any).$queue).toEqual([]);
        });
    });

    describe('ngAfterContentInit', () => {
        it('should link the table back to this live-table and configure it once the datatable is ready', fakeAsync(() => {
            mockTable.datagridElement.datatable = jest.fn((...args: any[]) => {
                if (args[0] === 'instance') {
                    return true;
                }
                return undefined;
            });
            (wmComponent as any).table = mockTable;
            wmComponent.ngAfterContentInit();
            tick(0);
            expect(mockTable._liveTableParent).toBe(wmComponent);
            expect(mockTable.datagridElement.datatable).toHaveBeenCalledWith('option', (wmComponent as any).tableOptions);
        }));

        it('should do nothing when there is no content-projected table', () => {
            (wmComponent as any).table = null;
            expect(() => wmComponent.ngAfterContentInit()).not.toThrow();
        });

        it('should retry configuring the table when the datatable instance is not ready yet', fakeAsync(() => {
            let instanceReady = false;
            mockTable.datagridElement.datatable = jest.fn((...args: any[]) => {
                if (args[0] === 'instance') {
                    return instanceReady;
                }
                return undefined;
            });
            (wmComponent as any).table = mockTable;
            wmComponent.ngAfterContentInit();
            tick(0);
            expect(mockTable.datagridElement.datatable).toHaveBeenCalledWith('instance');
            expect(mockTable.datagridElement.datatable).not.toHaveBeenCalledWith('option', expect.anything());

            instanceReady = true;
            tick(50);
            expect(mockTable.datagridElement.datatable).toHaveBeenCalledWith('option', (wmComponent as any).tableOptions);
        }));

        it('should register and invoke row-guard error handlers when not in dialog layout and no form is set yet', fakeAsync(() => {
            const notifySpy = jest.spyOn(mockApp, 'notifyApp');
            mockTable.datagridElement.datatable = jest.fn((...args: any[]) => {
                if (args[0] === 'instance') {
                    return true;
                }
                return undefined;
            });
            (wmComponent as any).table = mockTable;
            wmComponent.form = null;
            wmComponent.ngAfterContentInit();
            tick(0);

            const optionCalls = mockTable.datagridElement.datatable.mock.calls.filter((call: any[]) => call[0] === 'option');
            const handlersCall = optionCalls.find((call: any[]) => call[1] && call[1].beforeRowUpdate);
            expect(handlersCall).toBeTruthy();

            handlersCall[1].beforeRowUpdate();
            handlersCall[1].beforeRowDelete();
            handlersCall[1].beforeRowInsert();
            expect(notifySpy).toHaveBeenCalledTimes(3);
        }));
    });
});

describe('LiveTableComponent (dialog layout)', () => {
    let wmComponent: LiveTableComponent;
    let fixture: ComponentFixture<DialogTestComponent>;
    let mockForm: any;
    let mockTable: any;

    beforeEach(() => {
        jest.clearAllMocks();
        fixture = compileTestComponent(dialogTestModuleDef, DialogTestComponent);
        wmComponent = fixture.componentInstance.wmComponent;
        fixture.detectChanges();

        mockForm = createMockForm();
        mockTable = createMockTable();
        wmComponent.form = mockForm;
        (wmComponent as any).table = mockTable;
    });

    it('should be in dialog layout mode with the configured dialog id', () => {
        expect(wmComponent.isLayoutDialog).toBeTruthy();
        expect((wmComponent as any).dialogId).toEqual('liveTableDialog');
    });

    it('addNewRow should open the dialog and queue the add instead of running it immediately', () => {
        wmComponent.addNewRow();
        expect(mockDialogService.open).toHaveBeenCalled();
        expect(mockForm.new).not.toHaveBeenCalled();
        expect((wmComponent as any).$queue.length).toEqual(1);
    });

    it('updateRow should open the dialog and queue the update instead of running it immediately', () => {
        wmComponent.updateRow({ id: 1 }, 'click');
        expect(mockDialogService.open).toHaveBeenCalled();
        expect(mockForm.edit).not.toHaveBeenCalled();
        expect((wmComponent as any).$queue.length).toEqual(1);
    });

    it('onCancel should close the dialog', () => {
        wmComponent.onCancel();
        expect(mockDialogService.close).toHaveBeenCalled();
    });

    it('should run the queued add once the form becomes ready', () => {
        wmComponent.addNewRow();
        const queuedFn = (wmComponent as any).$queue.pop();
        queuedFn();
        expect(mockForm.new).toHaveBeenCalled();
    });

    describe('running the queued update', () => {
        it('should set formdata, call form.edit() and force update mode on a non-dblclick trigger', () => {
            const focusSpy = jest.spyOn(wmComponent, 'focusFirstInput').mockImplementation(() => {});
            wmComponent.updateRow({ id: 7 }, 'click');
            const queuedFn = (wmComponent as any).$queue.pop();
            queuedFn();
            expect(mockForm.getWidget().formdata).toEqual({ id: 7 });
            expect(mockForm.edit).toHaveBeenCalled();
            expect(mockForm.isUpdateMode).toBeTruthy();
            focusSpy.mockRestore();
        });

        it('should fall back to form.updateMode on a dblclick trigger', () => {
            const focusSpy = jest.spyOn(wmComponent, 'focusFirstInput').mockImplementation(() => {});
            mockForm.updateMode = false;
            wmComponent.updateRow({ id: 8 }, 'dblclick');
            const queuedFn = (wmComponent as any).$queue.pop();
            queuedFn();
            expect(mockForm.isUpdateMode).toBe(mockForm.updateMode);
            focusSpy.mockRestore();
        });
    });

    describe('onResult (dialog layout)', () => {
        it('should reopen a new form after inserting when newForm is true', () => {
            wmComponent.onResult('insert', { id: 1 }, true, false);
            expect(mockForm.new).toHaveBeenCalled();
            expect(mockDialogService.close).not.toHaveBeenCalled();
        });

        it('should switch the form back to edit mode after updating when newForm is true', () => {
            wmComponent.onResult('update', { id: 1 }, true, false);
            expect(mockForm.edit).toHaveBeenCalled();
            expect(mockDialogService.close).not.toHaveBeenCalled();
        });

        it('should close the dialog when newForm is false', () => {
            wmComponent.onResult('insert', { id: 1 }, false, false);
            expect(mockDialogService.close).toHaveBeenCalled();
        });

        it('should close the dialog on delete', () => {
            wmComponent.onResult('delete', { id: 1 }, false, false);
            expect(mockTable.onRecordDelete).toHaveBeenCalled();
            expect(mockDialogService.close).toHaveBeenCalled();
        });
    });
});
