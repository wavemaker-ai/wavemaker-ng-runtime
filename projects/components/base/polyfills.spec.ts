jest.mock('zone.js', () => ({}), { virtual: true });

describe('components base polyfills', () => {
    it('loads zone.js', () => {
        jest.isolateModules(() => {
            expect(() => require('./polyfills')).not.toThrow();
        });
    });
});
