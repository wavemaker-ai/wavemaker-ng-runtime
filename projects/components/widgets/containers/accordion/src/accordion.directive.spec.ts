import { Component, ViewChild } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AbstractI18nService, App, DynamicComponentRefProvider, StatePersistence } from '@wm/core';
import { TextContentDirective } from '@wm/components/base';
import { compileTestComponent, mockApp } from '../../../../base/src/test/util/component-test-util';
import { MockAbstractI18nService } from '../../../../base/src/test/util/date-test-util';
import { ITestModuleDef } from '../../../../base/src/test/common-widget.specs';
import { AccordionDirective } from './accordion.directive';
import { AccordionPaneComponent } from './accordion-pane/accordion-pane.component';

const markup = `
    <div wmAccordion name="acc1" closeothers="true">
        <div wmAccordionPane name="a1" title="One"></div>
        <div wmAccordionPane name="a2" title="Two"></div>
        <div wmAccordionPane name="a3" title="Three"></div>
    </div>`;

@Component({ standalone: false, template: markup })
class HostComponent {
    @ViewChild(AccordionDirective, { static: true }) wmComponent: AccordionDirective;
}

describe('AccordionDirective', () => {
    let statePersistence: any;
    let dynamicProvider: any;

    const moduleDef = (): ITestModuleDef => ({
        imports: [TextContentDirective, AccordionDirective, AccordionPaneComponent],
        declarations: [HostComponent],
        providers: [
            { provide: App, useValue: mockApp },
            { provide: AbstractI18nService, useClass: MockAbstractI18nService },
            { provide: DynamicComponentRefProvider, useValue: dynamicProvider },
            { provide: StatePersistence, useValue: statePersistence }
        ]
    });

    const setup = () => {
        const fixture: ComponentFixture<HostComponent> = compileTestComponent(moduleDef(), HostComponent);
        const accordion = fixture.componentInstance.wmComponent;
        fixture.detectChanges();
        return { fixture, accordion, panes: () => accordion.panes.toArray() as any[] };
    };

    beforeEach(() => {
        jest.useFakeTimers();
        statePersistence = {
            computeMode: jest.fn(() => 'none'),
            setWidgetState: jest.fn(),
            removeWidgetState: jest.fn(),
            getWidgetState: jest.fn()
        };
        dynamicProvider = { addComponent: jest.fn(() => Promise.resolve({ destroy: jest.fn() })) };
    });

    afterEach(() => {
        jest.clearAllTimers();
        jest.useRealTimers();
        jest.restoreAllMocks();
        TestBed.resetTestingModule();
    });

    describe('panes', () => {
        it('collects the panes and renders their headings', () => {
            const { fixture, panes } = setup();
            expect(panes()).toHaveLength(3);
            expect(fixture.nativeElement.querySelectorAll('.panel-heading')).toHaveLength(3);
            expect(panes().every(p => !p.isActive)).toBe(true);
        });

        it('expands a pane through a header click and fires events', () => {
            const { fixture, accordion, panes } = setup();
            const change = jest.spyOn(accordion as any, 'invokeEventCallback');
            const expand = jest.spyOn(panes()[0], 'invokeEventCallback');
            (fixture.nativeElement.querySelectorAll('.panel-heading')[0] as HTMLElement).click();
            fixture.detectChanges();
            expect(panes()[0].isActive).toBe(true);
            expect(expand).toHaveBeenCalledWith('expand', expect.anything());
            expect(change).toHaveBeenCalledWith('change', expect.objectContaining({ newPaneIndex: 0 }));
            expect(accordion.currentAccordionPaneIndex).toBe(0);
        });

        it('does not fire change for programmatic expansion', () => {
            const { accordion, panes } = setup();
            const spy = jest.spyOn(accordion as any, 'invokeEventCallback');
            panes()[1].expand();
            expect(spy).not.toHaveBeenCalledWith('change', expect.anything());
        });

        it('closes the other panes when closeothers is on', () => {
            const { accordion, panes } = setup();
            accordion.closeothers = true;
            panes()[0].expand();
            panes()[1].expand(new Event('click'));
            expect(panes()[0].isActive).toBe(false);
            expect(panes()[1].isActive).toBe(true);
        });

        it('keeps other panes open when closeothers is off', () => {
            const { accordion, panes } = setup();
            accordion.closeothers = false;
            panes()[0].expand();
            panes()[1].expand();
            expect(panes()[0].isActive).toBe(true);
            expect(panes()[1].isActive).toBe(true);
        });

        it('expanding and collapsing are idempotent and toggle works both ways', () => {
            const { panes } = setup();
            const p = panes()[0];
            p.collapse(); // already collapsed
            p.toggle(new Event('click'));
            expect(p.isActive).toBe(true);
            p.expand(); // already expanded
            const collapse = jest.spyOn(p, 'invokeEventCallback');
            p.toggle(new Event('click'));
            expect(p.isActive).toBe(false);
            expect(collapse).toHaveBeenCalledWith('collapse', expect.anything());
        });

        it('reports first and last panes', () => {
            const { accordion, panes } = setup();
            panes()[0].expand();
            expect(accordion.isFirstAccordionPane).toBe(true);
            expect(accordion.isLastAccordionPane).toBe(false);
            panes()[2].expand();
            expect(accordion.isFirstAccordionPane).toBe(false);
            expect(accordion.isLastAccordionPane).toBe(true);
        });

        it('expands the default pane when the panes change', () => {
            const { fixture, accordion, panes } = setup();
            accordion.defaultpaneindex = 1;
            accordion.panes.notifyOnChanges();
            fixture.detectChanges();
            expect(panes()[1].isActive).toBe(true);
        });

        it('does not expand anything when there are no panes after a change', () => {
            const { accordion } = setup();
            accordion.panes.reset([]);
            accordion.panes.notifyOnChanges();
            expect(accordion.panes.length).toBe(0);
        });
    });

    describe('state persistence', () => {
        it('persists the open pane names, or removes the state when none are open', () => {
            const { accordion, panes } = setup();
            statePersistence.computeMode.mockReturnValue('url');
            panes()[0].expand(new Event('click'));
            expect(statePersistence.setWidgetState).toHaveBeenCalledWith(accordion, ['a1']);
            panes()[0].collapse(new Event('click'));
            expect(statePersistence.removeWidgetState).toHaveBeenCalledWith(accordion);
        });

        it('does not persist programmatic changes or when the mode is none', () => {
            const { panes } = setup();
            statePersistence.computeMode.mockReturnValue('url');
            panes()[0].expand();
            statePersistence.computeMode.mockReturnValue('none');
            panes()[1].expand(new Event('click'));
            statePersistence.computeMode.mockReturnValue(undefined);
            panes()[2].expand(new Event('click'));
            expect(statePersistence.setWidgetState).not.toHaveBeenCalled();
        });

        it('restores persisted panes and warns about unknown names', () => {
            const { accordion, panes } = setup();
            const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
            accordion.closeothers = false;
            statePersistence.getWidgetState.mockReturnValue(['a2', 'ghost']);
            accordion.onPropertyChange('statehandler', 'url');
            expect(panes()[1].isActive).toBe(true);
            expect(warn).toHaveBeenCalledWith('Accordion pane name ghost in State is incorrect.');
        });

        it('falls back to the default pane when no state is stored or handling is none', () => {
            const { accordion, panes } = setup();
            accordion.defaultpaneindex = 2;
            statePersistence.getWidgetState.mockReturnValue(undefined);
            accordion.onPropertyChange('statehandler', 'url');
            expect(panes()[2].isActive).toBe(true);
            accordion.defaultpaneindex = 99;
            accordion.onPropertyChange('statehandler', 'none');
            expect(panes()[2].isActive).toBe(true);
        });
    });

    describe('properties', () => {
        it('handles default pane index, dataset, tabindex and other properties', () => {
            const { accordion } = setup();
            accordion.onPropertyChange('defaultpaneindex', 2);
            expect(accordion.defaultpaneindex).toBe(2);
            accordion.onPropertyChange('dataset', [1, 2]);
            expect(accordion.fieldDefs).toHaveLength(2);
            expect(accordion.onPropertyChange('tabindex', 1)).toBeUndefined();
            accordion.onPropertyChange('class', 'x', '');
        });

        it('pane properties: content lazy loading, tabindex and the rest', () => {
            const { panes } = setup();
            const [p1, p2] = panes();
            const lazy1 = jest.fn();
            const lazy2 = jest.fn();
            p1.$lazyLoad = lazy1;
            p2.$lazyLoad = lazy2;
            p1.expand();
            lazy1.mockClear();
            p1.onPropertyChange('content', 'X', '');
            p2.onPropertyChange('content', 'X', '');
            jest.advanceTimersByTime(150);
            expect(lazy1).toHaveBeenCalled();
            expect(lazy2).not.toHaveBeenCalled();
            expect(p1.onPropertyChange('tabindex', 1, 0)).toBeUndefined();
            p1.onPropertyChange('class', 'x', '');
        });
    });

    describe('getWidgets', () => {
        it('requires a name, and collects from all panes or one pane', () => {
            const { accordion, panes } = setup();
            expect(accordion.getWidgets('')).toBeUndefined();
            jest.spyOn(panes()[0], 'currentAccordionWidgets', 'get').mockReturnValue({ w: 'a' } as any);
            jest.spyOn(panes()[1], 'currentAccordionWidgets', 'get').mockReturnValue({ w: 'b' } as any);
            jest.spyOn(panes()[2], 'currentAccordionWidgets', 'get').mockReturnValue({} as any);
            expect(accordion.getWidgets('w')).toEqual(['a', 'b']);
            expect(accordion.getWidgets('w', 1)).toEqual(['b']);
            expect(accordion.getWidgets('w', '0' as any)).toEqual(['a']);
            expect(accordion.getWidgets('w', 99)).toBeUndefined();
        });
    });

    describe('dynamic panes', () => {
        it('adds panes, skipping duplicates, and passes params into the markup', () => {
            const { accordion } = setup();
            const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
            const names = accordion.addPane([{ name: 'dyn', title: 'D', params: { a: 1 } }, { title: 'No name' }, { name: 'a1' }]);
            expect(names).toEqual(['dyn', 'accordionpane5']);
            expect(warn).toHaveBeenCalledWith('The tab pane with name a1 already exists');
            expect(dynamicProvider.addComponent.mock.calls[0][1]).toContain('<wm-param name="a" value="1">');
        });

        it('wraps a single pane and reuses the dynamic context', () => {
            const { accordion } = setup();
            accordion.addPane({ name: 's1' });
            accordion.addPane({ name: 's2' });
            expect(dynamicProvider.addComponent.mock.calls[0][2]).toBe(dynamicProvider.addComponent.mock.calls[1][2]);
        });

        it('tracks created component references', async () => {
            const { accordion } = setup();
            accordion.addPane({ name: 'tracked' });
            await Promise.resolve();
            await Promise.resolve();
            expect((accordion as any).dynamicComponentRefs).toHaveLength(1);
            dynamicProvider.addComponent.mockResolvedValue(undefined);
            accordion.addPane({ name: 'untracked' });
            await Promise.resolve();
            await Promise.resolve();
            expect((accordion as any).dynamicComponentRefs).toHaveLength(1);
        });

        it('registers dynamic panes once all are initialised and expands the active one', () => {
            const { accordion, panes } = setup();
            (accordion as any).dynamicPaneIndex = 2;
            const expand = jest.fn();
            const a: any = { dynamicPaneIndex: 0, active: false, expand, name: 'a' };
            const b: any = { dynamicPaneIndex: 1, active: true, expand, name: 'b' };
            accordion.registerDynamicPane(a);
            expect(panes()).toHaveLength(3);
            accordion.registerDynamicPane(b);
            expect(accordion.panes.length).toBe(5);
            expect(expand).toHaveBeenCalledTimes(1);
            (accordion as any).dynamicPanes = [a];
            (accordion as any).dynamicPaneIndex = 1;
            accordion.registerDynamicPane(a);
        });

        it('registers a dynamic pane from its own view init', () => {
            const { fixture, accordion } = setup();
            const register = jest.spyOn(accordion, 'registerDynamicPane').mockImplementation(() => {});
            const pane: any = (accordion.panes.toArray() as any[])[0];
            pane.isdynamic = true;
            pane.ngAfterViewInit();
            expect(register).toHaveBeenCalledWith(pane);
            fixture.detectChanges();
        });

        it('removes panes by name', () => {
            const { accordion, panes } = setup();
            const remove = jest.spyOn(panes()[0], 'remove');
            accordion.removePane('a1');
            expect(remove).toHaveBeenCalledTimes(1);
            accordion.removePane('missing');
        });
    });

    describe('pane removal', () => {
        it('moves to the next pane when an active middle pane is removed', () => {
            const { accordion, panes } = setup();
            const [, p2, p3] = panes();
            p2.expand();
            p2.remove();
            expect(accordion.panes.length).toBe(2);
            expect(p3.isActive).toBe(true);
        });

        it('moves to the previous pane when the active last pane is removed', () => {
            const { accordion, panes } = setup();
            const [, p2, p3] = panes();
            p3.expand();
            p3.remove();
            expect(p2.isActive).toBe(true);
            expect(accordion.panes.length).toBe(2);
        });

        it('removes inactive panes and the only remaining pane quietly', () => {
            const { accordion, panes } = setup();
            const [p1, p2, p3] = panes();
            p3.remove();
            p2.remove();
            p1.expand();
            p1.remove();
            expect(accordion.panes.length).toBe(0);
        });
    });

    describe('redraw and load', () => {
        it('redraws children and fires load once for inline content', () => {
            const { panes } = setup();
            const pane = panes()[0];
            const redraw = jest.fn();
            pane.reDrawableComponents = [{ redraw }];
            const spy = jest.spyOn(pane, 'invokeEventCallback');
            pane.expand();
            jest.advanceTimersByTime(150);
            expect(redraw).toHaveBeenCalled();
            expect(spy).toHaveBeenCalledWith('load');
            spy.mockClear();
            pane.collapse();
            pane.expand();
            jest.advanceTimersByTime(150);
            expect(spy).not.toHaveBeenCalledWith('load');
        });

        it('does not fire load for partial content and tolerates no redrawable children', () => {
            const { panes } = setup();
            const pane = panes()[1];
            pane.content = 'Partial';
            pane.reDrawableComponents = undefined;
            const spy = jest.spyOn(pane, 'invokeEventCallback');
            pane.expand();
            jest.advanceTimersByTime(150);
            expect(spy).not.toHaveBeenCalledWith('load');
        });
    });

    describe('destroy', () => {
        it('releases subscriptions, dynamic components and references', () => {
            const { fixture, accordion, panes } = setup();
            const destroy = jest.fn();
            (accordion as any).dynamicComponentRefs = [{ destroy }, null, {}];
            (accordion as any)._dynamicContext = { a: 1 };
            const pane = panes()[0];
            fixture.destroy();
            expect(destroy).toHaveBeenCalled();
            expect(accordion.fieldDefs).toBeNull();
            expect(pane.$lazyLoad).toBeNull();
            expect(pane.reDrawableComponents).toBeNull();
        });
    });

    describe('leftover branches', () => {
        it('does not add a dynamic pane that already exists', () => {
            const { accordion, panes } = setup();
            const existing: any = panes()[0];
            existing.dynamicPaneIndex = 0;
            (accordion as any).dynamicPanes = [];
            (accordion as any).dynamicPaneIndex = 1;
            accordion.registerDynamicPane(existing);
            expect(accordion.panes.length).toBe(3);
        });

        it('tolerates being destroyed twice and without dynamic panes', () => {
            const { accordion } = setup();
            accordion.ngOnDestroy();
            (accordion as any).dynamicPanes = null;
            expect(() => accordion.ngOnDestroy()).not.toThrow();
        });

        it('exposes the widgets inside a pane', () => {
            const { panes } = setup();
            expect(panes()[0].currentAccordionWidgets).toBeDefined();
        });
    });
});
