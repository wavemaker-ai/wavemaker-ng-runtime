import { Component, ViewChild } from '@angular/core';
import { ComponentFixture } from '@angular/core/testing';
import { AbstractI18nService, App, StatePersistence } from '@wm/core';
import { ITestModuleDef } from '../../../../base/src/test/common-widget.specs';
import { compileTestComponent, mockApp } from '../../../../base/src/test/util/component-test-util';
import { MockAbstractI18nService } from '../../../../base/src/test/util/date-test-util';
import '@ztree/ztree_v3/js/jquery.ztree.all.js';
import './keyboard-navigation.js';
import { TreeComponent } from './tree.component';

@Component({
    standalone: false,
    template: '<ul wmTree name="extraTree" tabindex="1" show="true"></ul>',
})
class ExtraTreeWrapperComponent {
    @ViewChild(TreeComponent, { static: true }) wmComponent: TreeComponent;
}

const moduleDef: ITestModuleDef = {
    declarations: [ExtraTreeWrapperComponent],
    imports: [TreeComponent],
    providers: [
        { provide: App, useValue: mockApp },
        { provide: AbstractI18nService, useClass: MockAbstractI18nService },
        {
            provide: StatePersistence,
            useValue: {
                getWidgetState: jest.fn(),
                setWidgetState: jest.fn(),
                removeWidgetState: jest.fn(),
                computeMode: jest.fn(() => 'none'),
            },
        },
    ],
};

