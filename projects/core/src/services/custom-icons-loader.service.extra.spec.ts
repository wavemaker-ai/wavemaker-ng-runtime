import { CustomIconsLoaderService } from './custom-icons-loader.service';
import * as utils from '../utils/utils';
import * as props from '../utils/wm-project-properties';

jest.mock('../utils/utils', () => ({
    getFontConfig: jest.fn(),
    loadStyleSheets: jest.fn(),
    _WM_APP_PROJECT: { isPreview: true }
}));
jest.mock('../utils/wm-project-properties', () => ({
    loadPreviewFontConfig: jest.fn()
}));

const flush = () => new Promise(r => setTimeout(r, 0));

describe('CustomIconsLoaderService (preview mode)', () => {
    let service: CustomIconsLoaderService;

    beforeEach(() => {
        service = new CustomIconsLoaderService();
        jest.clearAllMocks();
        (utils._WM_APP_PROJECT as any).isPreview = true;
        (utils.getFontConfig as jest.Mock).mockReturnValue(undefined);
    });

    it('loads font.config.js in preview and loads css paths', async () => {
        (props.loadPreviewFontConfig as jest.Mock).mockResolvedValue({
            default: { fonts: [{ csspath: 'a.css' }, { name: 'nocss' }] }
        });
        service.load();
        await flush();
        expect(utils.loadStyleSheets).toHaveBeenCalledWith(['a.css']);
    });

    it('loads empty list when preview props have no default', async () => {
        (props.loadPreviewFontConfig as jest.Mock).mockResolvedValue(undefined);
        service.load();
        await flush();
        expect(utils.loadStyleSheets).toHaveBeenCalledWith([]);
    });

    it('falls back to empty list when preview font config fails to load', async () => {
        (props.loadPreviewFontConfig as jest.Mock).mockRejectedValue(new Error('fail'));
        service.load();
        await flush();
        expect(utils.loadStyleSheets).toHaveBeenCalledWith([]);
    });

    it('loads empty list when not preview and no font config', () => {
        (utils._WM_APP_PROJECT as any).isPreview = false;
        service.load();
        expect(props.loadPreviewFontConfig).not.toHaveBeenCalled();
        expect(utils.loadStyleSheets).toHaveBeenCalledWith([]);
    });

    it('uses font config directly when no default wrapper exists', () => {
        (utils.getFontConfig as jest.Mock).mockReturnValue({ fonts: [{ csspath: 'b.css' }] });
        service.load();
        expect(props.loadPreviewFontConfig).not.toHaveBeenCalled();
        expect(utils.loadStyleSheets).toHaveBeenCalledWith(['b.css']);
    });
});
