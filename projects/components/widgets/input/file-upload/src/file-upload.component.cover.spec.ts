import { ComponentFixture } from '@angular/core/testing';
import { Component, ViewChild } from '@angular/core';
import { AbstractDialogService, App } from '@wm/core';
import { FileIconClassPipe, FileSizePipe, StateClassPipe } from '../../../../base/src/pipes/custom-pipes';
import { compileTestComponent, mockApp } from '../../../../base/src/test/util/component-test-util';
import { FileUploadComponent } from './file-upload.component';

jest.mock('@wm/core', () => ({
    ...jest.requireActual('@wm/core'),
    getWmProjectProperties: jest.fn(() => ({ allowedFileUploadExtensions: '*/*' })),
}));

@Component({
    standalone: false,
    template: `<div wmFileUpload name="fu"></div>`,
})
class HostComponent {
    @ViewChild(FileUploadComponent, { static: true }) wmComponent: FileUploadComponent;
}

const dialogService = { showAppConfirmDialog: jest.fn(), closeAppConfirmDialog: jest.fn() };

describe('FileUploadComponent - remaining branches', () => {
    let fixture: ComponentFixture<HostComponent>;
    let cmp: any;

    beforeEach(() => {
        jest.clearAllMocks();
        fixture = compileTestComponent({
            declarations: [HostComponent],
            imports: [FileUploadComponent, FileSizePipe, FileIconClassPipe, StateClassPipe],
            providers: [
                { provide: App, useValue: mockApp },
                { provide: AbstractDialogService, useValue: dialogService },
            ],
        }, HostComponent);
        cmp = fixture.componentInstance.wmComponent;
        fixture.detectChanges();
    });

    it('uses an empty chooseFilter when every file type is allowed', () => {
        expect(cmp.defaultAllowedExtensions).toEqual(['*/*']);
        expect(cmp.chooseFilter).toBe('');
    });

    it('does not create a second delete observable when a progress subscription already exists', () => {
        jest.spyOn(cmp, 'invokeEventCallback').mockReturnValue(undefined);
        const setInput = jest.fn();
        cmp.deletedatasource = { setInput };
        cmp.deleteProgressSubscription = { unsubscribe: jest.fn() };
        cmp.deleteFileObservable = undefined;
        cmp.onFileDelete({}, { name: 'a', _response: {} });
        dialogService.showAppConfirmDialog.mock.calls[0][0].onOk();
        expect(setInput).toHaveBeenCalledWith('file', 'a');
        expect(cmp.deleteFileObservable).toBeUndefined();
        expect(dialogService.closeAppConfirmDialog).toHaveBeenCalled();
    });
});
