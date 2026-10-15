import { debounce } from './watcher';

describe('watcher: debounce default wait', () => {
    it('collapses rapid calls and fires once with the last arguments after the default 50ms', async () => {
        const fn = jest.fn();
        const d = debounce(fn);
        d(1);
        d(2);
        expect(fn).not.toHaveBeenCalled();
        await new Promise(r => setTimeout(r, 150));
        expect(fn).toHaveBeenCalledTimes(1);
        expect(fn).toHaveBeenCalledWith(2);
    });
});
