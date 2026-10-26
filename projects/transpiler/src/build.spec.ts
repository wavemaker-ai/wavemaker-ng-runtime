import {
    clearChildAttrs,
    createCompilerElement,
    getAttrMarkup,
    getBoundToExpr,
    getChildAttrs,
    getDataSource,
    getFormMarkupAttr,
    register,
    scopeComponentStyles,
    setChildAttrs,
    transpile
} from './build';
import { WIDGET_IMPORTS } from './imports';

const markupOf = (html: string) => transpile(html)!.markup;

describe('transpiler/build helpers', () => {
    describe('getBoundToExpr', () => {
        it('returns nothing for empty values', () => {
            expect(getBoundToExpr('')).toBeNull();
            expect(getBoundToExpr(undefined as any)).toBeNull();
        });

        it('extracts the expression of bind: values (trimmed)', () => {
            expect(getBoundToExpr('  bind:Variables.a.dataSet ')).toBe('Variables.a.dataSet');
        });

        it('returns undefined for static values', () => {
            expect(getBoundToExpr('plain')).toBeUndefined();
        });
    });

    describe('getDataSource', () => {
        it('resolves Variables and Widgets expressions', () => {
            expect(getDataSource('Variables.v1.dataSet.data')).toBe('Variables.v1');
            expect(getDataSource('Widgets.w1.datavalue')).toBe('Widgets.w1');
        });

        it('resolves variables of the active page', () => {
            expect(getDataSource('App.activePage.Variables.v2.dataSet')).toBe('App.activePage.Variables.v2');
        });

        it('returns undefined for anything else', () => {
            expect(getDataSource('foo.bar')).toBeUndefined();
            expect(getDataSource('App.activePage.Other.x')).toBeUndefined();
            expect(getDataSource('App.activePage.Variables')).toBeUndefined();
            expect(getDataSource('App.other')).toBeUndefined();
        });
    });

    it('createCompilerElement creates an empty element with the given name', () => {
        const el = createCompilerElement('ng-container');
        expect(el.name).toBe('ng-container');
        expect(el.attrs).toEqual([]);
        expect(el.children).toEqual([]);
    });

    describe('getAttrMarkup', () => {
        it('renders valued and value-less attributes', () => {
            expect(getAttrMarkup(new Map([['a', ' 1 '], ['flag', '']]))).toBe(' a="1" flag');
        });

        it('converts double quotes to single quotes in object [ngClass] values', () => {
            expect(getAttrMarkup(new Map([['[ngClass]', '{"a": x}']]))).toBe(` [ngClass]="{'a': x}"`);
            expect(getAttrMarkup(new Map([['[ngClass]', 'cls']]))).toBe(' [ngClass]="cls"');
        });

        it('adds a lazyLoad structural directive for deferred show bindings', () => {
            const out = getAttrMarkup(new Map([['show.bind', 'a.b'], ['deferload', 'true']]));
            expect(out).toContain('show.bind="a.b" *lazyLoad="&apos;a.b&apos;"');
            expect(getAttrMarkup(new Map([['show.bind', 'a.b'], ['deferload', 'false']]))).toBe(' show.bind="a.b" deferload="false"');
        });

        it('escapes quote entities inside the lazyLoad expression', () => {
            const out = getAttrMarkup(new Map([['show.bind', `a&apos;b&quot;c`], ['deferload', 'true']]));
            expect(out).toContain('*lazyLoad="&apos;a\\&quot;b\\&quot;c&apos;"');
        });
    });

    describe('child attrs', () => {
        afterEach(() => clearChildAttrs());

        it('stores only supported child attributes and returns the ones missing on the child', () => {
            expect(setChildAttrs(new Map([['required', 'true'], ['other', 'x']]))).toBe('');
            expect(getChildAttrs(new Map())).toBe(' required="true"');
            expect(getChildAttrs(new Map([['required', 'yes']]))).toBe('');
        });

        it('clears stored attributes', () => {
            setChildAttrs(new Map([['required', 'true']]));
            expect(clearChildAttrs()).toBe('');
            expect(getChildAttrs(new Map())).toBe('');
        });
    });

    describe('getFormMarkupAttr', () => {
        it('derives the datavalue source from a bound datavalue', () => {
            const attrs = new Map([['datavalue.bind', 'Variables.v.dataSet.name']]);
            expect(getFormMarkupAttr(attrs)).toContain('datavaluesource.bind="Variables.v"');
        });

        it('leaves other attributes alone', () => {
            expect(getFormMarkupAttr(new Map([['a', 'b']]))).toBe(' a="b"');
        });
    });
});

