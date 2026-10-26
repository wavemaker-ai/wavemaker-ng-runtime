import { setDependency } from '../util/variable/variables.utils';
import { performAuthorization, getAccessToken, removeAccessToken } from './oAuth.utils';

describe('variables oAuth.utils', () => {
    let oauthService: any;
    let appManager: any;

    beforeEach(() => {
        oauthService = {
            perfromOAuthorization: jest.fn(),
            getAccessToken: jest.fn(),
            removeAccessToken: jest.fn(),
        };
        appManager = {
            getCustomUrlScheme: jest.fn().mockReturnValue('myapp://'),
            getDeployedURL: jest.fn().mockReturnValue('https://deployed.example.com/'),
        };
        setDependency('oAuth', oauthService);
        setDependency('appManager', appManager);
    });

    it('performAuthorization should delegate to the oauth service with the app scheme/deployed url', () => {
        performAuthorization('url', 'google', 'onSuccess', 'onError', { clientId: 'x' });
        expect(oauthService.perfromOAuthorization).toHaveBeenCalledWith(
            'url', 'google', 'onSuccess', 'onError', { clientId: 'x' }, 'myapp://', 'https://deployed.example.com/'
        );
    });

    it('getAccessToken should delegate to the oauth service', () => {
        oauthService.getAccessToken.mockReturnValue('token123');
        expect(getAccessToken('google', true)).toBe('token123');
        expect(oauthService.getAccessToken).toHaveBeenCalledWith('google', true);
    });

    it('removeAccessToken should delegate to the oauth service', () => {
        removeAccessToken('google');
        expect(oauthService.removeAccessToken).toHaveBeenCalledWith('google');
    });
});
