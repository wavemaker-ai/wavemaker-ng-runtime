import { setDependency } from '../variable/variables.utils';
import { navigate } from './navigation-action.utils';

describe('navigate - cache parameter', () => {
    let navigationService: any;

    beforeEach(() => {
        navigationService = { goToPrevious: jest.fn(), goToPage: jest.fn(), goToView: jest.fn() };
        setDependency('navigationService', navigationService);
    });

    const goTo = (cacheable: any, options: any = {}) => {
        navigate({ operation: 'gotoPage', pageName: 'Home', dataBinding: {}, dataSet: { a: 1 }, cacheable }, options);
        return navigationService.goToPage.mock.calls[0][1].urlParams;
    };

    it('passes a non blank string cache setting on as a url parameter', () => {
        expect(goTo('true')).toEqual({ a: 1, _cache_page: 'true' });
    });

    it('ignores a blank string cache setting', () => {
        expect(goTo('   ')).toEqual({ a: 1 });
    });

    it('passes a boolean cache setting on and lets the options override it', () => {
        expect(goTo(false)).toEqual({ a: 1, _cache_page: false });
        navigationService.goToPage.mockClear();
        expect(goTo(false, { cacheable: true })).toEqual({ a: 1, _cache_page: true });
    });

    it('works without options and falls back to the variable settings', () => {
        navigate({ operation: 'gotoPage', pageName: 'Home', dataBinding: {}, dataSet: { a: 1 }, cacheable: 'yes' }, undefined);
        const args = navigationService.goToPage.mock.calls[0][1];
        expect(args.urlParams).toEqual({ a: 1, _cache_page: 'yes' });
        expect(args.$event).toBeUndefined();
    });
});