describe('transpile', () => {
    it('returns nothing for empty markup, no argument or parse errors', () => {
        expect(transpile('')).toBeUndefined();
        expect(transpile()).toBeUndefined();
        expect(transpile('</div>')).toBeUndefined();
    });

    describe('plain elements and attributes', () => {
        it('copies static attributes, text, and ignores comments', () => {
            expect(markupOf('<div class="a">hi<!-- note --></div>')).toBe('<div  class="a">hi</div>');
        });

        it('rewrites event, binding and override attributes', () => {
            const out = markupOf(`<div on-click="go()" title="bind:Variables.a.title" ng-if="x" ng-class="{a: b}" data-ng-src="s" ng-model="m"></div>`);
            expect(out).toContain('click.event="go()"');
            expect(out).toContain('title.bind="Variables.a.title"');
            expect(out).toContain('*ngIf="x"');
            expect(out).toContain(`[ngClass]="{a: b}"`);
            expect(out).toContain('src="s"');
            expect(out).toContain('[ngModelOptions]="{standalone: true}" [(ngModel)]="m"');
        });

        it('wraps accessroles and showindevice values in quotes', () => {
            const out = markupOf('<div accessroles="Admin" showindevice="xs"></div>');
            expect(out).toContain(`*accessroles="'Admin'"`);
            expect(out).toContain(`*wmShowInDevice="'xs'"`);
        });

        it('escapes special characters in bound expressions', () => {
            const out = markupOf(`<div title="bind:a < b && c > d || e == 'f' || g == &quot;h&quot;"></div>`);
            expect(out).toContain('&lt;');
            expect(out).toContain('&gt;');
            expect(out).toContain('&amp;&amp;');
            expect(out).toContain('&apos;');
        });

        it('handles attributes without a value span', () => {
            expect(markupOf('<div hidden></div>')).toContain(' hidden');
        });

        it('does not close void elements and handles svg names', () => {
            expect(markupOf('<img src="a.png">')).toBe('<img  src="a.png">');
            expect(markupOf('<svg><circle r="1"></circle></svg>')).toContain('<svg:circle');
            expect(markupOf('<svg></svg>')).toContain('<svg ');
        });

        it('derives datasource.bind from dataset.bind', () => {
            expect(markupOf('<div dataset="bind:Variables.v.dataSet"></div>')).toContain('datasource.bind="Variables.v"');
            expect(markupOf('<div dataset="bind:other.x"></div>')).not.toContain('datasource.bind');
        });
    });

    describe('dimension attributes', () => {
        it('expands unset-containing padding/margin/borderwidth values', () => {
            const out = markupOf('<div padding="1px unset 3px" margin="5px" borderwidth="1px unset"></div>');
            expect(out).toContain('paddingtop="1px"');
            expect(out).toContain('paddingbottom="3px"');
            expect(out).not.toContain('paddingright');
            expect(out).not.toContain('paddingleft');
            expect(out).toContain('margin="5px"');
            expect(out).toContain('bordertopwidth="1px"');
            expect(out).toContain('borderbottomwidth="1px"');
        });

        it('drops unset sides and uses the border prefix for border widths', () => {
            const out = markupOf('<div padding="unset" borderwidth="unset 2px"></div>');
            expect(out).not.toContain('padding');
            expect(out).not.toContain('bordertopwidth');
            expect(out).toContain('borderrightwidth="2px"');
            expect(out).toContain('borderleftwidth="2px"');
        });

        it('keeps plain border widths as borderwidth', () => {
            expect(markupOf('<div borderwidth="2px"></div>')).toContain('borderwidth="2px"');
        });
    });

    describe('registered widgets', () => {
        it('uses pre/post/template and collects imports', () => {
            const template = jest.fn();
            register('wm-spec-a', () => ({
                template,
                pre: (attrs, shared) => `<A name="${attrs.get('name')}">`,
                post: () => '</A>',
                imports: ['wm-label']
            }));
            const result: any = transpile('<wm-spec-a name="n1">x</wm-spec-a>');
            expect(result.markup).toBe('<A name="n1">x</A>');
            expect(template).toHaveBeenCalled();
            expect(result.requiredWMComponents).toEqual(expect.arrayContaining(WIDGET_IMPORTS.get('wm-label') as any));
        });

        it('supports imports computed from attributes', () => {
            register('wm-spec-b', () => ({ pre: () => '<B>', post: () => '</B>', imports: attrs => (attrs.get('type') === 'x' ? ['wm-button'] : []) }));
            const withImport: any = transpile('<wm-spec-b type="x"></wm-spec-b>');
            expect(withImport.requiredWMComponents.length).toBeGreaterThan(0);
            const without: any = transpile('<wm-spec-b type="y"></wm-spec-b>');
            expect(without.requiredWMComponents).toEqual([]);
        });

        it('falls back to empty pre/post/template when a definition omits them', () => {
            register('wm-spec-c', () => ({} as any));
            expect(markupOf('<wm-spec-c>t</wm-spec-c>')).toBe('t');
        });

        it('passes provided maps to children that require them', () => {
            const seen: any[] = [];
            register('wm-spec-parent', () => ({
                pre: () => '<P>',
                post: () => '</P>',
                provide: attrs => new Map([['who', attrs.get('name')]])
            }));
            register('wm-spec-child', () => ({
                requires: 'wm-spec-parent',
                pre: (attrs, shared, parent) => { seen.push(parent?.get('who')); return '<C>'; },
                post: () => '</C>'
            }));
            register('wm-spec-child-multi', () => ({
                requires: ['wm-spec-parent', 'wm-missing'],
                pre: (attrs, shared, parent, missing) => { seen.push([parent?.get('who'), missing]); return '<M>'; },
                post: () => ''
            }));
            register('wm-spec-child-bad', () => ({ requires: 5 as any, pre: () => '<X>', post: () => '' }));
            markupOf('<wm-spec-parent name="p1"><wm-spec-child></wm-spec-child><wm-spec-child-multi></wm-spec-child-multi><wm-spec-child-bad></wm-spec-child-bad></wm-spec-parent>');
            expect(seen).toEqual(['p1', ['p1', undefined]]);
        });

        it('accepts a static provide value and removes it after the node is processed', () => {
            const seen: any[] = [];
            const provided = new Map([['k', 'v']]);
            register('wm-spec-static', () => ({ pre: () => '', post: () => '', provide: provided as any }));
            register('wm-spec-after', () => ({ requires: 'wm-spec-static', pre: (a, s, p) => { seen.push(p); return ''; }, post: () => '' }));
            markupOf('<wm-spec-static><wm-spec-after></wm-spec-after></wm-spec-static><wm-spec-after></wm-spec-after>');
            expect(seen).toEqual([provided, undefined]);
        });

        it('links table columns to their table provider via the tableName attribute', () => {
            const seen: any[] = [];
            const tableProvide = new Map([['table_reference', '_ref']]);
            register('wm-table', () => ({ pre: () => '<T>', post: () => '</T>', provide: () => tableProvide }));
            register('wm-table-column', () => ({ requires: 'wm-table', pre: (a, s, t) => { seen.push(t); return '<TC>'; }, post: () => '</TC>' }));
            markupOf('<wm-table name="tbl"><wm-table-column tableName="tbl_ref"></wm-table-column></wm-table>');
            expect(seen).toEqual([tableProvide]);
        });
    });

    describe('structural directive wrappers', () => {
        const wrap = (attrs: string) => markupOf(`<section><div ${attrs} class="c"></div></section>`);

        it('adds no wrapper for a single structural attribute', () => {
            expect(wrap('accessroles="A"')).not.toContain('ng-container');
            expect(wrap('showindevice="xs"')).not.toContain('ng-container');
            expect(wrap('deferload="true"')).not.toContain('ng-container');
        });

        it('wraps showindevice + accessroles', () => {
            const out = wrap('showindevice="xs" accessroles="A"');
            expect(out.match(/<ng-container/g)).toHaveLength(2);
            expect(out.indexOf('accessroles')).toBeLessThan(out.indexOf('wmShowInDevice'));
            expect(out).toContain('class="c"');
        });

        it('wraps showindevice + deferload', () => {
            const out = wrap('showindevice="xs" deferload="true" show="bind:x"');
            expect(out.match(/<ng-container/g)).toHaveLength(2);
        });

        it('wraps accessroles + deferload, keeping the show attribute on the defer container', () => {
            const out = wrap('accessroles="A" deferload="true" show="bind:x"');
            expect(out.match(/<ng-container/g)).toHaveLength(2);
            expect(out).toContain('show.bind="x"');
        });

        it('wraps all three structural attributes in three containers', () => {
            const out = wrap('showindevice="xs" accessroles="A" deferload="true"');
            expect(out.match(/<ng-container/g)).toHaveLength(3);
        });

        it('wraps without a show attribute', () => {
            expect(wrap('accessroles="A" deferload="true"').match(/<ng-container/g)).toHaveLength(2);
        });
    });

    describe('required components', () => {
        it('are de-duplicated and sorted by source and name', () => {
            const result: any = transpile('<wm-label></wm-label><wm-button></wm-button><wm-label></wm-label>');
            const names = result.requiredWMComponents.map(c => `${c.from}:${c.name}`);
            expect(new Set(names).size).toBe(names.length);
            expect([...names].sort()).toEqual(names);
        });

        it('ignores nodes without known imports', () => {
            expect((transpile('<div></div>') as any).requiredWMComponents).toEqual([]);
        });

        it('collects structural directive imports from child attributes', () => {
            const result: any = transpile('<section><div accessroles="A" showindevice="xs" deferload="true"></div></section>');
            const names = result.requiredWMComponents.map(c => c.name);
            expect(names.length).toBeGreaterThan(0);
        });
    });
});

