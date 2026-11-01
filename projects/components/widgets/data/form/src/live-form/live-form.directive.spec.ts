import { LiveFormDirective } from './live-form.directive';
import { Live_Operations } from '@wm/components/base';
import { DataSource, DataType } from '@wm/core';

jest.mock('@wm/components/base', () => ({
    ...jest.requireActual('@wm/components/base'),
    performDataOperation: jest.fn(),
    applyFilterOnField: jest.fn(),
    fetchRelatedFieldData: jest.fn(),
    getDistinctValuesForField: jest.fn(),
    isDataSetWidget: jest.fn()
}));

import { performDataOperation, applyFilterOnField, fetchRelatedFieldData, getDistinctValuesForField, isDataSetWidget } from '@wm/components/base';

const createMockDatePipe = () => ({
    transform: jest.fn((val) => `formatted(${val})`)
});

const createMockDialogService = () => ({
    open: jest.fn(),
    close: jest.fn()
});

const createMockField = (overrides = {}) => ({
    key: 'firstname',
    type: DataType.STRING,
    widgettype: 'text',
    value: undefined,
    isDataSetBound: false,
    setReadOnlyState: jest.fn(),
    resetDisplayInput: jest.fn(),
    nativeElement: { querySelector: jest.fn().mockReturnValue({ removeAttribute: jest.fn() }) },
    ...overrides
});

const createMockForm = () => ({
    parentForm: null,
    isLayoutDialog: false,
    _liveTableParent: null,
    registerFormFields: jest.fn(),
    formFields: [createMockField()],
    getFormFields: jest.fn(function (this: any) { return this.formFields; }),
    isDataSourceUpdated: false,
    datasource: {
        execute: jest.fn()
    },
    enableemptyfilter: false,
    operationType: undefined,
    dirty: false,
    markAsPristine: jest.fn(),
    prevDataValues: [],
    prevformFields: null,
    prevDataObject: undefined,
    formdata: {},
    name: 'testForm',
    // real FormComponent.updateFormDataOutput sets this.dataoutput - mirror that so constructDataObject()'s
    // return value (this.form.dataoutput) reflects what was just computed, not a stale placeholder.
    updateFormDataOutput: jest.fn(function (this: any, dataObj: any) { this.dataoutput = dataObj; }),
    dataoutput: { foo: 'bar' },
    primaryKey: [],
    ngform: { pristine: true },
    appLocale: { MESSAGE_NO_CHANGES: 'No changes detected' },
    toggleMessage: jest.fn(),
    invokeEventCallback: jest.fn(),
    validateFieldsOnSubmit: jest.fn().mockReturnValue(false),
    resetFormState: jest.fn(),
    onResultCb: jest.fn(),
    insertmessage: 'Inserted!',
    updatemessage: 'Updated!',
    deletemessage: 'Deleted!',
    onSuccess: undefined,
    onError: undefined,
    emptyDataModel: jest.fn(),
    resetFileUploadWidget: jest.fn(),
    clearMessage: jest.fn(),
    isSelected: false,
    isUpdateMode: false,
    dialogId: 'liveFormDialog',
    setFieldValue: jest.fn(),
    new: jest.fn(),
    isDestroyed: false
});

const createDirective = (form: any, liveTable: any = null, formlayout?: string) => {
    const datePipe = createMockDatePipe();
    const dialogService = createMockDialogService();
    const directive = new LiveFormDirective(form, liveTable, datePipe as any, dialogService as any, formlayout as any);
    return { directive, datePipe, dialogService };
};

