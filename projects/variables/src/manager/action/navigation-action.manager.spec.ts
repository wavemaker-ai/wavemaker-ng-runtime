jest.mock('../../util/action/navigation-action.utils', () => ({
    navigate: jest.fn(),
}));

import * as NVUtils from '../../util/action/navigation-action.utils';
import { NavigationActionManager } from './navigation-action.manager';

describe('NavigationActionManager', () => {
    it('invoke() should delegate to the navigate utility', () => {
        const manager = new NavigationActionManager();
        const variable: any = { operation: 'gotoPage' };
        const options = { a: 1 };
        manager.invoke(variable, options);
        expect(NVUtils.navigate).toHaveBeenCalledWith(variable, options);
    });
});