describe('WIDGET_IMPORTS', () => {
    it('maps widgets, directives and pipes to their imports', () => {
        expect(WIDGET_IMPORTS.get('wm-button')).toBeDefined();
        expect(WIDGET_IMPORTS.get('accessroles')).toBeDefined();
        expect(WIDGET_IMPORTS.get('lazyload')).toBeDefined();
        expect(WIDGET_IMPORTS.get('custom')).toBeDefined();
        WIDGET_IMPORTS.forEach(defs => defs.forEach(d => {
            expect(typeof d.from).toBe('string');
            expect(typeof d.name).toBe('string');
        }));
    });
});

describe('scopeComponentStyles', () => {
    it('returns styles untouched when scoping is disabled', () => {
        expect(scopeComponentStyles('Main', 'PAGE', '/*DISABLE_SCOPING*/ .a{}')).toBe('/*DISABLE_SCOPING*/ .a{}');
    });

    it('defaults to empty styles', () => {
        expect(scopeComponentStyles('Main', 'PAGE')).toBe('');
    });

    it.each([
        [0, 'app-page-main'],
        ['PAGE', 'app-page-main'],
        [1, 'app-prefab-main'],
        ['PREFAB', 'app-prefab-main'],
        [2, 'app-partial-main'],
        ['PARTIAL', 'app-partial-main'],
        [3, 'app-custom-main'],
        ['WIDGET', 'app-custom-main']
    ])('scopes selectors for component type %s', (type, scope) => {
        expect(scopeComponentStyles('Main', type, '.a { color: red; }')).toBe(`.wm-app ${scope} .a { color: red; }`);
    });

    it('leaves selectors untouched for unknown component types', () => {
        expect(scopeComponentStyles('Main', 99, '.a {}')).toBe('.a {}');
    });

    it('scopes every selector of a comma separated list', () => {
        expect(scopeComponentStyles('Main', 'PAGE', '.a, .b {}')).toBe('.wm-app app-page-main .a,.wm-app app-page-main .b {}');
    });

    it('keeps the leading whitespace of selectors', () => {
        expect(scopeComponentStyles('Main', 'PAGE', '\n  .a {}')).toBe('\n  .wm-app app-page-main .a {}');
    });

    it('respects selectors that already start with the app prefix', () => {
        expect(scopeComponentStyles('Main', 'PAGE', '.wm-app .a {}')).toBe('.wm-app app-page-main .a {}');
        expect(scopeComponentStyles('Main', 'PAGE', '.wm-app {}')).toBe('.wm-app app-page-main {}');
        expect(scopeComponentStyles('Main', 'PAGE', '.wm-app{}')).toBe('.wm-app{}');
    });

    it('does not scope at-rules, keyframe steps or font-face blocks', () => {
        const css = '@keyframes spin { from { a: 1 } 50% { a: 2 } to { a: 3 } } @media (max-width: 1px) { .x { a: 1 } } @font-face { font-family: f }';
        const out = scopeComponentStyles('Main', 'PAGE', css);
        expect(out).toContain('@keyframes spin {');
        expect(out).toContain('from {');
        expect(out).toContain('50% {');
        expect(out).toContain('@media (max-width: 1px) {');
        expect(out).toContain('@font-face {');
    });

    it('preserves comments', () => {
        const out = scopeComponentStyles('Main', 'PAGE', '/* keep { me } */ .a {}');
        expect(out).toContain('/* keep { me } */');
        expect(out).toContain('.wm-app app-page-main .a {}');
    });

    it('leaves unterminated comments unscoped', () => {
        const out = scopeComponentStyles('Main', 'PAGE', '/* never closed .a {}');
        expect(out).toContain('/* never closed');
    });
});

describe('transpile - providers with other attributes', () => {
    it('looks past attributes that are not the table name when resolving providers', () => {
        register('wm-prov-parent2', () => ({ pre: () => '<P>', post: () => '</P>', provide: attrs => new Map([['who', attrs.get('name')]]) }));
        register('wm-prov-child2', () => ({ requires: 'wm-prov-parent2', pre: () => '<C>', post: () => '</C>' }));
        expect(markupOf('<wm-prov-parent2 name="p"><wm-prov-child2 name="c" class="x"></wm-prov-child2></wm-prov-parent2>')).toContain('<C>');
    });
});
