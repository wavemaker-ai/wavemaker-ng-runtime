jest.mock('zone.js', () => ({}), { virtual: true });

describe('polyfills', () => {
    it('loads zone.js', () => {
        jest.isolateModules(() => {
            expect(() => require('./polyfills')).not.toThrow();
        });
    });
});
