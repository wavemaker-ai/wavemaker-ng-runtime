import { WmAppIconComponent } from './app-icon-component';

describe('WmAppIconComponent', () => {
    let cmp: WmAppIconComponent;
    beforeEach(() => {
        cmp = new WmAppIconComponent();
    });

    describe('effective icon url and class', () => {
        it('prefers iconurl over everything', () => {
            cmp.iconurl = 'a.png';
            cmp.icon = 'b.svg';
            expect(cmp._effectiveIconurl).toBe('a.png');
        });
        it('treats an svg icon as the url', () => {
            cmp.icon = 'path/b.svg';
            expect(cmp._effectiveIconurl).toBe('path/b.svg');
            expect(cmp._effectiveIconclass).toBeNull();
        });
        it('treats a non svg icon as a class', () => {
            cmp.icon = 'wi wi-user';
            expect(cmp._effectiveIconurl).toBeNull();
            expect(cmp._effectiveIconclass).toBe('wi wi-user');
        });
        it('prefers iconclass over icon', () => {
            cmp.iconclass = 'wi wi-a';
            cmp.icon = 'wi wi-b';
            expect(cmp._effectiveIconclass).toBe('wi wi-a');
        });
        it('has neither without inputs', () => {
            expect(cmp._effectiveIconurl).toBeNull();
            expect(cmp._effectiveIconclass).toBeNull();
        });
    });

    describe('branch selection', () => {
        it('renders svg for svg urls', () => {
            cmp.iconurl = 'x.svg';
            expect(cmp._isSvg).toBe(true);
            expect(cmp._isImage).toBe(false);
        });
        it('renders an image for other urls', () => {
            cmp.iconurl = 'x.png';
            expect(cmp._isSvg).toBe(false);
            expect(cmp._isImage).toBe(true);
        });
        it('renders a font icon otherwise', () => {
            cmp.iconclass = 'wi wi-x';
            cmp.defaultIconClass = 'fallback';
            expect(cmp._isImage).toBe(false);
            expect(cmp._fontClass).toBe('fallback wi wi-x');
        });
        it('renders nothing without any input', () => {
            expect(cmp._isSvg).toBe(false);
            expect(cmp._isImage).toBe(false);
            expect(cmp._fontClass).toBe('');
        });
        it('falls back to the default icon class alone', () => {
            cmp.defaultIconClass = 'wi wi-default';
            expect(cmp._fontClass).toBe('wi wi-default');
        });
    });

    describe('classes', () => {
        it('adds no extras by default', () => {
            expect(cmp._svgClasses).toEqual(['app-icon app-icon-svg']);
            expect(cmp._imageClasses).toEqual(['app-icon']);
            expect(cmp._fontClasses).toEqual(['app-icon']);
        });
        it('accepts extra classes as a string', () => {
            cmp.defaultClasses = ' panel-icon   big ';
            cmp.iconclass = 'wi wi-x';
            expect(cmp._svgClasses).toEqual(['app-icon app-icon-svg', 'panel-icon', 'big']);
            expect(cmp._imageClasses).toEqual(['app-icon', 'panel-icon', 'big']);
            expect(cmp._fontClasses).toEqual(['app-icon', 'panel-icon', 'big', 'wi', 'wi-x']);
        });
        it('accepts extra classes as an array', () => {
            cmp.defaultClasses = ['a', 'b'];
            expect(cmp._imageClasses).toEqual(['app-icon', 'a', 'b']);
        });
    });
});
