import { LiveFormDirective } from './live-form.directive';
import { Live_Operations } from '@wm/components/base';
import { DataType } from '@wm/core';

jest.mock('@wm/components/base', () => ({
    ...jest.requireActual('@wm/components/base'),
    performDataOperation: jest.fn(),
    applyFilterOnField: jest.fn(),
    fetchRelatedFieldData: jest.fn(),
    getDistinctValuesForField: jest.fn(),
    isDataSetWidget: jest.fn()
}));

import { performDataOperation } from '@wm/components/base';

const flush = async () => {
    await new Promise(process.nextTick);
    await new Promise(process.nextTick);
};

const makeField = (o: any = {}) => ({ key: 'firstname', type: DataType.STRING, widgettype: 'text', value: undefined, ...o });

const makeForm = (): any => ({
    parentForm: null,
    registerFormFields: jest.fn(),
    formFields: [makeField()],
    getFormFields: jest.fn(function (this: any) { return this.formFields; }),
    datasource: { execute: jest.fn() },
    operationType: undefined,
    prevformFields: null,
    prevDataObject: undefined,
    prevDataValues: [],
    formdata: {},
    name: 'f',
    updateFormDataOutput: jest.fn(function (this: any, d: any) { this.dataoutput = d; }),
    primaryKey: [],
    ngform: { pristine: false },
    appLocale: {},
    toggleMessage: jest.fn(),
    invokeEventCallback: jest.fn(),
    validateFieldsOnSubmit: jest.fn().mockReturnValue(false),
    resetFormState: jest.fn(),
    onResultCb: jest.fn(),
    insertmessage: 'I',
    updatemessage: 'U',
    deletemessage: 'D',
    emptyDataModel: jest.fn(),
    resetFileUploadWidget: jest.fn(),
    setFieldValue: jest.fn(),
    new: jest.fn(),
    setFormData: jest.fn(),
    save: jest.fn()
});

const make = (form: any) =>
    new LiveFormDirective(form, null, { transform: jest.fn() } as any, { open: jest.fn(), close: jest.fn() } as any, undefined as any);