describe('LiveFormDirective', () => {
    let form: any;

    beforeEach(() => {
        jest.clearAllMocks();
        form = createMockForm();
    });

    describe('constructor', () => {
        it('should set isLayoutDialog based on the formlayout attribute when there is no live table', () => {
            const { directive } = createDirective(form, null, 'dialog');
            expect(form.isLayoutDialog).toBe(true);
            expect(directive).toBeTruthy();
        });

        it('should default isLayoutDialog to false when formlayout is not "dialog"', () => {
            createDirective(form, null, undefined);
            expect(form.isLayoutDialog).toBe(false);
        });

        it('should link up to the live table when present and this form has no parent form', () => {
            const liveTable = { isLayoutDialog: true, onFormReady: jest.fn() };
            createDirective(form, liveTable);
            expect(form._liveTableParent).toBe(liveTable);
            expect(form.isLayoutDialog).toBe(true);
            expect(liveTable.onFormReady).toHaveBeenCalledWith(form);
        });

        it('should not overwrite _liveTableParent when the form already has a parent form', () => {
            form.parentForm = {};
            const liveTable = { isLayoutDialog: true, onFormReady: jest.fn() };
            createDirective(form, liveTable);
            expect(form._liveTableParent).toBeNull();
            expect(liveTable.onFormReady).toHaveBeenCalledWith(form);
        });

        it('should rebind the CUD methods onto the form', () => {
            const originalRegister = form.registerFormFields;
            createDirective(form);
            expect(form.cancel).toBeInstanceOf(Function);
            expect(form.save).toBeInstanceOf(Function);
            expect(form.form_registerFormFields).toBe(originalRegister);
            expect(form.registerFormFields).not.toBe(originalRegister);
        });
    });

    describe('registerFormFields', () => {
        it('should delegate to the original registerFormFields', () => {
            const { directive } = createDirective(form);
            const field = createMockField({ key: 'newfield' });
            directive.registerFormFields(field);
            expect(form.form_registerFormFields).toHaveBeenCalledWith(field);
        });

        it('should update the field from the datasource when it was already updated', () => {
            form.isDataSourceUpdated = true;
            (isDataSetWidget as jest.Mock).mockReturnValue(true);
            const { directive } = createDirective(form);
            const field = createMockField({ key: 'related', isDataSetBound: false, 'is-related': true });
            directive.registerFormFields(field);
            expect(field.isDataSetBound).toBe(true);
            expect(fetchRelatedFieldData).toHaveBeenCalledTimes(1);
        });

        it('should not touch the field when the datasource has not been updated yet', () => {
            form.isDataSourceUpdated = false;
            const { directive } = createDirective(form);
            const field = createMockField();
            directive.registerFormFields(field);
            expect(fetchRelatedFieldData).not.toHaveBeenCalled();
            expect(applyFilterOnField).not.toHaveBeenCalled();
        });
    });

    describe('_updateFieldOnDataSourceChange (via onDataSourceChange)', () => {
        it('should mark the form as data-source-updated and process dataset-bound fields', () => {
            (isDataSetWidget as jest.Mock).mockReturnValue(true);
            const field = createMockField({ isDataSetBound: false, 'is-related': false });
            form.formFields = [field];
            const { directive } = createDirective(form);
            directive.onDataSourceChange();
            expect(form.isDataSourceUpdated).toBe(true);
            expect(getDistinctValuesForField).toHaveBeenCalledTimes(1);
            expect(applyFilterOnField).toHaveBeenCalledTimes(1);
        });

        it('should skip fields that are not dataset widgets', () => {
            (isDataSetWidget as jest.Mock).mockReturnValue(false);
            const { directive } = createDirective(form);
            directive.onDataSourceChange();
            expect(getDistinctValuesForField).not.toHaveBeenCalled();
        });
    });

    describe('onFieldDefaultValueChange', () => {
        it('should do nothing while the form is in update mode', () => {
            form.operationType = 'update';
            const { directive } = createDirective(form);
            const field = createMockField();
            directive.onFieldDefaultValueChange(field, '5');
            expect(field.value).toBeUndefined();
        });

        it('should parse and set the provided default value', () => {
            form.operationType = 'insert';
            const { directive } = createDirective(form);
            const field = createMockField({ type: DataType.STRING });
            directive.onFieldDefaultValueChange(field, 'hello');
            expect(field.value).toEqual('hello');
        });

        it('should clear the value when the new value is empty/null', () => {
            form.operationType = 'insert';
            const { directive } = createDirective(form);
            const field = createMockField({ value: 'old' });
            directive.onFieldDefaultValueChange(field, null);
            expect(field.value).toBeUndefined();
        });

        it('should mark the form as pristine when dirty but not triggered by the user', () => {
            form.operationType = 'insert';
            form.dirty = true;
            const { directive } = createDirective(form);
            directive.onFieldDefaultValueChange(createMockField(), 'v');
            expect(form.markAsPristine).toHaveBeenCalledTimes(1);
        });
    });

    describe('onFieldValueChange', () => {
        it('should apply the filter for the changed field', () => {
            const { directive } = createDirective(form);
            const field = createMockField();
            directive.onFieldValueChange(field, 'newval');
            expect(applyFilterOnField).toHaveBeenCalledWith(form.datasource, (field as any).widget, form.formFields, 'newval');
        });
    });

    describe('getBlobURL', () => {
        it('should return an empty string when value is nullish', () => {
            const { directive } = createDirective(form);
            expect(directive.getBlobURL({}, 'key', null)).toEqual('');
            expect(directive.getBlobURL({}, 'key', undefined)).toEqual('');
        });

        it('should return an empty string when there is no datasource', () => {
            form.datasource = null;
            const { directive } = createDirective(form);
            expect(directive.getBlobURL({}, 'key', 'v')).toEqual('');
        });

        it('should build the blob url from the datasource', () => {
            form.datasource.execute.mockImplementation((op) => {
                if (op === DataSource.Operation.GET_PRIMARY_KEY) {
                    return ['id'];
                }
                if (op === DataSource.Operation.GET_BLOB_URL) {
                    return '/blob/1';
                }
            });
            const { directive } = createDirective(form);
            const href = directive.getBlobURL({ id: 1 }, 'photo', 'somevalue');
            expect(href.startsWith('/blob/1?')).toBe(true);
        });
    });

    describe('setFormData', () => {
        it('should do nothing when there is no data object', () => {
            const { directive } = createDirective(form);
            directive.setFormData(null);
            expect(form.setFieldValue).not.toHaveBeenCalled();
        });

        it('should set plain field values via form.setFieldValue', () => {
            const { directive } = createDirective(form);
            const field = createMockField({ key: 'firstname', type: DataType.STRING });
            form.formFields = [field];
            directive.setFormData({ firstname: 'Ram' });
            expect(form.setFieldValue).toHaveBeenCalledWith(field, { firstname: 'Ram' }, undefined);
        });

        it('should reset the upload widget and set an href for blob fields', () => {
            const { directive } = createDirective(form);
            const field = createMockField({ key: 'photo', type: DataType.BLOB });
            form.formFields = [field];
            form.datasource.execute.mockImplementation((op) => {
                if (op === DataSource.Operation.GET_PRIMARY_KEY) { return ['id']; }
                if (op === DataSource.Operation.GET_BLOB_URL) { return '/blob'; }
            });
            directive.setFormData({ id: 1, photo: 'file.png' });
            expect(form.resetFileUploadWidget).toHaveBeenCalledWith(field, true);
            expect((field as any).href).toEqual(expect.stringContaining('/blob'));
        });

        it('should always save previous data values and reconstruct the data object', () => {
            const { directive } = createDirective(form);
            directive.setFormData({ firstname: 'Ram' });
            expect(form.prevDataValues).toEqual([{ key: 'firstname', value: undefined }]);
            expect(form.updateFormDataOutput).toHaveBeenCalledTimes(1);
        });

        it('should convert a time-type field value into a timestamp via getValidTime', () => {
            const { directive } = createDirective(form);
            const field = createMockField({ key: 'starttime', widgettype: DataType.TIME });
            form.formFields = [field];
            directive.setFormData({ starttime: '10:30 AM' });
            expect(typeof field.value).toEqual('number');
        });

        it('should set time-type field value to undefined when there is no value', () => {
            const { directive } = createDirective(form);
            const field = createMockField({ key: 'starttime', widgettype: DataType.TIME });
            form.formFields = [field];
            directive.setFormData({});
            expect(field.value).toBeUndefined();
        });
    });

    describe('onDataSourceUpdate', () => {
        it('should call form.new() for a new form', () => {
            const { directive } = createDirective(form);
            directive.onDataSourceUpdate({}, true, undefined);
            expect(form.new).toHaveBeenCalledTimes(1);
            expect(form.isUpdateMode).toBe(true);
        });

        it('should set form data and close the dialog when it is not a new form', () => {
            const { directive, dialogService } = createDirective(form, null, 'dialog');
            directive.onDataSourceUpdate({ id: 1 }, false, false);
            expect(form.updateFormDataOutput).toHaveBeenCalledTimes(1);
            expect(dialogService.close).toHaveBeenCalledWith(form.dialogId);
            expect(form.isUpdateMode).toBe(false);
        });
    });

    describe('savePrevformFields / getPrevformFields', () => {
        it('should snapshot the current field values', () => {
            const field = createMockField({ key: 'firstname', value: 'Ram' });
            form.formFields = [field];
            const { directive } = createDirective(form);
            directive.savePrevformFields();
            expect(form.prevformFields).toEqual([
                expect.objectContaining({ key: 'firstname', value: 'Ram' })
            ]);
        });

        it('should restore field values from the previous snapshot', () => {
            const field = createMockField({ key: 'firstname', value: 'changed' });
            form.formFields = [field];
            form.prevformFields = [{ key: 'firstname', value: 'original' }];
            const { directive } = createDirective(form);
            directive.getPrevformFields();
            expect(field.value).toEqual('original');
        });
    });

    describe('getDataObject', () => {
        it('should return an empty object for insert operations', () => {
            form.operationType = Live_Operations.INSERT;
            const { directive } = createDirective(form);
            expect(directive.getDataObject()).toEqual({});
        });

        it('should return a clone of prevDataObject when present', () => {
            form.operationType = Live_Operations.UPDATE;
            form.prevDataObject = { id: 1 };
            const { directive } = createDirective(form);
            expect(directive.getDataObject()).toEqual({ id: 1 });
        });

        it('should fall back to formdata when there is no prevDataObject', () => {
            form.operationType = Live_Operations.UPDATE;
            form.prevDataObject = undefined;
            form.formdata = { id: 2 };
            const { directive } = createDirective(form);
            expect(directive.getDataObject()).toEqual({ id: 2 });
        });
    });

    describe('constructDataObject', () => {
        it('should format date/time field values through the datePipe when there is an outputformat', () => {
            form.operationType = Live_Operations.INSERT;
            const field = createMockField({ key: 'dob', type: DataType.DATE, widgettype: 'date', value: '2020-01-01', outputformat: 'yyyy-MM-dd' });
            form.formFields = [field];
            form.getFormFields = jest.fn().mockReturnValue([field]);
            const { directive, datePipe } = createDirective(form);
            const result = directive.constructDataObject();
            expect(datePipe.transform).toHaveBeenCalledWith(expect.anything(), 'yyyy-MM-dd');
            expect(result).toBe(form.dataoutput);
        });

        it('should keep blob field values via getFiles (no file input present -> undefined)', () => {
            form.operationType = Live_Operations.INSERT;
            const field = createMockField({ key: 'photo', type: DataType.BLOB });
            form.formFields = [field];
            form.getFormFields = jest.fn().mockReturnValue([field]);
            const { directive } = createDirective(form);
            directive.constructDataObject();
            expect(form.updateFormDataOutput).toHaveBeenCalledWith(expect.objectContaining({ photo: undefined }));
        });

        it('should treat empty-string/null values as undefined for plain fields', () => {
            form.operationType = Live_Operations.INSERT;
            const field = createMockField({ key: 'firstname', type: DataType.STRING, value: '' });
            form.formFields = [field];
            form.getFormFields = jest.fn().mockReturnValue([field]);
            const { directive } = createDirective(form);
            directive.constructDataObject();
            expect(form.updateFormDataOutput).toHaveBeenCalledWith(expect.objectContaining({ firstname: undefined }));
        });

        it('should nest dotted field keys under their parent object', () => {
            form.operationType = Live_Operations.INSERT;
            const field = createMockField({ key: 'address.city', type: DataType.STRING, value: 'Pune' });
            form.formFields = [field];
            form.getFormFields = jest.fn().mockReturnValue([field]);
            const { directive } = createDirective(form);
            directive.constructDataObject();
            expect(form.updateFormDataOutput).toHaveBeenCalledWith(expect.objectContaining({ address: { city: 'Pune' } }));
        });

        it('should use the raw date object when outputformat/type is TIMESTAMP', () => {
            form.operationType = Live_Operations.INSERT;
            const field = createMockField({ key: 'createdAt', type: DataType.TIMESTAMP, widgettype: 'date', value: '2020-01-01' });
            form.formFields = [field];
            form.getFormFields = jest.fn().mockReturnValue([field]);
            const { directive, datePipe } = createDirective(form);
            directive.constructDataObject();
            expect(datePipe.transform).not.toHaveBeenCalled();
            // getValidDateObject returns the value as-is (a string here) when it is already a moment-parseable date,
            // it only produces a Date instance for values that need normalization.
            expect(form.updateFormDataOutput).toHaveBeenCalledWith(expect.objectContaining({ createdAt: '2020-01-01' }));
        });

        it('should use the raw field value when there is no outputformat', () => {
            form.operationType = Live_Operations.INSERT;
            const field = createMockField({ key: 'dob', type: DataType.DATE, widgettype: 'date', value: '2020-01-01' });
            form.formFields = [field];
            form.getFormFields = jest.fn().mockReturnValue([field]);
            const { directive } = createDirective(form);
            directive.constructDataObject();
            expect(form.updateFormDataOutput).toHaveBeenCalledWith(expect.objectContaining({ dob: '2020-01-01' }));
        });

        it('should treat a date/time field with no value as undefined', () => {
            form.operationType = Live_Operations.INSERT;
            const field = createMockField({ key: 'dob', type: DataType.DATE, widgettype: 'date', value: undefined });
            form.formFields = [field];
            form.getFormFields = jest.fn().mockReturnValue([field]);
            const { directive } = createDirective(form);
            directive.constructDataObject();
            expect(form.updateFormDataOutput).toHaveBeenCalledWith(expect.objectContaining({ dob: undefined }));
        });

        it('should default a LIST field with no value to undefined', () => {
            form.operationType = Live_Operations.INSERT;
            const field = createMockField({ key: 'tags', type: DataType.LIST, value: undefined });
            form.formFields = [field];
            form.getFormFields = jest.fn().mockReturnValue([field]);
            const { directive } = createDirective(form);
            directive.constructDataObject();
            expect(form.updateFormDataOutput).toHaveBeenCalledWith(expect.objectContaining({ tags: undefined }));
        });

        it('should keep a LIST field value when present', () => {
            form.operationType = Live_Operations.INSERT;
            const field = createMockField({ key: 'tags', type: DataType.LIST, value: ['a', 'b'] });
            form.formFields = [field];
            form.getFormFields = jest.fn().mockReturnValue([field]);
            const { directive } = createDirective(form);
            directive.constructDataObject();
            expect(form.updateFormDataOutput).toHaveBeenCalledWith(expect.objectContaining({ tags: ['a', 'b'] }));
        });

        it('should return the plain data object (without updating dataoutput) when isPreviousData is true', () => {
            form.prevformFields = [createMockField({ key: 'firstname', type: DataType.STRING, value: 'Ram' })];
            const { directive } = createDirective(form);
            const result = directive.constructDataObject(true);
            expect(form.updateFormDataOutput).not.toHaveBeenCalled();
            expect(result).toEqual(expect.objectContaining({ firstname: 'Ram' }));
        });
    });

    describe('setPrimaryKey', () => {
        it('should add a new primary key field', () => {
            const { directive } = createDirective(form);
            directive.setPrimaryKey('id');
            expect(form.primaryKey).toEqual(['id']);
        });

        it('should not add the same primary key twice', () => {
            form.primaryKey = ['id'];
            const { directive } = createDirective(form);
            directive.setPrimaryKey('id');
            expect(form.primaryKey).toEqual(['id']);
        });
    });

    describe('findOperationType', () => {
        it('should use the datasource operation type when it is not "read"', () => {
            form.datasource.execute.mockReturnValue('update');
            const { directive } = createDirective(form);
            expect(directive.findOperationType()).toEqual('update');
        });

        it('should return INSERT when there is no primary key data', () => {
            form.datasource.execute.mockReturnValue('read');
            form.primaryKey = [];
            form.formdata = {};
            const { directive } = createDirective(form);
            expect(directive.findOperationType()).toEqual(Live_Operations.INSERT);
        });

        it('should return UPDATE for a single primary key column with a value', () => {
            form.datasource.execute.mockReturnValue('read');
            form.primaryKey = ['id'];
            form.formdata = { id: 1 };
            const { directive } = createDirective(form);
            expect(directive.findOperationType()).toEqual(Live_Operations.UPDATE);
        });

        it('should return UPDATE for multiple primary key columns when one has a value', () => {
            form.datasource.execute.mockReturnValue('read');
            form.primaryKey = ['id', 'code'];
            form.formdata = { id: null, code: 'A1' };
            const { directive } = createDirective(form);
            expect(directive.findOperationType()).toEqual(Live_Operations.UPDATE);
        });
    });

    describe('getPrevDataValues / savePrevDataValues', () => {
        it('should restore field values from prevDataValues and reset the display', () => {
            const field = createMockField({ key: 'firstname' });
            form.formFields = [field];
            form.prevDataValues = [{ key: 'firstname', value: 'Ram' }];
            const { directive } = createDirective(form);
            directive.getPrevDataValues();
            expect(field.value).toEqual('Ram');
            expect(field.resetDisplayInput).toHaveBeenCalledTimes(1);
        });

        it('should snapshot current field key/value pairs', () => {
            const field = createMockField({ key: 'firstname', value: 'Ram' });
            form.formFields = [field];
            const { directive } = createDirective(form);
            directive.savePrevDataValues();
            expect(form.prevDataValues).toEqual([{ key: 'firstname', value: 'Ram' }]);
        });
    });

    describe('clearData', () => {
        it('should hide the message and clear the data model', () => {
            const { directive } = createDirective(form);
            directive.clearData();
            expect(form.toggleMessage).toHaveBeenCalledWith(false);
            expect(form.emptyDataModel).toHaveBeenCalledTimes(1);
        });
    });

    describe('setReadonlyFields', () => {
        it('should set the readonly state on every field', () => {
            const field = createMockField();
            form.formFields = [field];
            const { directive } = createDirective(form);
            directive.setReadonlyFields();
            expect(field.setReadOnlyState).toHaveBeenCalledTimes(1);
        });
    });

    describe('reset', () => {
        it('should reset form state and restore blob field hrefs for upload fields', () => {
            const field = createMockField({ key: 'photo', type: DataType.BLOB });
            form.formFields = [field];
            form.prevDataValues = [{ key: 'photo', value: 'old.png' }];
            const { directive } = createDirective(form);
            directive.reset();
            expect(form.resetFormState).toHaveBeenCalledTimes(1);
            expect(form.resetFileUploadWidget).toHaveBeenCalledWith(field, true);
        });
    });

    describe('closeDialog', () => {
        it('should close the dialog when the form is in dialog layout', () => {
            const { directive, dialogService } = createDirective(form, null, 'dialog');
            directive.closeDialog();
            expect(dialogService.close).toHaveBeenCalledWith(form.dialogId);
        });

        it('should do nothing when the form is not in dialog layout', () => {
            form.isLayoutDialog = false;
            const { directive, dialogService } = createDirective(form);
            directive.closeDialog();
            expect(dialogService.close).not.toHaveBeenCalled();
        });
    });

    describe('cancel', () => {
        it('should restore previous field values when a row was selected', () => {
            form.isSelected = true;
            const field = createMockField({ key: 'firstname', value: 'changed' });
            form.formFields = [field];
            form.prevformFields = [{ key: 'firstname', value: 'original' }];
            const { directive } = createDirective(form);
            directive.cancel();
            expect(form.clearMessage).toHaveBeenCalledTimes(1);
            expect(field.value).toEqual('original');
        });

        it('should delegate to the live table parent when present', () => {
            const liveTableParent = { onCancel: jest.fn() };
            form._liveTableParent = liveTableParent;
            const { directive, dialogService } = createDirective(form);
            directive.cancel();
            expect(liveTableParent.onCancel).toHaveBeenCalledTimes(1);
            expect(dialogService.close).not.toHaveBeenCalled();
        });

        it('should close the dialog itself when there is no live table parent', () => {
            const { directive, dialogService } = createDirective(form, null, 'dialog');
            directive.cancel();
            expect(dialogService.close).toHaveBeenCalledWith(form.dialogId);
        });
    });

    describe('delete', () => {
        it('should set the operation type to DELETE and invoke save with the callback', () => {
            const { directive } = createDirective(form);
            // delete() calls this.form.save(...), which the constructor bound to the real save() - spy on the form reference, not the directive's own.
            const saveSpy = jest.spyOn(form, 'save').mockImplementation(() => undefined);
            const cb = jest.fn();
            directive.delete(cb);
            expect(form.operationType).toEqual(Live_Operations.DELETE);
            expect(saveSpy).toHaveBeenCalledWith(undefined, undefined, undefined, cb);
        });
    });

    describe('saveAndNew / saveAndView / submitForm', () => {
        it('saveAndNew should save in update mode requesting a new form', () => {
            const { directive } = createDirective(form);
            const saveSpy = jest.spyOn(directive, 'save').mockImplementation(() => undefined);
            directive.saveAndNew();
            expect(saveSpy).toHaveBeenCalledWith(undefined, true, true);
        });

        it('saveAndView should save without requesting a new form', () => {
            const { directive } = createDirective(form);
            const saveSpy = jest.spyOn(directive, 'save').mockImplementation(() => undefined);
            directive.saveAndView();
            expect(saveSpy).toHaveBeenCalledWith(undefined, false);
        });

        it('submitForm should save with the triggering event', () => {
            const { directive } = createDirective(form);
            const saveSpy = jest.spyOn(directive, 'save').mockImplementation(() => undefined);
            const event = {};
            directive.submitForm(event);
            expect(saveSpy).toHaveBeenCalledWith(event);
        });
    });

    describe('save', () => {
        it('should do nothing when the form has no datasource', () => {
            form.datasource = null;
            const { directive } = createDirective(form);
            directive.save();
            expect(performDataOperation).not.toHaveBeenCalled();
        });

        it('should abort when the fields fail validation', () => {
            form.validateFieldsOnSubmit.mockReturnValue(true);
            const { directive } = createDirective(form);
            directive.save();
            expect(performDataOperation).not.toHaveBeenCalled();
        });

        it('should abort silently when the beforeservicecall handler returns false', () => {
            form.invokeEventCallback.mockReturnValue(false);
            const { directive } = createDirective(form);
            directive.save();
            expect(performDataOperation).not.toHaveBeenCalled();
        });

        it('should surface an error message when the beforeservicecall handler returns an error', () => {
            form.invokeEventCallback.mockReturnValue({ error: 'blocked' });
            const { directive } = createDirective(form);
            directive.save();
            expect(form.toggleMessage).toHaveBeenCalledWith(true, 'blocked', 'error');
            expect(performDataOperation).not.toHaveBeenCalled();
        });

        it('should silently abort when the beforeservicecall handler throws "Abort"', () => {
            form.invokeEventCallback.mockImplementation(() => { throw new Error('Abort'); });
            const { directive } = createDirective(form);
            expect(() => directive.save()).not.toThrow();
            expect(performDataOperation).not.toHaveBeenCalled();
        });

        it('should show a no-changes message when updating an untouched, unchanged pristine form', () => {
            form.operationType = Live_Operations.UPDATE;
            form.ngform.pristine = true;
            form.isSelected = true;
            form.prevformFields = [createMockField({ key: 'firstname', type: DataType.STRING, value: 'Ram' })];
            form.formFields = [createMockField({ key: 'firstname', type: DataType.STRING, value: 'Ram' })];
            form.getFormFields = jest.fn().mockReturnValue(form.formFields);
            const { directive } = createDirective(form);
            directive.save();
            expect(form.toggleMessage).toHaveBeenCalledWith(true, form.appLocale.MESSAGE_NO_CHANGES, 'info', '');
            expect(performDataOperation).not.toHaveBeenCalled();
        });

        it('should perform an insert and report success through the live table parent', async () => {
            form.operationType = Live_Operations.INSERT;
            const liveTableParent = { onResult: jest.fn() };
            form._liveTableParent = liveTableParent;
            (performDataOperation as jest.Mock).mockReturnValue(Promise.resolve({ id: 1 }));
            const { directive } = createDirective(form);
            directive.save();
            await new Promise(process.nextTick);
            await new Promise(process.nextTick);
            expect(liveTableParent.onResult).toHaveBeenCalledWith(Live_Operations.INSERT, { id: 1 }, undefined, undefined);
            expect(form.onResultCb).toHaveBeenCalledWith({ id: 1 }, true, undefined);
        });

        it('should refresh the list and update the form when there is no live table parent', async () => {
            form.operationType = Live_Operations.INSERT;
            (performDataOperation as jest.Mock).mockReturnValue(Promise.resolve({ id: 2 }));
            const { directive } = createDirective(form);
            directive.save();
            await new Promise(process.nextTick);
            await new Promise(process.nextTick);
            expect(form.datasource.execute).toHaveBeenCalledWith(DataSource.Operation.LIST_RECORDS, { skipToggleState: true });
        });

        it('should surface an error toggle message when the operation fails', async () => {
            form.operationType = Live_Operations.INSERT;
            (performDataOperation as jest.Mock).mockReturnValue(Promise.reject('failed'));
            const { directive } = createDirective(form);
            directive.save();
            await new Promise(process.nextTick);
            await new Promise(process.nextTick);
            expect(form.toggleMessage).toHaveBeenCalledWith(true, 'failed', 'error');
        });

        it('should clear selection state on a successful delete', async () => {
            form.operationType = Live_Operations.DELETE;
            (performDataOperation as jest.Mock).mockReturnValue(Promise.resolve({}));
            const { directive } = createDirective(form);
            directive.save();
            await new Promise(process.nextTick);
            await new Promise(process.nextTick);
            expect(form.emptyDataModel).toHaveBeenCalledTimes(1);
            expect(form.isSelected).toBe(false);
        });
    });

    describe('ngOnDestroy', () => {
        it('should cancel the debounced function and clear the form reference', () => {
            const { directive } = createDirective(form);
            const cancelFn = jest.fn();
            (directive as any)._debouncedSavePrevDataValues = Object.assign(jest.fn(), { cancel: cancelFn });
            directive.ngOnDestroy();
            expect(cancelFn).toHaveBeenCalledTimes(1);
            expect(directive.ngOnDestroy).toBeDefined();
        });
    });
});