describe('TreeComponent - extra behaviour', () => {
    let fixture: ComponentFixture<ExtraTreeWrapperComponent>;
    let tree: any;
    let render: jest.SpyInstance;

    beforeEach(() => {
        fixture = compileTestComponent(moduleDef, ExtraTreeWrapperComponent);
        tree = fixture.componentInstance.wmComponent;
        fixture.detectChanges();
        render = jest.spyOn(tree, 'renderTree').mockImplementation(() => undefined);
    });

    afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
        document.body.innerHTML = '';
    });

    describe('property changes', () => {
        it('re-renders for datasets and display properties', () => {
            jest.spyOn(tree, 'getNodes').mockReturnValue([{ label: 'n' }]);
            tree.onPropertyChange('dataset', [1]);
            expect(tree.nodes).toEqual([{ label: 'n' }]);
            expect(render).toHaveBeenCalledTimes(1);

            tree.onPropertyChange('levels', 2);
            expect(tree.level).toBe(2);
            tree.onPropertyChange('nodeicon', 'icon');
            expect(tree.nodeicon).toBe('icon');
            tree.onPropertyChange('nodelabel', 'name');
            expect(tree.nodelabel).toBe('name');
            tree.onPropertyChange('nodechildren', 'kids');
            expect(tree.nodechildren).toBe('kids');
            tree.onPropertyChange('orderby', 'name');
            expect(tree.orderby).toBe('name');
            tree.onPropertyChange('treeicons', 'fa fa-plus');
            expect(tree.treeicons).toBe('fa fa-plus');
            tree.onPropertyChange('template', 'Partial');
            expect(tree.template).toBe('Partial');
            expect(render).toHaveBeenCalledTimes(8);
        });

        it('applies the tree class', () => {
            const setTemplate = jest.spyOn(tree, 'setTreeTemplate').mockImplementation(() => undefined);
            tree.onPropertyChange('class', 'tree-custom', '');
            expect(tree.treeClass).toBe('tree-custom');
            expect(setTemplate).toHaveBeenCalledWith('tree-custom');
            expect(render).toHaveBeenCalled();
        });

        it('restores the stored selection when persistence is switched on for a rendered tree', () => {
            jest.useFakeTimers();
            const restore = jest.spyOn(tree, 'restorePersistedSelectionAfterStatehandlerChange').mockImplementation(() => undefined);
            tree.zTree = {};
            tree.nodes = [{}];
            tree.onPropertyChange('statehandler', 'URL', '');
            jest.runAllTimers();
            expect(restore).toHaveBeenCalledTimes(1);

            tree.onPropertyChange('statehandler', 'none', 'URL');
            jest.runAllTimers();
            expect(restore).toHaveBeenCalledTimes(1);
        });
    });

    describe('custom node templates', () => {
        it('sets the template and the prefab name before rendering', () => {
            tree.viewParent = { prefabName: 'lib' };
            tree.setTemplate('Node');
            expect(tree.template).toBe('Node');
            expect(tree.prefabName).toBe('lib');
            expect(render).toHaveBeenCalled();
            tree.viewParent = undefined;
            tree.setTemplate('Other');
            expect(tree.template).toBe('Other');
        });

        it('destroys the mounted template hosts', () => {
            const ref = { destroy: jest.fn() };
            tree.nodeTemplateRefs = [ref, ref];
            tree.destroyNodeTemplateHostRefs();
            expect(ref.destroy).toHaveBeenCalledTimes(2);
            expect(tree.nodeTemplateRefs).toEqual([]);
        });

        it('refreshes the hosts only when a template and hosts exist', () => {
            const detectChanges = jest.fn();
            const broken = jest.fn(() => { throw new Error('destroyed'); });
            tree.nodeTemplateRefs = [{ changeDetectorRef: { detectChanges } }, { changeDetectorRef: { detectChanges: broken } }];
            tree.template = undefined;
            tree.refreshTreeNodeTemplateHosts();
            expect(detectChanges).not.toHaveBeenCalled();
            tree.template = 'Node';
            tree.refreshTreeNodeTemplateHosts();
            expect(detectChanges).toHaveBeenCalledTimes(1);
            expect(broken).toHaveBeenCalled();
            tree.nodeTemplateRefs = [];
            detectChanges.mockClear();
            tree.refreshTreeNodeTemplateHosts();
            expect(detectChanges).not.toHaveBeenCalled();
        });

        describe('buildCustomTemplateItemProxy', () => {
            it('exposes the row data and node helpers', () => {
                const treeNode: any = { data: { name: 'a', nested: { x: 1 } }, isParent: true, open: false, label: 'a' };
                jest.spyOn(tree, 'expandNode').mockImplementation(() => undefined);
                tree.zTree = { isSelectedNode: jest.fn().mockReturnValue(true) };
                const proxy = tree.buildCustomTemplateItemProxy(treeNode);
                expect(proxy.name).toBe('a');
                expect(proxy.nested).toEqual({ x: 1 });
                expect(proxy.nested).not.toBe(treeNode.data.nested);
                expect(proxy._node.label).toBe('a');
                expect(proxy._node.isSelected).toBe(true);

                const event = { preventDefault: jest.fn(), stopPropagation: jest.fn() };
                proxy._node.toggleExpand(event);
                expect(event.preventDefault).toHaveBeenCalled();
                expect(tree.expandNode).toHaveBeenCalledWith(treeNode, true, true);
                proxy._node.toggleExpand();
                expect(tree.expandNode).toHaveBeenCalledTimes(2);
            });

            it('does not toggle leaves', () => {
                const treeNode: any = { data: 'plain', isParent: false };
                jest.spyOn(tree, 'expandNode').mockImplementation(() => undefined);
                tree.zTree = undefined;
                const proxy = tree.buildCustomTemplateItemProxy(treeNode);
                proxy._node.toggleExpand();
                expect(tree.expandNode).not.toHaveBeenCalled();
                expect(proxy._node.isSelected).toBe(false);
            });
        });

        describe('addDiyDom', () => {
            const node = (extra: any = {}) => ({ tId: 'tree_1', ...extra });

            const setup = () => {
                document.body.innerHTML = '<ul><li><a id="tree_1_a"><span id="tree_1_switch"></span><span id="tree_1_span"></span></a></li></ul>';
            };

            it('does nothing without a template', () => {
                setup();
                tree.template = undefined;
                tree.addDiyDom('t', node());
                expect(document.querySelector('.wm-tree-node-template-host')).toBeNull();
            });

            it('does nothing when the anchor is missing or already hosts a template', () => {
                const mount = jest.spyOn(tree, 'mountTreeNodeTemplateHost').mockImplementation(() => undefined);
                tree.template = 'Node';
                tree.addDiyDom('t', node({ tId: 'missing' }));
                expect(mount).not.toHaveBeenCalled();
                setup();
                document.querySelector('#tree_1_a')!.innerHTML = '<span class="wm-tree-node-template-host"></span>';
                tree.addDiyDom('t', node());
                expect(mount).not.toHaveBeenCalled();
            });

            it('replaces the default node markup by a template host', () => {
                const mount = jest.spyOn(tree, 'mountTreeNodeTemplateHost').mockImplementation(() => undefined);
                setup();
                tree.template = 'Node';
                tree.addDiyDom('t', node({ disabled: true }));
                const host = document.querySelector('.wm-tree-node-template-host') as HTMLElement;
                expect(host.classList.contains('wm-tree-node-disabled')).toBe(true);
                expect((document.querySelector('#tree_1_switch') as HTMLElement).style.display).toBe('none');
                expect((document.querySelector('#tree_1_span') as HTMLElement).style.display).toBe('none');
                expect(mount).toHaveBeenCalledWith(host, expect.objectContaining({ tId: 'tree_1' }));
            });

            it('does not mark enabled nodes as disabled', () => {
                jest.spyOn(tree, 'mountTreeNodeTemplateHost').mockImplementation(() => undefined);
                setup();
                tree.template = 'Node';
                tree.addDiyDom('t', node());
                expect(document.querySelector('.wm-tree-node-disabled')).toBeNull();
            });
        });

        it('destroys the template hosts together with the tree', () => {
            const ref = { destroy: jest.fn() };
            tree.nodeTemplateRefs = [ref];
            tree.ngOnDestroy();
            expect(ref.destroy).toHaveBeenCalledTimes(1);
        });
    });
});
