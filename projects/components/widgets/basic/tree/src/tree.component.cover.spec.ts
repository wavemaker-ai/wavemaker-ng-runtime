import { Component, ViewChild } from '@angular/core';
import { ComponentFixture } from '@angular/core/testing';
import { AbstractI18nService, App, StatePersistence } from '@wm/core';
import { ITestModuleDef } from '../../../../base/src/test/common-widget.specs';
import { compileTestComponent, mockApp } from '../../../../base/src/test/util/component-test-util';
import { MockAbstractI18nService } from '../../../../base/src/test/util/date-test-util';
import '@ztree/ztree_v3/js/jquery.ztree.all.js';
import './keyboard-navigation.js';
import { TreeComponent } from './tree.component';

// lightweight stand-in so that the custom template host can be created without the partial machinery
jest.mock('./tree-node-template-host.component', () => {
    const core = jest.requireActual('@angular/core');
    class StubHost {
        template: string;
        userComponentParams: any;
    }
    core.Component({ selector: 'wm-tree-node-template-host', standalone: true, template: '<span class="stub-host"></span>', inputs: ['template', 'userComponentParams'] })(StubHost);
    return { TreeNodeTemplateHostComponent: StubHost };
});

@Component({
    standalone: false,
    template: '<ul wmTree name="coverTree" tabindex="1" show="true"></ul>',
})
class CoverTreeWrapperComponent {
    @ViewChild(TreeComponent, { static: true }) wmComponent: TreeComponent;
}

const stateMock = {
    getWidgetState: jest.fn(),
    setWidgetState: jest.fn(),
    removeWidgetState: jest.fn(),
    computeMode: jest.fn(() => 'none'),
};

const moduleDef: ITestModuleDef = {
    declarations: [CoverTreeWrapperComponent],
    imports: [TreeComponent],
    providers: [
        { provide: App, useValue: mockApp },
        { provide: AbstractI18nService, useClass: MockAbstractI18nService },
        { provide: StatePersistence, useValue: stateMock },
    ],
};

