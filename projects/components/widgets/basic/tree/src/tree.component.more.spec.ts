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
    template: '<ul wmTree name="moreTree" tabindex="1" show="true"></ul>',
})
class MoreTreeWrapperComponent {
    @ViewChild(TreeComponent, { static: true }) wmComponent: TreeComponent;
}

const moduleDef: ITestModuleDef = {
    declarations: [MoreTreeWrapperComponent],
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

describe('TreeComponent - additional behaviour', () => {
    let fixture: ComponentFixture<MoreTreeWrapperComponent>;
    let cmp: any;

    const znode = (extra: any = {}) => ({
        tId: 'tree_1',
        name: 'a',
        data: { label: 'a' },
        nodeId: 1,
        getParentNode: () => null,
        ...extra,
    });

    beforeEach(() => {
        fixture = compileTestComponent(moduleDef, MoreTreeWrapperComponent);
        cmp = fixture.componentInstance.wmComponent;
        fixture.detectChanges();
    });

    afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
        document.body.innerHTML = '';
    });

    describe('node markup', () => {
        it('adds the icon and disabled classes of a node', () => {
            expect(cmp.setNodeClasses('t', { icon: 'wi wi-a' })).toEqual({ add: ['wi wi-a'] });
            expect(cmp.setNodeClasses('t', { disabled: true })).toEqual({ add: ['wm-tree-node-disabled'] });
            expect(cmp.setNodeClasses('t', { icon: 'x', disabled: true })).toEqual({ add: ['x', 'wm-tree-node-disabled'] });
            expect(cmp.setNodeClasses('t', {})).toBe('');
        });

        it('builds the path of a node from its ancestors', () => {
            const root = znode({ name: 'root' });
            const child = znode({ name: 'child', getParentNode: () => root });
            expect(cmp.getPath(root, '')).toBe('/root');
            expect(cmp.getPath(child, '')).toBe('/root/child');
        });

        it('compares paths regardless of the leading and doubled slashes', () => {
            expect(cmp.treePathsEqual('/a/b', '/a/b')).toBe(true);
            expect(cmp.treePathsEqual('a/b', '/a/b')).toBe(true);
            expect(cmp.treePathsEqual('/a//b', 'a/b')).toBe(true);
            expect(cmp.treePathsEqual('/a/b', '/a/c')).toBe(false);
        });
    });

    describe('tree data', () => {
        it('converts nodes with selection, disabled state, icons and children', () => {
            cmp.nodes = [
                { label: 'A', selected: true, iconSkin: 'skin', iconOpen: 'open', iconClose: 'close', children: [{ label: 'A1', disabled: true, children: [] }] },
                { label: 'B', iconSkin: '', iconOpen: null, iconClose: undefined },
            ];
            const out: any[] = [];
            cmp.constructZTreeData(cmp.nodes, out);
            expect(out).toHaveLength(2);
            expect(out[0]).toMatchObject({ selected: true, iconSkin: 'skin', iconOpen: 'open', iconClose: 'close' });
            expect(out[0].children[0]).toMatchObject({ disabled: true, chkDisabled: true });
            expect(out[0].children[0].children).toBeUndefined();
            expect(out[1].iconSkin).toBeUndefined();
            expect(out[1].selected).toBeUndefined();
            expect(out[0].data).toEqual(expect.objectContaining({ label: 'A' }));
        });
    });

    describe('clicks and selection', () => {
        beforeEach(() => {
            cmp.zTree = { getSelectedNodes: jest.fn(() => []), expandNode: jest.fn(), selectNode: jest.fn() };
        });

        it('ignores clicks on disabled nodes', () => {
            const select = jest.spyOn(cmp, 'selectNode').mockImplementation(() => undefined);
            cmp.onClick({}, 't', { disabled: true }, 1);
            expect(select).not.toHaveBeenCalled();
        });

        it('toggles the selected node on click when nodes expand on click', () => {
            const select = jest.spyOn(cmp, 'selectNode').mockImplementation(() => undefined);
            const expand = jest.spyOn(cmp, 'expandNode').mockImplementation(() => undefined);
            cmp.nodeclick = 'expand';
            const node = znode({ open: false });
            cmp.zTree.getSelectedNodes.mockReturnValue([node]);
            cmp.onClick({}, 't', node, 1);
            expect(expand).toHaveBeenCalledWith(node, true, true);
            expect(select).toHaveBeenCalledWith({}, node);
            expand.mockClear();
            cmp.zTree.getSelectedNodes.mockReturnValue([]);
            cmp.onClick({}, 't', node, 1);
            expect(expand).not.toHaveBeenCalled();
            cmp.nodeclick = 'select';
            cmp.onClick({}, 't', node, 1);
            expect(expand).not.toHaveBeenCalled();
        });

        it('deselects everything when no node is given', () => {
            const clear = jest.spyOn(cmp, 'clearPersistedTreeSelection').mockImplementation(() => undefined);
            const refresh = jest.spyOn(cmp, 'refreshTreeNodeTemplateHosts').mockImplementation(() => undefined);
            cmp.selectNode({}, undefined);
            expect(clear).toHaveBeenCalled();
            expect(refresh).toHaveBeenCalled();
        });

        it('does not select disabled nodes', () => {
            const persist = jest.spyOn(cmp, 'persistTreeSelection').mockImplementation(() => undefined);
            cmp.selectNode({}, znode({ disabled: true }));
            expect(persist).not.toHaveBeenCalled();
        });

        it('selects a node, stores it and raises the select event and node action', () => {
            const persist = jest.spyOn(cmp, 'persistTreeSelection').mockImplementation(() => undefined);
            jest.spyOn(cmp, 'refreshTreeNodeTemplateHosts').mockImplementation(() => undefined);
            const invoke = jest.spyOn(cmp, 'invokeEventCallback').mockImplementation(() => undefined);
            const action = jest.fn();
            cmp.nodeaction = 'run';
            cmp.run = action;
            cmp.treeClass = 'Checkbox';
            jest.spyOn(cmp, 'setChecked').mockImplementation(() => undefined);
            const node = znode({ data: { label: 'a', run: 'this.run()' } });
            cmp.selectNode({ type: 'click' }, node);
            expect(cmp.selecteditem).toMatchObject({ label: 'a', path: '/a' });
            expect(persist).toHaveBeenCalledWith('/a', 1);
            expect(invoke).toHaveBeenCalledWith('select', expect.objectContaining({ $path: '/a' }));
            expect(cmp.setChecked).toHaveBeenCalled();
        });

        it('copies the checked state down to the children data', () => {
            const parent: any = { label: 'p', children: [{ label: 'c' }] };
            cmp.nodechildren = 'children';
            cmp.setChecked({ checked: true, children: [{ checked: false }] }, parent);
            expect(parent.checked).toBe(true);
            expect(parent.children[0].checked).toBe(false);
        });

        it('expands a node and adds the tree icon class to its switch', () => {
            document.body.insertAdjacentHTML('beforeend', '<span id="tree_1_switch"></span>');
            jest.spyOn(cmp, 'refreshTreeNodeTemplateHosts').mockImplementation(() => undefined);
            cmp.treeicons = 'my-icons';
            cmp.expandNode(znode(), true, false);
            expect(cmp.zTree.expandNode).toHaveBeenCalledWith(expect.anything(), true, false, false, false);
            expect(document.getElementById('tree_1_switch').classList.contains('my-icons')).toBe(true);
        });
    });

    describe('expand events', () => {
        it('raises the expand event and decorates the switches of parent children', () => {
            jest.useFakeTimers();
            document.body.insertAdjacentHTML('beforeend', '<span id="child_1_switch"></span><span id="child_2_switch"></span>');
            const invoke = jest.spyOn(cmp, 'invokeEventCallback').mockImplementation(() => undefined);
            cmp.treeicons = 'my-icons';
            const node = znode({ children: [{ isParent: true, tId: 'child_1' }, { isParent: false, tId: 'child_2' }] });
            cmp.onExpand({ type: 'x' }, 't', node);
            expect(invoke).toHaveBeenCalledWith('expand', expect.objectContaining({ $path: '/a' }));
            const first = document.getElementById('child_1_switch');
            expect(first.classList.contains('my-icons')).toBe(true);
            first.classList.remove('my-icons');
            first.click();
            jest.runAllTimers();
            expect(first.classList.contains('my-icons')).toBe(true);
            expect(document.getElementById('child_2_switch').classList.contains('my-icons')).toBe(false);
            cmp.onExpand({}, 't', znode());
        });
    });

    describe('rendering', () => {
        it('marks disabled nodes through the default node decorator', () => {
            document.body.insertAdjacentHTML('beforeend', '<span id="tree_1_switch"></span>');
            jest.spyOn(cmp, 'destroyNodeTemplateHostRefs').mockImplementation(() => undefined);
            cmp.template = undefined;
            try {
                cmp.renderTree();
            } catch (e) {
                // the zTree plugin may not be fully available in the test environment
            }
            const decorate = cmp.setting.view.addDiyDom;
            decorate('t', { disabled: true, tId: 'tree_1' });
            decorate('t', { disabled: false, tId: 'tree_1' });
            expect(document.getElementById('tree_1_switch').classList.contains('wm-tree-node-disabled')).toBe(true);
        });
    });

    describe('selection after rendering', () => {
        const nodes = () => [znode({ nodeId: 1, selected: true }), znode({ nodeId: 2, tId: 'tree_2' })];

        beforeEach(() => {
            cmp.zTree = { selectNode: jest.fn(), expandNode: jest.fn() };
        });

        it('does nothing without a rendered tree', () => {
            cmp.zTree = undefined;
            expect(() => cmp.syncSelectionAfterZTreeRender()).not.toThrow();
        });

        it('selects the node flagged in the data set', () => {
            jest.spyOn(cmp, 'getAllZTreeNodesFlat').mockReturnValue(nodes());
            const select = jest.spyOn(cmp, 'selectNode').mockImplementation(() => undefined);
            const expand = jest.spyOn(cmp, 'expandNode').mockImplementation(() => undefined);
            cmp.syncSelectionAfterZTreeRender();
            expect(cmp.zTree.selectNode).toHaveBeenCalledWith(expect.objectContaining({ nodeId: 1 }), false);
            expect(select).toHaveBeenCalled();
            expect(expand).toHaveBeenCalledWith(expect.objectContaining({ nodeId: 1 }), true, false);
        });

        it('restores the persisted selection when no node is flagged', () => {
            jest.spyOn(cmp, 'getAllZTreeNodesFlat').mockReturnValue([znode({ selected: false })]);
            jest.spyOn(cmp, 'readPersistedTreeSelection').mockReturnValue({ id: 1 });
            jest.spyOn(cmp, 'hasPersistedTreeSelection').mockReturnValue(true);
            const restore = jest.spyOn(cmp, 'restoreTreeSelectionFromPersistedState').mockReturnValue(true);
            const fallback = jest.spyOn(cmp, 'applyDatavalueDefaultSelection').mockImplementation(() => undefined);
            cmp.syncSelectionAfterZTreeRender();
            expect(restore).toHaveBeenCalled();
            expect(fallback).not.toHaveBeenCalled();
        });

        it('falls back to the default selection when nothing can be restored', () => {
            jest.spyOn(cmp, 'getAllZTreeNodesFlat').mockReturnValue([znode({ selected: false })]);
            jest.spyOn(cmp, 'readPersistedTreeSelection').mockReturnValue(undefined);
            jest.spyOn(cmp, 'hasPersistedTreeSelection').mockReturnValue(false);
            const fallback = jest.spyOn(cmp, 'applyDatavalueDefaultSelection').mockImplementation(() => undefined);
            cmp.syncSelectionAfterZTreeRender();
            expect(fallback).toHaveBeenCalled();
        });

        it('restores by stored id first and then by stored path', () => {
            const byId = znode({ nodeId: 5 });
            const byPath = znode({ nodeId: 6 });
            const apply = jest.spyOn(cmp, 'applyStoredSelectionToTree').mockImplementation(() => undefined);
            jest.spyOn(cmp, 'findZTreeNodeByStoredNodeId').mockImplementation((id: any) => (id === 5 ? byId : null));
            jest.spyOn(cmp, 'findZTreeNodeByStoredPath').mockImplementation((p: any) => (p === '/x' ? byPath : null));
            expect(cmp.restoreTreeSelectionFromPersistedState({ ['selectedNodeId']: 5 })).toBe(true);
            expect(apply).toHaveBeenCalledWith(byId);
            expect(cmp.restoreTreeSelectionFromPersistedState({ ['selectedNodeId']: 99, ['selectedNodePath']: '/x' })).toBe(true);
            expect(apply).toHaveBeenLastCalledWith(byPath);
            expect(cmp.restoreTreeSelectionFromPersistedState({ ['selectedNodePath']: '/none' })).toBe(false);
            expect(cmp.restoreTreeSelectionFromPersistedState(undefined)).toBe(false);
            cmp.zTree = undefined;
            expect(cmp.restoreTreeSelectionFromPersistedState({ ['selectedNodeId']: 5 })).toBe(false);
        });

        it('expands the ancestors of a stored node before selecting it', () => {
            const grand = znode({ name: 'g', getParentNode: () => null });
            const parent = znode({ name: 'p', getParentNode: () => grand });
            const leaf = znode({ name: 'l', getParentNode: () => parent });
            jest.spyOn(cmp, 'selectNode').mockImplementation(() => undefined);
            jest.spyOn(cmp, 'expandNode').mockImplementation(() => undefined);
            cmp.applyStoredSelectionToTree(leaf);
            expect(cmp.zTree.expandNode).toHaveBeenNthCalledWith(1, grand, true, false, false, true);
            expect(cmp.zTree.expandNode).toHaveBeenNthCalledWith(2, parent, true, false, false, true);
            cmp.zTree.selectNode.mockClear();
            cmp.applyStoredSelectionToTree(znode({ disabled: true }));
            cmp.applyStoredSelectionToTree(undefined);
            expect(cmp.zTree.selectNode).not.toHaveBeenCalled();
            expect(() => cmp.expandAncestors({})).not.toThrow();
        });
    });
});
