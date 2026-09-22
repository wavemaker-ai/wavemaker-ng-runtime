jest.mock('./oAuth.utils', () => ({
    getAccessToken: jest.fn(),
    performAuthorization: jest.fn(),
    removeAccessToken: jest.fn(),
}));

import { getAccessToken, performAuthorization, removeAccessToken } from './oAuth.utils';
import { OAuthService } from './oAuth.service';

describe('OAuthService', () => {
    const createService = () => new OAuthService({} as any);

    afterEach(() => jest.clearAllMocks());

    describe('provider config management', () => {
        it('should add a new provider config and emit the updated list', () => {
            const service = createService();
            const emitted: any[] = [];
            service.getOAuthProvidersAsObservable().subscribe(v => emitted.push(v));
            service.addProviderConfig({ name: 'google' });
            expect(service.providersConfig).toEqual([{ name: 'google' }]);
            expect(emitted).toEqual([[{ name: 'google' }]]);
        });

        it('should not add a duplicate provider config with the same name', () => {
            const service = createService();
            service.addProviderConfig({ name: 'google' });
            service.addProviderConfig({ name: 'google' });
            expect(service.providersConfig.length).toBe(1);
        });

        it('should remove a provider config by id and emit the updated list', () => {
            const service = createService();
            service.addProviderConfig({ name: 'google' });
            service.addProviderConfig({ name: 'facebook' });
            const emitted: any[] = [];
            service.getOAuthProvidersAsObservable().subscribe(v => emitted.push(v));
            service.removeProviderConfig('google');
            expect(service.providersConfig).toEqual([{ name: 'facebook' }]);
            expect(emitted[emitted.length - 1]).toEqual([{ name: 'facebook' }]);
        });
    });

    describe('delegation to oAuth.utils', () => {
        it('should delegate perfromOAuthorization with bound add/remove callbacks', () => {
            const service = createService();
            service.perfromOAuthorization('url', 'google', 'onSuccess', 'onError', 'sec', 'scheme', 'deployed');
            expect(performAuthorization).toHaveBeenCalledWith(
                'url', 'google', 'onSuccess', 'onError', (service as any).httpService,
                expect.any(Function), expect.any(Function), 'sec', 'scheme', 'deployed'
            );
        });

        it('should delegate getAccessToken', () => {
            const service = createService();
            (getAccessToken as jest.Mock).mockReturnValue('token123');
            expect(service.getAccessToken('google', true)).toBe('token123');
            expect(getAccessToken).toHaveBeenCalledWith('google', true);
        });

        it('should delegate removeAccessToken', () => {
            const service = createService();
            service.removeAccessToken('google');
            expect(removeAccessToken).toHaveBeenCalledWith('google');
        });
    });

    describe('ngOnDestroy', () => {
        it('should complete the providers subject and clear the config array', () => {
            const service = createService();
            service.addProviderConfig({ name: 'google' });
            const completeSpy = jest.fn();
            service.providers.subscribe({ complete: completeSpy });
            service.ngOnDestroy();
            expect(service.providers).toBeNull();
            expect(service.providersConfig).toEqual([]);
            expect(completeSpy).toHaveBeenCalled();
        });

        it('should be safe to call twice', () => {
            const service = createService();
            service.ngOnDestroy();
            expect(() => service.ngOnDestroy()).not.toThrow();
        });
    });
});
