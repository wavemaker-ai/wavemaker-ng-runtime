import { ComponentFixture } from '@angular/core/testing';
import { Component, ViewChild } from '@angular/core';
import { Subject } from 'rxjs';
import { AbstractDialogService, App, DataSource } from '@wm/core';
import { FileIconClassPipe, FileSizePipe, StateClassPipe } from '../../../../base/src/pipes/custom-pipes';
import { compileTestComponent, mockApp } from '../../../../base/src/test/util/component-test-util';
import { FileUploadComponent } from './file-upload.component';

jest.mock('@wm/core', () => ({
    ...jest.requireActual('@wm/core'),
    getWmProjectProperties: jest.fn(() => ({
        allowedFileUploadExtensions: 'doc, pdf, txt, image/*, json',
    })),
}));

@Component({
    standalone: false,
    template: `<div wmFileUpload name="fu" select.event="onSelect($event)"></div>`,
})
class HostComponent {
    @ViewChild(FileUploadComponent, { static: true }) wmComponent: FileUploadComponent;
    onSelect() {}
}

const dialogService = {
    showAppConfirmDialog: jest.fn(),
    closeAppConfirmDialog: jest.fn(),
};

const moduleDef = {
    declarations: [HostComponent],
    imports: [FileUploadComponent, FileSizePipe, FileIconClassPipe, StateClassPipe],
    providers: [
        { provide: App, useValue: mockApp },
        { provide: AbstractDialogService, useValue: dialogService },
    ],
};

const file = (name: string, size = 10): any => ({ name, size });

