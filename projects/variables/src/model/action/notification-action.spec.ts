jest.mock('../../factory/variable-manager.factory', () => ({
    VariableManagerFactory: { get: jest.fn() },
}));

import { VariableManagerFactory } from '../../factory/variable-manager.factory';
import { NotificationAction } from './notification-action';
import { DataSource } from '@wm/core';

describe('NotificationAction', () => {
    afterEach(() => jest.clearAllMocks());

    const mockManager = () => {
        const manager: any = {
            notify: jest.fn(),
            getMessage: jest.fn().mockReturnValue('msg'),
            setMessage: jest.fn(),
            getOkButtonText: jest.fn().mockReturnValue('OK'),
            setOkButtonText: jest.fn(),
            getToasterDuration: jest.fn().mockReturnValue(3000),
            setToasterDuration: jest.fn(),
            getToasterClass: jest.fn().mockReturnValue('cls'),
            setToasterClass: jest.fn(),
            getToasterPosition: jest.fn().mockReturnValue('top'),
            setToasterPosition: jest.fn(),
            getAlertType: jest.fn().mockReturnValue('success'),
            setAlertType: jest.fn(),
            getCancelButtonText: jest.fn().mockReturnValue('Cancel'),
            setCancelButtonText: jest.fn(),
            initBinding: jest.fn(),
        };
        (VariableManagerFactory.get as jest.Mock).mockReturnValue(manager);
        return manager;
    };

    it('should copy variable config properties onto the instance', () => {
        const action: any = new NotificationAction({ name: 'notifyVar', message: 'Hello' });
        expect(action.name).toBe('notifyVar');
        expect(action.message).toBe('Hello');
    });

    it('notify() should delegate to the notification manager', () => {
        const manager = mockManager();
        const action = new NotificationAction({});
        action.notify({ a: 1 }, 'success', 'error');
        expect(manager.notify).toHaveBeenCalledWith(action, { a: 1 }, 'success', 'error');
    });

    it('invoke() should delegate to notify()', () => {
        mockManager();
        const action = new NotificationAction({});
        const notifySpy = jest.spyOn(action, 'notify');
        action.invoke({}, 'success', 'error');
        expect(notifySpy).toHaveBeenCalledWith({}, 'success', 'error');
    });

    describe('getter/setter delegation', () => {
        it('should delegate message getters/setters', () => {
            const manager = mockManager();
            const action = new NotificationAction({});
            expect(action.getMessage()).toBe('msg');
            action.setMessage('new message');
            expect(manager.setMessage).toHaveBeenCalledWith(action, 'new message');
            action.clearMessage();
            expect(manager.setMessage).toHaveBeenCalledWith(action, '');
        });

        it('should delegate ok/cancel button text getters/setters', () => {
            const manager = mockManager();
            const action = new NotificationAction({});
            expect(action.getOkButtonText()).toBe('OK');
            action.setOkButtonText('Yes');
            expect(manager.setOkButtonText).toHaveBeenCalledWith(action, 'Yes');
            expect(action.getCancelButtonText()).toBe('Cancel');
            action.setCancelButtonText('No');
            expect(manager.setCancelButtonText).toHaveBeenCalledWith(action, 'No');
        });

        it('should delegate toaster duration/class/position getters/setters', () => {
            const manager = mockManager();
            const action = new NotificationAction({});
            expect(action.getToasterDuration()).toBe(3000);
            action.setToasterDuration(5000);
            expect(manager.setToasterDuration).toHaveBeenCalledWith(action, 5000);
            expect(action.getToasterClass()).toBe('cls');
            action.setToasterClass('newCls');
            expect(manager.setToasterClass).toHaveBeenCalledWith(action, 'newCls');
            expect(action.getToasterPosition()).toBe('top');
            action.setToasterPosition('bottom');
            expect(manager.setToasterPosition).toHaveBeenCalledWith(action, 'bottom');
        });

        it('should delegate alert type getter/setter', () => {
            const manager = mockManager();
            const action = new NotificationAction({});
            expect(action.getAlertType()).toBe('success');
            action.setAlertType('error');
            expect(manager.setAlertType).toHaveBeenCalledWith(action, 'error');
        });
    });

    describe('init', () => {
        it('should initialize both dataBinding and dataSet property bindings', () => {
            const manager = mockManager();
            const action = new NotificationAction({});
            action.init();
            expect(manager.initBinding).toHaveBeenCalledWith(action, 'dataBinding', 'dataBinding');
            expect(manager.initBinding).toHaveBeenCalledWith(action, 'dataSet', 'dataSet');
        });
    });

    describe('execute', () => {
        it('should invoke via execute(INVOKE) and resolve on success', async () => {
            const manager = mockManager();
            const action = new NotificationAction({});
            manager.notify.mockImplementation((v: any, opts: any, success: any) => success('done'));
            const result = await action.execute(DataSource.Operation.INVOKE, {});
            expect(result).toBe('done');
        });

        it('should notify via execute(NOTIFY) and resolve on success', async () => {
            const manager = mockManager();
            const action = new NotificationAction({});
            manager.notify.mockImplementation((v: any, opts: any, success: any) => success('notified'));
            const result = await action.execute(DataSource.Operation.NOTIFY, {});
            expect(result).toBe('notified');
        });

        it('should reject for an unsupported operation', async () => {
            mockManager();
            const action = new NotificationAction({});
            await expect(action.execute(DataSource.Operation.GET_NAME, {})).rejects.toContain('is not supported');
        });

        it('should return the underlying BaseAction value directly when defined (e.g. GET_UNIQUE_IDENTIFIER)', () => {
            mockManager();
            const action: any = new NotificationAction({});
            action._id = 'abc123';
            const result = action.execute(DataSource.Operation.GET_UNIQUE_IDENTIFIER, {});
            expect(result).toBe('abc123');
        });
    });
});
