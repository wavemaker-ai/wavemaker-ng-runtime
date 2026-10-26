import { ComponentRefProvider, ComponentType } from './types';

describe('runtime-base types', () => {
    it('ComponentRefProvider.clearComponentFactoryRefCache is a callable no-op by default', () => {
        class Impl extends ComponentRefProvider {
            getComponentFactoryRef(): Promise<any> {
                return Promise.resolve(null);
            }
        }
        const impl = new Impl();
        expect(impl.clearComponentFactoryRefCache()).toBeUndefined();
        expect(ComponentType.WIDGET).toBe(3);
    });
});
