import * as utils from './variables.utils';

jest.mock('@wm/core', () => ({
    ...jest.requireActual('@wm/core'),
    $watch: jest.fn(() => jest.fn()),
}));

describe('variables.utils - more', () => {
    describe('setDependency', () => {
        const cases: Array<[string, string]> = [
            ['appManager', 'appManager'],
            ['http', 'httpService'],
            ['metadata', 'metadataService'],
            ['navigationService', 'navigationService'],
            ['router', 'routerService'],
            ['toaster', 'toasterService'],
            ['oAuth', 'oauthService'],
            ['security', 'securityService'],
            ['dialog', 'dialogService'],
        ];

        it.each(cases)('stores the %s reference on the matching exported binding', (type, exportName) => {
            const ref = { marker: type };
            utils.setDependency(type, ref);
            expect((utils as any)[exportName]).toBe(ref);
        });

        it('ignores unknown dependency types', () => {
            const before = utils.httpService;
            utils.setDependency('unknown', { x: 1 });
            expect(utils.httpService).toBe(before);
        });
    });

    describe('simulateFileDownload - anchor fallbacks', () => {
        const headersOf = (map: any) => ({ get: (name: string) => map[name] });
        const request = () => ({ url: '/export', method: 'POST', headers: { 'X-A': '1' }, data: 'd' });
        let errSpy: jest.SpyInstance;
        let open: jest.SpyInstance;
        const origFileReader = (window as any).FileReader;

        beforeEach(() => {
            jest.useFakeTimers();
            (window.URL as any).createObjectURL = jest.fn(() => 'blob:dl');
            (window.URL as any).revokeObjectURL = jest.fn();
            errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            open = jest.spyOn(window, 'open').mockReturnValue(null as any);
        });

        afterEach(() => {
            jest.useRealTimers();
            errSpy.mockRestore();
            open.mockRestore();
            (window as any).FileReader = origFileReader;
            delete (window.navigator as any).msSaveBlob;
            delete (window.URL as any).createObjectURL;
            delete (window.URL as any).revokeObjectURL;
            jest.restoreAllMocks();
            document.body.innerHTML = '';
        });

        const run = async (success, error, headers) => {
            utils.setDependency('http', { send: jest.fn().mockResolvedValue({ body: 'x', headers: headersOf(headers) }) });
            utils.simulateFileDownload(request(), 'report', 'CSV', success, error, undefined);
            await Promise.resolve();
            jest.advanceTimersByTime(900);
            jest.advanceTimersByTime(500);
        };

        it('calls the error callback when msSaveBlob reports failure', async () => {
            (window.navigator as any).msSaveBlob = jest.fn().mockReturnValue(false);
            const success = jest.fn();
            const error = jest.fn();
            await run(success, error, {});
            expect(error).toHaveBeenCalled();
            expect(success).not.toHaveBeenCalled();
        });

        it('falls back to navigating to the blob url when window.open is blocked and there is no file name', async () => {
            const success = jest.fn();
            await run(success, jest.fn(), { 'Content-Type': 'text/plain' });
            expect(open).toHaveBeenCalledWith('blob:dl', '_blank');
            expect(success).toHaveBeenCalled();
        });

        describe('browsers without the a[download] attribute (FileReader path)', () => {
            let created: any;
            beforeEach(() => {
                const realCreate = document.createElement.bind(document);
                jest.spyOn(document, 'createElement').mockImplementation(((tag: string) => tag === 'a' ? {} : realCreate(tag)) as any);
                created = {};
                (window as any).FileReader = class {
                    result = 'data:text/csv;base64,QQ==';
                    onloadend: any;
                    onload: any;
                    onerror: any;
                    readAsDataURL() {
                        created.reader = this;
                        this.onloadend();
                        this.onload();
                    }
                };
            });

            it('opens a data:attachment url in a new window and reports success', async () => {
                open.mockReturnValue({} as any);
                const success = jest.fn();
                await run(success, jest.fn(), { 'Content-Disposition': 'attachment; filename=a.csv', 'Content-Type': 'text/csv' });
                expect(open).toHaveBeenCalledWith('data:attachment/file;base64,QQ==', '_blank');
                expect(success).toHaveBeenCalled();
                expect(created.reader.onerror).toBeDefined();
            });

            it('navigates the current window when the popup is blocked', async () => {
                const success = jest.fn();
                await run(success, jest.fn(), { 'Content-Disposition': 'attachment; filename=a.csv', 'Content-Type': 'text/csv' });
                expect(open).toHaveBeenCalled();
                expect(success).toHaveBeenCalled();
            });
        });
    });
});
