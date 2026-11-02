import { setDependency } from '../variable/variables.utils';
import { navigate } from './navigation-action.utils';

describe('navigate (NavigationAction utils)', () => {
    let navigationService: any;

    beforeEach(() => {
        navigationService = {
            goToPrevious: jest.fn(),
            goToPage: jest.fn(),
            goToView: jest.fn(),
        };
        setDependency('navigationService', navigationService);
    });

    it('should go to the previous page for goToPreviousPage operation', () => {
        navigate({ operation: 'goToPreviousPage', dataBinding: {} }, {});
        expect(navigationService.goToPrevious).toHaveBeenCalledTimes(1);
    });

    it('should go to the named page for gotoPage operation', () => {
        const variable: any = { operation: 'gotoPage', pageName: 'Home', dataBinding: {}, pageTransitions: 'fade' };
        navigate(variable, { $event: 'evt' });
        expect(navigationService.goToPage).toHaveBeenCalledWith('Home', expect.objectContaining({
            transition: 'fade',
            $event: 'evt',
        }));
    });

    it('should prefer dataBinding.pageName over the plain pageName for gotoPage', () => {
        const variable: any = { operation: 'gotoPage', pageName: 'Fallback', dataBinding: { pageName: 'Bound' } };
        navigate(variable, {});
        expect(navigationService.goToPage).toHaveBeenCalledWith('Bound', expect.anything());
    });

    it('should go to the named view for gotoView operation', () => {
        const variable: any = { operation: 'gotoView', viewName: 'DetailsView', dataBinding: {}, pageName: 'Home' };
        navigate(variable, {});
        expect(navigationService.goToView).toHaveBeenCalledWith('DetailsView', expect.objectContaining({ pageName: 'Home' }), variable);
    });

    it('should go to the named tab for gotoTab operation', () => {
        const variable: any = { operation: 'gotoTab', tabName: 'Tab1', dataBinding: {} };
        navigate(variable, {});
        expect(navigationService.goToView).toHaveBeenCalledWith('Tab1', expect.anything(), variable);
    });

    it('should go to the named accordion for gotoAccordion operation', () => {
        const variable: any = { operation: 'gotoAccordion', accordionName: 'Acc1', dataBinding: {} };
        navigate(variable, {});
        expect(navigationService.goToView).toHaveBeenCalledWith('Acc1', expect.anything(), variable);
    });

    it('should go to the named segment for gotoSegment operation', () => {
        const variable: any = { operation: 'gotoSegment', segmentName: 'Seg1', dataBinding: {} };
        navigate(variable, {});
        expect(navigationService.goToView).toHaveBeenCalledWith('Seg1', expect.anything(), variable);
    });

    it('should do nothing extra for an unrecognized operation', () => {
        const variable: any = { operation: 'unknown', dataBinding: {} };
        expect(() => navigate(variable, {})).not.toThrow();
        expect(navigationService.goToView).not.toHaveBeenCalled();
        expect(navigationService.goToPage).not.toHaveBeenCalled();
    });

    it('should mark the urlParams cacheable when a non-empty string cacheable is passed via options', () => {
        const variable: any = { operation: 'gotoPage', pageName: 'Home', dataBinding: {}, dataSet: { a: 1 } };
        navigate(variable, { cacheable: 'sectionA' });
        const [, opts] = navigationService.goToPage.mock.calls[0];
        expect(opts.urlParams._cache_page).toBe('sectionA');
    });

    it('should not mark cacheable when the cacheable string is blank', () => {
        const variable: any = { operation: 'gotoPage', pageName: 'Home', dataBinding: {}, dataSet: {} };
        navigate(variable, { cacheable: '   ' });
        const [, opts] = navigationService.goToPage.mock.calls[0];
        expect(opts.urlParams._cache_page).toBeUndefined();
    });
});