describe('FileUploadComponent - additional behaviour', () => {
    let fixture: ComponentFixture<HostComponent>;
    let cmp: any;

    beforeEach(() => {
        jest.clearAllMocks();
        fixture = compileTestComponent(moduleDef, HostComponent);
        cmp = fixture.componentInstance.wmComponent;
        fixture.detectChanges();
        cmp.appLocale = { LABEL_FILE_EXTENTION_VALIDATION_MESSAGE: 'Bad ext', LABEL_FILE_EXCEED_VALIDATION_MESSAGE: 'Too big' };
    });

    afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    describe('defaults', () => {
        it('derives the allowed extensions from the project properties', () => {
            expect(cmp.defaultAllowedExtensions).toEqual(['.doc', '.pdf', '.txt', 'image/*', '.json']);
            expect(cmp.chooseFilter).toEqual(cmp.defaultAllowedExtensions);
        });
    });

    describe('isValidFile', () => {
        it('accepts everything without a content type', () => {
            expect(cmp.isValidFile('a.exe', '', 'exe', false)).toBe(true);
        });

        it('validates media types by file kind', () => {
            expect(cmp.isValidFile('a.png', 'image/*', 'png', false)).toBe(true);
            expect(cmp.isValidFile('a.txt', 'image/*', 'txt', false)).toBeFalsy();
            expect(cmp.isValidFile('a.mp3', 'audio/*', 'mp3', false)).toBe(true);
            expect(cmp.isValidFile('a.mp4', 'video/*', 'mp4', false)).toBe(true);
            expect(cmp.isValidFile('a.txt', 'video/*', 'txt', false)).toBeFalsy();
        });

        it('accepts the bare media names only on mobile', () => {
            expect(cmp.isValidFile('a.png', 'image', 'png', true)).toBe(true);
            expect(cmp.isValidFile('a.png', 'image', 'png', false)).toBeFalsy();
            expect(cmp.isValidFile('a.mp3', 'audio', 'mp3', true)).toBe(true);
            expect(cmp.isValidFile('a.mp4', 'video', 'mp4', true)).toBe(true);
        });

        it('matches the extension case insensitively and falls through mixed lists', () => {
            expect(cmp.isValidFile('a.PDF', '.pdf', 'PDF', false)).toBe(true);
            expect(cmp.isValidFile('a.pdf', 'image/*,.pdf', 'pdf', false)).toBe(true);
            expect(cmp.isValidFile('a.zip', '.pdf', 'zip', false)).toBeUndefined();
        });
    });

    describe('getValidFiles', () => {
        beforeEach(() => {
            cmp.chooseFilter = '.pdf';
        });

        it('splits valid and invalid files and notifies the app without an error callback', () => {
            const notify = jest.spyOn(mockApp, 'notifyApp').mockImplementation(() => undefined);
            jest.spyOn(cmp, 'hasEventCallback').mockReturnValue(false);
            const result = cmp.getValidFiles([file('a.pdf'), file('b.exe')]);
            expect(result.validFiles).toHaveLength(1);
            expect(result.errorFiles).toHaveLength(1);
            expect(result.errorFiles[0].error).toEqual({ key: 'INVALID_FILE_EXTENSION', message: 'Bad ext .pdf' });
            expect(notify).toHaveBeenCalledWith('Bad ext .pdf', 'Error');
        });

        it('enforces the maximum file size and skips the toast with an error callback', () => {
            const notify = jest.spyOn(mockApp, 'notifyApp').mockImplementation(() => undefined);
            jest.spyOn(cmp, 'hasEventCallback').mockReturnValue(true);
            cmp.maxfilesize = '2';
            const big = file('a.pdf', 3 * 1048576);
            const result = cmp.getValidFiles([big, file('b.pdf', 1048576)]);
            expect(result.validFiles).toHaveLength(1);
            expect(big.error).toEqual({ key: 'INVALID_FILE_SIZE', message: 'Too big 2MB' });
            expect(notify).not.toHaveBeenCalled();
        });

        it('defaults the limit to 1MB and resets the mobile files filter', () => {
            jest.spyOn(cmp, 'hasEventCallback').mockReturnValue(true);
            cmp.maxfilesize = undefined;
            cmp.chooseFilter = 'files';
            const result = cmp.getValidFiles([file('x.any', 1048577), file('y.any', 5)]);
            expect(cmp.chooseFilter).toBe('');
            expect(result.validFiles).toHaveLength(1);
            expect(result.errorFiles[0].error.message).toBe('Too big 1MB');
        });
    });

    describe('small helpers', () => {
        it('returns the file extension', () => {
            expect(cmp.getFileExtension('a.b.txt')).toBe('txt');
            expect(cmp.getFileExtension('noext')).toBe('file');
            expect(cmp.getFileExtension(undefined)).toBe('file');
        });

        it('overwrites only default captions', () => {
            expect(cmp.getCaption('Select', true, false)).toBe('Drop your files here.');
            expect(cmp.getCaption('Drop your files here.', false, false)).toBe('Select');
            expect(cmp.getCaption('Select', true, true)).toBe('Select');
            expect(cmp.getCaption('Custom', true, false)).toBe('Custom');
        });

        it('stores the upload path and the clear icon settings', () => {
            cmp.changeServerUploadPath('/p');
            cmp.setClearIconClass('wi wi-x');
            cmp.setClearIconHint('remove');
            expect(cmp.selectedUploadTypePath).toBe('/p');
            expect(cmp.cleariconclass).toBe('wi wi-x');
            expect(cmp.cleariconhint).toBe('remove');
        });

        it('detects mime type extensions', () => {
            expect(cmp.isMimeType('a.png')).toBe(true);
            expect(cmp.isMimeType('a.mp3')).toBe(false);
            cmp.defaultAllowedExtensions = ['audio/*', 'video/*'];
            expect(cmp.isMimeType('a.mp3')).toBe(true);
            expect(cmp.isMimeType('a.mp4')).toBe(true);
            expect(cmp.isMimeType('a.png')).toBe(false);
        });

        it('aborts uploads through the data source', () => {
            cmp.datasource = { execute: jest.fn() };
            const f = file('a.pdf');
            cmp.abortFileUpload(f);
            expect(cmp.datasource.execute).toHaveBeenCalledWith(DataSource.Operation.CANCEL, f);
        });

        it('triggers the hidden file input', () => {
            const click = jest.fn();
            cmp.$element.find('.file-input').on('click', click);
            cmp.triggerFileSelect();
            expect(click).toHaveBeenCalledTimes(1);
        });
    });

    describe('selection', () => {
        it('assigns ids, tracks files and raises the select event asynchronously', () => {
            jest.useFakeTimers();
            const invoke = jest.spyOn(cmp, 'invokeEventCallback').mockImplementation(() => undefined);
            const files = [file('a.pdf'), file('b.pdf')];
            cmp.multiple = false;
            cmp.onSelectEventCall({ $files: { x: 1 } }, files);
            expect(files[0].uniqueId).toBeDefined();
            expect(files[0].uniqueId).not.toBe(files[1].uniqueId);
            expect(cmp.uploadedFiles).toBe(files);
            expect(invoke).not.toHaveBeenCalled();
            jest.runAllTimers();
            expect(invoke).toHaveBeenCalledWith('select', expect.objectContaining({ selectedFiles: files }));
        });

        it('accumulates files for multiple uploads', () => {
            jest.spyOn(cmp, 'invokeEventCallback').mockImplementation(() => undefined);
            cmp.multiple = true;
            cmp.uploadedFiles = [file('old.pdf')];
            cmp.onSelectEventCall({}, [file('new.pdf')]);
            expect(cmp.uploadedFiles.map((f: any) => f.name)).toEqual(['old.pdf', 'new.pdf']);
        });

        it('reports invalid files and clears the dropped folders on change events', () => {
            const invoke = jest.spyOn(cmp, 'invokeEventCallback').mockReturnValue(undefined);
            cmp.chooseFilter = '.pdf';
            jest.spyOn(cmp, 'hasEventCallback').mockReturnValue(true);
            cmp.selectedFolders = [{}];
            cmp.onFileSelect({ type: 'change' }, [file('x.exe')]);
            expect(cmp.selectedFolders).toEqual([]);
            expect(invoke).toHaveBeenCalledWith('error', expect.objectContaining({ files: [expect.objectContaining({ name: 'x.exe' })] }));
            expect(invoke).not.toHaveBeenCalledWith('beforeselect', expect.anything());
        });

        it('keeps the selection when no data source is bound and respects beforeselect', () => {
            jest.useFakeTimers();
            const invoke = jest.spyOn(cmp, 'invokeEventCallback').mockReturnValue(undefined);
            cmp.chooseFilter = '';
            const files = [file('a.pdf')];
            cmp.onFileSelect({ type: 'drop' }, files);
            expect(cmp.selectedFiles).toEqual(files);
            jest.runAllTimers();
            expect(invoke).toHaveBeenCalledWith('select', expect.anything());
            invoke.mockClear();
            invoke.mockImplementation((name: string) => (name === 'beforeselect' ? false : undefined));
            cmp.onFileSelect({ type: 'drop' }, [file('b.pdf')]);
            jest.runAllTimers();
            expect(invoke).not.toHaveBeenCalledWith('select', expect.anything());
        });

        it('tracks upload progress from the data source', () => {
            jest.spyOn(cmp, 'invokeEventCallback').mockReturnValue(undefined);
            cmp.chooseFilter = '';
            cmp.datasource = {};
            const f = file('a.pdf');
            cmp.uploadedFiles = [f];
            f.uniqueId = 'u1';
            cmp.onFileSelect({ type: 'drop' }, [f]);
            const first = cmp.uploadProgressSubscription;
            expect(cmp.datasource._progressObservable).toBe(cmp.progressObservable);
            const uploaded = cmp.uploadedFiles.find((x: any) => x.name === 'a.pdf');
            cmp.uploadedFiles = [uploaded];
            uploaded.uniqueId = 'u1';

            cmp.progressObservable.next({ fileName: 'a.pdf', uniqueId: 'u1', progress: 40, status: 'uploading' });
            expect(uploaded).toMatchObject({ progress: 40, status: 'uploading' });
            cmp.progressObservable.next({ fileName: 'a.pdf', uniqueId: 'u1', progress: 100, status: 'x' });
            expect(uploaded.status).toBe('success');
            cmp.progressObservable.next({ fileName: 'a.pdf', uniqueId: 'u1', progress: 10, status: 'error', errMsg: 'boom' });
            expect(uploaded.errMsg).toBe('boom');
            expect(cmp.invokeEventCallback).toHaveBeenCalledWith('error', expect.objectContaining({ files: uploaded }));
            cmp.progressObservable.next({ fileName: 'other', uniqueId: 'u1', progress: 5, status: 'x' });
            expect(uploaded.progress).toBe(10);

            cmp.onFileSelect({ type: 'drop' }, [file('c.pdf')]);
            expect(cmp.uploadProgressSubscription).toBe(first);
        });
    });

    describe('clearing', () => {
        it('clears all files without an argument', () => {
            cmp.selectedFiles = [file('a')];
            cmp.uploadedFiles = [file('a')];
            cmp.clear();
            expect(cmp.selectedFiles).toEqual([]);
            expect(cmp.uploadedFiles).toEqual([]);
        });

        it('clears one file', () => {
            const a = file('a');
            const b = file('b');
            cmp.selectedFiles = [a, b];
            cmp.uploadedFiles = [a, b];
            cmp.clear(a);
            expect(cmp.selectedFiles).toEqual([b]);
            expect(cmp.uploadedFiles).toEqual([b]);
        });
    });

    describe('delete', () => {
        const runDialog = (key: 'onOk' | 'onCancel' | 'onOpen') => dialogService.showAppConfirmDialog.mock.calls[0][0][key]();

        it('ignores empty files and honours beforedelete', () => {
            cmp.onFileDelete({}, undefined);
            expect(dialogService.showAppConfirmDialog).not.toHaveBeenCalled();
            jest.spyOn(cmp, 'invokeEventCallback').mockReturnValue(false);
            cmp.onFileDelete({}, file('a'));
            expect(dialogService.showAppConfirmDialog).not.toHaveBeenCalled();
        });

        it('closes the dialog on cancel and focuses the cancel button on open', () => {
            jest.spyOn(cmp, 'invokeEventCallback').mockReturnValue(undefined);
            cmp.onFileDelete({}, file('a'));
            runDialog('onCancel');
            expect(dialogService.closeAppConfirmDialog).toHaveBeenCalled();
            document.body.insertAdjacentHTML('beforeend', '<button class="cancel-action"></button>');
            runDialog('onOpen');
            expect(document.activeElement.classList.contains('cancel-action')).toBe(true);
            document.querySelector('.cancel-action').remove();
        });

        it('raises the delete event on confirm without a delete data source', () => {
            const invoke = jest.spyOn(cmp, 'invokeEventCallback').mockReturnValue(undefined);
            const f = file('a');
            cmp.onFileDelete({}, f);
            runDialog('onOk');
            expect(invoke).toHaveBeenCalledWith('delete', { $event: f });
            expect(dialogService.closeAppConfirmDialog).toHaveBeenCalled();
        });

        it('removes the file after the delete data source reports success', () => {
            jest.spyOn(cmp, 'invokeEventCallback').mockReturnValue(undefined);
            const f: any = { name: 'a', _response: { fileName: 'server-a' } };
            const other: any = file('b');
            cmp.selectedFiles = [f, other];
            cmp.uploadedFiles = [f, other];
            cmp.deletedatasource = { setInput: jest.fn() };
            cmp.onFileDelete({}, f);
            runDialog('onOk');
            expect(cmp.deletedatasource.setInput).toHaveBeenCalledWith('file', 'server-a');
            cmp.deleteFileObservable.next({ status: 'failure' });
            expect(cmp.uploadedFiles).toHaveLength(2);
            cmp.deleteFileObservable.next({ status: 'success' });
            expect(cmp.uploadedFiles).toEqual([other]);
            expect(cmp.selectedFiles).toEqual([other]);
        });

        it('falls back to the file name for the delete input', () => {
            jest.spyOn(cmp, 'invokeEventCallback').mockReturnValue(undefined);
            const f: any = { name: 'a', _response: {} };
            cmp.deletedatasource = { setInput: jest.fn() };
            cmp.onFileDelete({}, f);
            runDialog('onOk');
            expect(cmp.deletedatasource.setInput).toHaveBeenCalledWith('file', 'a');
        });
    });

    describe('drag and drop', () => {
        it('prevents the default drag over behaviour', () => {
            const e = { preventDefault: jest.fn(), stopPropagation: jest.fn() };
            cmp.dragOverHandler(e);
            expect(e.preventDefault).toHaveBeenCalledTimes(1);
            expect(e.stopPropagation).toHaveBeenCalledTimes(1);
        });

        it('splits dropped items into files and folders', () => {
            const select = jest.spyOn(cmp, 'onFileSelect').mockImplementation(() => undefined);
            const f = file('a.pdf');
            const dir = { name: 'dir' };
            const items = [
                { webkitGetAsEntry: () => ({ isFile: true, isDirectory: false }), getAsFile: () => f },
                { webkitGetAsEntry: () => ({ isFile: false, isDirectory: true }), getAsFile: () => dir },
                { webkitGetAsEntry: () => ({ isFile: false, isDirectory: false }), getAsFile: () => null },
            ];
            const e: any = { preventDefault: jest.fn(), dataTransfer: { items } };
            cmp.onFileDrop(e);
            expect(select).toHaveBeenCalledWith(e, [f]);
            expect(cmp.selectedFolders).toEqual([dir]);
        });

        it('does nothing for empty drops', () => {
            const select = jest.spyOn(cmp, 'onFileSelect').mockImplementation(() => undefined);
            cmp.onFileDrop({ preventDefault: jest.fn(), dataTransfer: { items: [] } });
            expect(select).not.toHaveBeenCalled();
        });

        it('highlights the drop box while dragging over the document', () => {
            let box = cmp.nativeElement.querySelector('#dropzone');
            if (!box) {
                box = document.createElement('div');
                box.id = 'dropzone';
                cmp.nativeElement.appendChild(box);
            }
            document.dispatchEvent(new Event('dragover'));
            expect(box.classList.contains('highlight-drop-box')).toBe(true);
            document.dispatchEvent(new Event('drop'));
            expect(box.classList.contains('highlight-drop-box')).toBe(false);
        });

        it('highlights the drop area on click and removes it when the window regains focus', () => {
            const ev: any = { stopPropagation: jest.fn() };
            cmp.onFileElemClick(ev);
            expect(cmp.highlightDropArea).toBe(true);
            expect(ev.stopPropagation).toHaveBeenCalled();
            window.dispatchEvent(new Event('focus'));
            expect(cmp.highlightDropArea).toBe(false);
        });
    });

    describe('onPropertyChange', () => {
        it('stores the upload path', () => {
            cmp.onPropertyChange('uploadpath', '/up', undefined);
            expect(cmp.selectedUploadTypePath).toBe('/up');
        });

        it('limits the choose filter to allowed extensions', () => {
            cmp.onPropertyChange('contenttype', '.pdf .exe image/*', '');
            expect(cmp.chooseFilter).toBe('.pdf,image/*');
            cmp.onPropertyChange('contenttype', '.exe', '');
            expect(cmp.chooseFilter).toEqual(cmp.defaultAllowedExtensions);
        });

        it('uses the content type as is when everything is allowed', () => {
            cmp.defaultAllowedExtensions = ['*/*'];
            cmp.onPropertyChange('contenttype', '.exe .zip', '');
            expect(cmp.chooseFilter).toBe('.exe,.zip');
        });

        it('updates the form name and caption for multiple', () => {
            cmp.name = 'fu';
            cmp.multiple = true;
            cmp.caption = 'Select';
            cmp.onPropertyChange('multiple', true, false);
            expect(cmp.formName).toBe('fu-multiple-fileupload');
            expect(cmp.caption).toBe('Drop your files here.');
            cmp.multiple = false;
            cmp.onPropertyChange('multiple', false, true);
            expect(cmp.formName).toBe('fu-single-fileupload');
        });

        it('updates the upload message', () => {
            cmp.onPropertyChange('fileuploadmessage', 'Drop here', '');
            expect(cmp.fileUploadMessage).toBe('Drop here');
        });
    });

    describe('destroy', () => {
        it('removes listeners and unsubscribes', () => {
            const sub = { unsubscribe: jest.fn() };
            cmp.uploadProgressSubscription = sub;
            const removeDoc = jest.spyOn(document, 'removeEventListener');
            const removeWin = jest.spyOn(window, 'removeEventListener');
            cmp.ngOnDestroy();
            expect(removeDoc).toHaveBeenCalledWith('dragover', expect.any(Function));
            expect(removeDoc).toHaveBeenCalledWith('mouseleave', expect.any(Function));
            expect(removeWin).toHaveBeenCalledWith('focus', expect.any(Function));
            expect(sub.unsubscribe).toHaveBeenCalled();
            expect(cmp.boundDragOverCb).toBeNull();
            expect(cmp.boundDropCb).toBeNull();
            expect(cmp.boundDisableDropZone).toBeNull();
        });

        it('tolerates a repeated destroy', () => {
            cmp.ngOnDestroy();
            expect(() => cmp.ngOnDestroy()).not.toThrow();
        });
    });
});
