import { WmPipe } from './wm-pipe';

class TestPipe extends WmPipe {
    constructor(manager: any) {
        super('testPipe', manager);
    }
    get state() {
        return { pipeRef: this.pipeRef, isCustomPipe: this.isCustomPipe };
    }
}

describe('WmPipe - cover', () => {
    it('has no pipe reference without a custom pipe manager', () => {
        const pipe = new TestPipe(null);
        expect(pipe.state.pipeRef).toBeNull();
        expect(pipe.state.isCustomPipe).toBeFalsy();
    });

    it('recognises custom pipes that expose a formatter', () => {
        const getCustomPipe = jest.fn().mockReturnValue({ formatter: (a, b) => `${a}-${b}` });
        const pipe = new TestPipe({ getCustomPipe });
        expect(getCustomPipe).toHaveBeenCalledWith('testPipe');
        expect(pipe.state.isCustomPipe).toBe(true);
        expect(pipe.customFormatter('data', ['x'], 'vars')).toBe('x-vars');
    });

    it('does not treat a pipe without formatter as custom and returns the data when formatting fails', () => {
        const pipe = new TestPipe({ getCustomPipe: () => ({}) });
        expect(pipe.state.isCustomPipe).toBe(false);
        expect(pipe.customFormatter('data', [], {})).toBe('data');
    });
});