describe('TreeComponent - remaining branches', () => {
    let fixture: ComponentFixture<CoverTreeWrapperComponent>;
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
        jest.clearAllMocks();
        fixture = compileTestComponent(moduleDef, CoverTreeWrapperComponent);
        cmp = fixture.componentInstance.wmComponent;
        fixture.detectChanges();
    });

    afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
        document.body.innerHTML = '';
    });

    describe('statehandler changes', () => {
        it('restores the persisted selection after the handler changes on a rendered tree', () => {
            jest.useFakeTimers();
            const restore = jest.spyOn(cmp, 'restorePersistedSelectionAfterStatehandlerChange').mockImplementation(() => undefined);
            cmp.zTree = {};
            cmp.nodes = [{ label: 'a' }];
            cmp.onPropertyChange('statehandler', 'localStorage');
            jest.runAllTimers();
            expect(restore).toHaveBeenCalledTimes(1);
            // an empty handler value is not "none", so the selection is restored as well
            cmp.onPropertyChange('statehandler', undefined);
            jest.runAllTimers();
            expect(restore).toHaveBeenCalledTimes(2);
        });

        it('does not restore for "none", or without a rendered tree', () => {
            jest.useFakeTimers();
            const restore = jest.spyOn(cmp, 'restorePersistedSelectionAfterStatehandlerChange').mockImplementation(() => undefined);
            cmp.zTree = {};
            cmp.nodes = [{ label: 'a' }];
            cmp.onPropertyChange('statehandler', 'none');
            cmp.zTree = undefined;
            cmp.onPropertyChange('statehandler', 'localStorage');
            jest.runAllTimers();
            expect(restore).not.toHaveBeenCalled();
        });

        it('skips restoring when the stored state holds no selection', () => {
            cmp.zTree = {};
            stateMock.computeMode.mockReturnValueOnce('localStorage' as any);
            jest.spyOn(cmp, 'readPersistedTreeSelection').mockReturnValue({});
            const restore = jest.spyOn(cmp, 'restoreTreeSelectionFromPersistedState').mockReturnValue(true);
            cmp.restorePersistedSelectionAfterStatehandlerChange();
            expect(restore).not.toHaveBeenCalled();
        });
    });

    describe('small helpers', () => {
        it('keeps the check settings when no template class is given', () => {
            const before = JSON.stringify(cmp.setting.check);
            cmp.setTreeTemplate(undefined);
            expect(JSON.stringify(cmp.setting.check)).toBe(before);
        });

        it('treats blank strings as no data', () => {
            expect(cmp.getNodes('   ')).toBeUndefined();
        });

        it('finds no node for an unknown stored path', () => {
            cmp.zTree = {};
            jest.spyOn(cmp, 'getAllZTreeNodesFlat').mockReturnValue([znode()]);
            expect(cmp.findZTreeNodeByStoredPath('/nope')).toBeNull();
        });
    });

    describe('expanding', () => {
        it('falls back to the default tree icon class for child switches', () => {
            jest.useFakeTimers();
            document.body.insertAdjacentHTML('beforeend', '<span id="child_1_switch"></span>');
            cmp.treeicons = '';
            cmp.onExpand({}, 't', znode({ children: [{ tId: 'child_1', isParent: true }] }));
            const el = document.getElementById('child_1_switch');
            const initial = el.className;
            expect(initial.length).toBeGreaterThan(0);
            el.className = '';
            el.click();
            jest.runAllTimers();
            expect(el.className).toBe(initial);
        });
    });

    describe('tree data', () => {
        it('falls back through key, name and an empty label', () => {
            const out: any[] = [];
            cmp.nodes = [];
            cmp.constructZTreeData([{ key: 'k' }, { name: 'n' }, { other: 1 }], out);
            expect(out.map((n) => n.name)).toEqual(['k', 'n', '']);
        });

        it('does not set the node icon for custom templates', () => {
            const out: any[] = [];
            cmp.template = 'Node';
            cmp.constructZTreeData([{ label: 'x', icon: 'wi wi-x' }], out);
            expect('icon' in out[0]).toBe(false);
            cmp.template = undefined;
            const out2: any[] = [];
            cmp.constructZTreeData([{ label: 'x', icon: 'wi wi-x' }], out2);
            expect(out2[0].icon).toBe('wi wi-x');
        });
    });

    describe('rendering', () => {
        it('uses the custom node decorator for templates and renders empty trees', () => {
            cmp.template = 'Node';
            cmp.nodes = [];
            cmp.renderTree();
            expect(cmp.setting.view.addDiyDom).toBe(cmp.addDiyDom);
            expect(cmp.zTreeNodes).toEqual([]);
            expect(cmp.nativeElement.classList.contains('app-tree-custom')).toBe(true);
            expect(cmp.zTree).toBeTruthy();
        });

        it('expands the tree to the configured level', () => {
            cmp.template = undefined;
            cmp.level = 2;
            cmp.nodes = [{ label: 'root', children: [{ label: 'child', children: [{ label: 'leaf' }] }] }];
            cmp.renderTree();
            expect(cmp.zTreeNodes[0].open).toBe(true);
            expect(cmp.zTreeNodes[0].children[0].open).toBe(true);
            expect(cmp.zTreeNodes[0].children[0].children[0].open).toBeUndefined();
        });
    });

    describe('custom node templates', () => {
        it('mounts the template host with the node proxy and keeps track of it', () => {
            cmp.template = 'NodeTpl';
            const host = document.createElement('span');
            document.body.appendChild(host);
            cmp.mountTreeNodeTemplateHost(host, znode());
            expect(cmp.nodeTemplateRefs).toHaveLength(1);
            const ref = cmp.nodeTemplateRefs[0];
            expect(ref.instance.template).toBe('NodeTpl');
            expect(ref.instance.userComponentParams.dataObject).toEqual(expect.objectContaining({ label: 'a' }));
            expect(host.querySelector('.stub-host')).toBeTruthy();
            cmp.destroyNodeTemplateHostRefs();
            expect(cmp.nodeTemplateRefs).toEqual([]);
        });
    });

    describe('selection', () => {
        beforeEach(() => {
            cmp.zTree = { selectNode: jest.fn(), expandNode: jest.fn() };
        });

        it('selects nodes without data or tree class using an empty item carrying the path', () => {
            cmp.treeClass = undefined;
            jest.spyOn(cmp, 'getPath').mockReturnValue('/n');
            jest.spyOn(cmp, 'invokeEventCallback').mockImplementation(() => undefined);
            // the node action lookup that follows still dereferences node.data, so a data-less node throws after the selection is stored
            expect(() => cmp.selectNode({}, znode({ data: undefined }))).toThrow(TypeError);
            expect(cmp.selecteditem).toEqual({ path: '/n' });
        });
    });

    describe('default selection by datavalue', () => {
        const setup = (nodes: any[], datavalue: string) => {
            cmp.datavalue = datavalue;
            cmp.selecteditem = undefined;
            cmp.zTree = { getNodes: jest.fn(() => nodes), selectNode: jest.fn() };
            return {
                select: jest.spyOn(cmp, 'selectNode').mockImplementation(() => undefined),
                expand: jest.spyOn(cmp, 'expandNode').mockImplementation(() => undefined),
            };
        };

        it('picks the last enabled node and the first enabled node', () => {
            const a = znode({ nodeId: 1 });
            const b = znode({ nodeId: 2, disabled: true });
            const c = znode({ nodeId: 3, disabled: true });
            const { select } = setup([a, b, c], 'LastNode');
            cmp.applyDatavalueDefaultSelection();
            expect(select).toHaveBeenCalledWith(undefined, a);
            select.mockClear();
            const d = znode({ nodeId: 4 });
            setup([znode({ nodeId: 5, disabled: true }), d], 'FirstNode');
            cmp.applyDatavalueDefaultSelection();
            expect(cmp.selectNode).toHaveBeenCalledWith(undefined, d);
        });

        it('does nothing when every node is disabled', () => {
            const { select } = setup([znode({ disabled: true })], 'FirstNode');
            cmp.applyDatavalueDefaultSelection();
            expect(select).not.toHaveBeenCalled();
            const again = setup([znode({ disabled: true })], 'LastNode');
            cmp.applyDatavalueDefaultSelection();
            expect(again.select).not.toHaveBeenCalled();
        });

        it('ignores unknown datavalue keywords', () => {
            const { select } = setup([znode()], 'SomethingElse');
            cmp.applyDatavalueDefaultSelection();
            expect(select).not.toHaveBeenCalled();
        });
    });
});
