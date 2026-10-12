jest.mock('zone.js', () => ({}), { virtual: true });

describe('variables polyfills', () => {
    it('loads zone.js', () => {
        jest.isolateModules(() => {
            expect(() => require('./polyfills')).not.toThrow();
        });
    });
});