describe('LiveFormDirective - cover branches', () => {
    let form: any;
    beforeEach(() => {
        jest.clearAllMocks();
        form = makeForm();
    });

    it('marks the form as user triggered on keydown', () => {
        const d: any = make(form);
        expect(d._triggeredByUser).toBeUndefined();
        d.onKeydownHandler({} as any);
        expect(d._triggeredByUser).toBe(true);
    });

    it('saves the previous data values through the debounced function', async () => {
        const d: any = make(form);
        const spy = jest.spyOn(d, 'savePrevDataValues').mockImplementation(() => undefined);
        d._debouncedSavePrevDataValues();
        await new Promise(r => setTimeout(r, 400));
        expect(spy).toHaveBeenCalledTimes(1);
        d.ngOnDestroy();
    });

    it('does not flag the datasource as updated when there are no form fields', () => {
        form.formFields = [];
        form.isDataSourceUpdated = false;
        const d: any = make(form);
        d.onDataSourceChange();
        expect(form.isDataSourceUpdated).toBe(false);
    });

    describe('setFormData', () => {
        it('treats a TIME field without a widget type as a time field', () => {
            const f = makeField({ key: 't', type: DataType.TIME, widgettype: undefined });
            const d: any = make(form);
            d.setFormData({ t: '10:30:00' }, [f]);
            expect(typeof f.value).toBe('number');
            expect(new Date(f.value).getHours()).toBe(10);
            expect(form.setFieldValue).not.toHaveBeenCalled();
        });
        it('reads the value by field name when no key is set and keeps non string blob values', () => {
            const blob = { size: 1 };
            const f: any = makeField({ key: undefined, name: 'doc', type: DataType.BLOB, widgettype: undefined });
            const d: any = make(form);
            d.setFormData({ doc: blob }, [f]);
            expect(f.value).toBe(blob);
            expect(form.resetFileUploadWidget).toHaveBeenCalledWith(f, true);
        });
    });

    describe('getDataObject', () => {
        it('falls back to an empty object when there is no form data', () => {
            form.operationType = Live_Operations.UPDATE;
            form.formdata = undefined;
            const d: any = make(form);
            expect(d.getDataObject()).toEqual({});
        });
    });

    describe('constructDataObject', () => {
        it('uses the complete key as field name when the key starts with a dot', () => {
            form.operationType = Live_Operations.INSERT;
            form.formFields = [makeField({ key: '.child', value: 'v' })];
            const d: any = make(form);
            expect(d.constructDataObject()).toEqual({ '.child': { child: 'v' } });
        });
    });

    describe('setPrimaryKey', () => {
        it('creates the list of keys on first use', () => {
            form.primaryKey = undefined;
            const d: any = make(form);
            d.setPrimaryKey('id');
            expect(form.primaryKey).toEqual(['id']);
        });
    });

    describe('findOperationType', () => {
        beforeEach(() => form.datasource.execute.mockReturnValue('read'));
        it('is an insert when the single primary key has no value', () => {
            form.primaryKey = ['id'];
            form.formdata = { id: 0, name: 'a' };
            expect((make(form) as any).findOperationType()).toBe(Live_Operations.INSERT);
        });
        it('is an update when no primary key is declared but the form data has a value', () => {
            form.primaryKey = [];
            form.formdata = { a: '', b: 'x' };
            expect((make(form) as any).findOperationType()).toBe(Live_Operations.UPDATE);
        });
        it('is an insert when no primary key is declared and the data is blank', () => {
            form.primaryKey = [];
            form.formdata = { a: '', b: 0 };
            expect((make(form) as any).findOperationType()).toBe(Live_Operations.INSERT);
        });
        it('is an insert when none of the composite keys has a value', () => {
            form.primaryKey = ['a', 'b'];
            form.formdata = { a: '', b: 0, c: 'x' };
            expect((make(form) as any).findOperationType()).toBe(Live_Operations.INSERT);
        });
        it('is an update when one of the composite keys has a value', () => {
            form.primaryKey = ['a', 'b'];
            form.formdata = { a: '', b: 7 };
            expect((make(form) as any).findOperationType()).toBe(Live_Operations.UPDATE);
        });
    });

    describe('delete', () => {
        it('works without form data', () => {
            form.formdata = undefined;
            (performDataOperation as jest.Mock).mockResolvedValue({});
            const d: any = make(form);
            d.delete(undefined);
            expect(form.prevDataObject).toEqual({});
            expect(form.operationType).toBe(Live_Operations.DELETE);
        });
    });

    describe('save', () => {
        it('goes on saving when the before service call handler throws something else', async () => {
            form.operationType = Live_Operations.INSERT;
            form.invokeEventCallback.mockImplementation(() => { throw new Error('boom'); });
            (performDataOperation as jest.Mock).mockResolvedValue({});
            make(form).save();
            await flush();
            expect(performDataOperation).toHaveBeenCalled();
        });

        it('sends the row and previous data on update and shows the update message', async () => {
            form.operationType = Live_Operations.UPDATE;
            form.formdata = { id: 1 };
            form.isSelected = false;
            (performDataOperation as jest.Mock).mockResolvedValue({ id: 1 });
            make(form).save();
            await flush();
            const req = (performDataOperation as jest.Mock).mock.calls[0][1];
            expect(req.rowData).toEqual({ id: 1 });
            expect(req.prevData).toBeDefined();
            expect(form.toggleMessage).toHaveBeenCalledWith(true, 'U', 'success');
        });

        it('shows the delete message', async () => {
            form.operationType = Live_Operations.DELETE;
            (performDataOperation as jest.Mock).mockResolvedValue({});
            make(form).save();
            await flush();
            expect(form.toggleMessage).toHaveBeenCalledWith(true, 'D', 'success');
        });

        it('leaves messaging to the custom success and error handlers', async () => {
            form.operationType = Live_Operations.INSERT;
            form.onSuccess = jest.fn();
            (performDataOperation as jest.Mock).mockResolvedValue({});
            make(form).save();
            await flush();
            expect(form.toggleMessage).not.toHaveBeenCalled();

            form.onError = jest.fn();
            (performDataOperation as jest.Mock).mockRejectedValue('err');
            make(form).save();
            await flush();
            expect(form.toggleMessage).not.toHaveBeenCalled();
            expect(form.onResultCb).toHaveBeenLastCalledWith('err', false, undefined);
        });
    });

    describe('ngOnDestroy', () => {
        it('can be called again after the debounced function was released', () => {
            const d: any = make(form);
            const cancel = jest.fn();
            d._debouncedSavePrevDataValues = Object.assign(() => undefined, { cancel });
            d.ngOnDestroy();
            expect(cancel).toHaveBeenCalled();
            expect(d._debouncedSavePrevDataValues).toBeNull();
            expect(() => d.ngOnDestroy()).not.toThrow();
            expect(d.form).toBeNull();
        });
    });
});
