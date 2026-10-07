import {
    addClass,
    appendNode,
    createElement,
    insertAfter,
    insertBefore,
    removeAttr,
    removeClass,
    removeNode,
    setAttr,
    setCSS,
    setCSSFromObj,
    setHtml,
    setProperty,
    switchClass,
    toDimension,
    toggleClass
} from './dom';

const frame = () => new Promise(r => requestAnimationFrame(() => r(null)));

describe('core dom helpers', () => {
    let host: HTMLElement;
    beforeEach(() => {
        host = document.createElement('div');
        document.body.appendChild(host);
    });
    afterEach(() => {
        host.remove();
        jest.useRealTimers();
    });

    describe('node insertion/removal', () => {
        it('appendNode sync and async', async () => {
            const a = document.createElement('i');
            const b = document.createElement('b');
            appendNode(a, host, true);
            expect(host.firstChild).toBe(a);
            appendNode(b, host);
            expect(b.parentNode).toBeNull();
            await frame();
            expect(host.lastChild).toBe(b);
        });

        it('insertBefore / insertAfter sync and async', async () => {
            const ref = document.createElement('p');
            host.appendChild(ref);
            const before = document.createElement('i');
            const after = document.createElement('b');
            insertBefore(before, ref, true);
            insertAfter(after, ref, true);
            expect(Array.from(host.children)).toEqual([before, ref, after]);

            const before2 = document.createElement('u');
            const after2 = document.createElement('s');
            insertBefore(before2, ref);
            insertAfter(after2, ref);
            expect(before2.parentNode).toBeNull();
            await frame();
            expect(Array.from(host.children)).toEqual([before, before2, ref, after2, after]);
        });

        it('removeNode sync and async', async () => {
            const a = document.createElement('i');
            const b = document.createElement('b');
            host.append(a, b);
            removeNode(a, true);
            expect(a.parentNode).toBeNull();
            removeNode(b);
            expect(b.parentNode).toBe(host);
            await frame();
            expect(b.parentNode).toBeNull();
        });
    });

    describe('classes', () => {
        it('addClass / removeClass sync, ignoring empty tokens and null', () => {
            addClass(host, 'a  b', true);
            expect(host.className).toBe('a b');
            removeClass(host, 'a', true);
            expect(host.className).toBe('b');
            addClass(host, null, true);
            removeClass(host, undefined, true);
            expect(host.className).toBe('b');
        });

        it('addClass / removeClass batched in a frame', async () => {
            host.className = 'x';
            addClass(host, 'y z');
            removeClass(host, 'x');
            expect(host.className).toBe('x');
            await frame();
            expect(host.classList.contains('x')).toBe(false);
            expect(host.classList.contains('y')).toBe(true);
            expect(host.classList.contains('z')).toBe(true);
        });

        it('toggleClass adds or removes based on condition', () => {
            toggleClass(host, 'on', true, true);
            expect(host.classList.contains('on')).toBe(true);
            toggleClass(host, 'on', false, true);
            expect(host.classList.contains('on')).toBe(false);
        });

        it('switchClass removes then adds', () => {
            host.className = 'old';
            switchClass(host, 'new', 'old', true);
            expect(host.className).toBe('new');
        });

        it('switchClass defaults to empty strings', () => {
            host.className = 'keep';
            switchClass(host, undefined, undefined, true);
            expect(host.className).toBe('keep');
        });

        it('switchClass drops ng-invalid when node is untouched+valid and incoming classes include it', () => {
            host.className = 'ng-untouched ng-valid';
            switchClass(host, 'ng-untouched ng-invalid', '', true);
            expect(host.classList.contains('ng-invalid')).toBe(false);
            expect(host.classList.contains('ng-untouched')).toBe(true);
        });

        it('switchClass drops ng-invalid for the initial invalid/pristine/untouched state', () => {
            switchClass(host, 'ng-untouched ng-pristine ng-invalid', '', true);
            expect(host.classList.contains('ng-invalid')).toBe(false);
            expect(host.classList.contains('ng-pristine')).toBe(true);
        });

        it('switchClass keeps ng-invalid otherwise', () => {
            switchClass(host, 'ng-touched ng-invalid', '', true);
            expect(host.classList.contains('ng-invalid')).toBe(true);
        });
    });

    describe('css / property / html / attributes', () => {
        it('setCSS and setCSSFromObj', async () => {
            setCSS(host, 'color', 'red', true);
            expect(host.style.color).toBe('red');
            setCSSFromObj(host, { width: '10px', height: 5 as any }, true);
            expect(host.style.width).toBe('10px');
            setCSS(host, 'display', 'none');
            expect(host.style.display).toBe('');
            await frame();
            expect(host.style.display).toBe('none');
            expect(() => setCSSFromObj(host, null, true)).not.toThrow();
        });

        it('setProperty and setHtml', async () => {
            setProperty(host, 'title', 'T', true);
            expect(host.title).toBe('T');
            setHtml(host, '<span>x</span>', true);
            expect(host.innerHTML).toBe('<span>x</span>');
            setHtml(host, '<i></i>');
            setProperty(host, 'title', 'U');
            await frame();
            expect(host.innerHTML).toBe('<i></i>');
            expect(host.title).toBe('U');
        });

        it('setAttr normal attributes', async () => {
            setAttr(host, 'data-x', 'v', true);
            expect(host.getAttribute('data-x')).toBe('v');
            setAttr(host, 'data-y', 'w');
            expect(host.hasAttribute('data-y')).toBe(false);
            await frame();
            expect(host.getAttribute('data-y')).toBe('w');
        });

        it('setAttr tabindex handles 0, strings and null-ish/NaN removal', () => {
            setAttr(host, 'tabindex', 0, true);
            expect(host.getAttribute('tabindex')).toBe('0');
            setAttr(host, 'tabindex', -1, true);
            expect(host.getAttribute('tabindex')).toBe('-1');
            setAttr(host, 'tabindex', null, true);
            expect(host.hasAttribute('tabindex')).toBe(false);
            setAttr(host, 'tabindex', 3, true);
            setAttr(host, 'tabindex', undefined, true);
            expect(host.hasAttribute('tabindex')).toBe(false);
            setAttr(host, 'tabindex', 3, true);
            setAttr(host, 'tabindex', NaN, true);
            expect(host.hasAttribute('tabindex')).toBe(false);
        });

        it('setAttr is a no-op for non-Element nodes', () => {
            const fake: any = { setAttribute: jest.fn() };
            setAttr(fake, 'a', 'b', true);
            expect(fake.setAttribute).not.toHaveBeenCalled();
        });

        it('removeAttr sync and async', async () => {
            host.setAttribute('a', '1');
            host.setAttribute('b', '2');
            removeAttr(host, 'a', true);
            expect(host.hasAttribute('a')).toBe(false);
            removeAttr(host, 'b');
            expect(host.hasAttribute('b')).toBe(true);
            await frame();
            expect(host.hasAttribute('b')).toBe(false);
        });

        it('createElement with and without attrs', async () => {
            const plain = createElement('span', null);
            expect(plain.tagName).toBe('SPAN');
            expect(plain.attributes.length).toBe(0);
            const el = createElement('a', { href: '#x', role: 'link' }, true);
            expect(el.getAttribute('href')).toBe('#x');
            expect(el.getAttribute('role')).toBe('link');
            const lazy = createElement('a', { id: 'z' });
            expect(lazy.id).toBe('');
            await frame();
            expect(lazy.id).toBe('z');
        });
    });

    describe('toDimension', () => {
        it('appends px for numeric values and passes others through', () => {
            expect(toDimension(10)).toBe('10px');
            expect(toDimension('20')).toBe('20px');
            expect(toDimension('50%')).toBe('50%');
            expect(toDimension('auto')).toBe('auto');
        });
    });
});
