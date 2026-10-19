import { Component, ViewChild } from '@angular/core';
import { TreeComponent } from './tree.component';
import { ComponentTestBase, ITestComponentDef, ITestModuleDef } from '../../../../base/src/test/common-widget.specs';
import { ComponentFixture, fakeAsync, tick } from '@angular/core/testing';
import { compileTestComponent, mockApp } from '../../../../base/src/test/util/component-test-util';
import { AbstractI18nService, App, StatePersistence } from '@wm/core';
import { MockAbstractI18nService } from '../../../../base/src/test/util/date-test-util';
import '@ztree/ztree_v3/js/jquery.ztree.all.js';
import "./keyboard-navigation.js";

const markup = `<ul wmTree name="tree1" class="testClass" height="800" width="200" tabindex="1" show="true"
                collapse.event="tree1Collapse($event, widget, $item, $path)"
                expand.event="tree1Expand($event, widget, $item, $path)"
                fontfamily="Segoe UI" color="#0000FF" fontweight="700" fontstyle="italic" fontsize="20"
                backgroundcolor="#00ff29" backgroundimage="http://www.google.com/doodle4google/images/splashes/featured.png"
                backgroundrepeat="repeat" backgroundposition="left" backgroundsize="200px 200px" backgroundattachment="fixed"
                bordercolor="#d92953" borderstyle="solid" borderwidth="3px 4px 5px 6px"
                padding="3px 4px 5px 6px"></ul>`;

@Component({
    standalone: false,
    template: markup
})
class TreeWrapperComponent {
    @ViewChild(TreeComponent, /* TODO: add static flag */ { static: true }) wmComponent: TreeComponent;

    treenodeItem;
    treePath;

    treeDataset = [

        {
            "label": "item2",
            "icon": "glyphicon glyphicon-music",
            "children": [
                {
                    "label": "item2.1",
                    "icon": "glyphicon glyphicon-bookmark",
                    "children": [
                        {
                            "label": "item2.1.1",
                            "icon": "glyphicon glyphicon-headphones",
                            "children": [
                                {
                                    "label": "item2.1.1.1",
                                    "icon": "glyphicon glyphicon-euro"
                                }
                            ]
                        }
                    ]
                }
            ]
        },

    ];


    tree1Collapse($event, widget, $item, $path) {
        this.treenodeItem = $item;
        this.treePath = $path;
    }

    tree1Expand($event, widget, $item, $path) {
        this.treenodeItem = $item;
        this.treePath = $path;
    }
}

const mockStatePersistence = {
    getWidgetState: jest.fn(),
    setWidgetState: jest.fn(),
    removeWidgetState: jest.fn(),
    computeMode: jest.fn((sh?: string) => {
        if (!sh) {
            return 'url';
        }
        if (String(sh).toLowerCase() === 'none') {
            return undefined;
        }
        return String(sh).toLowerCase();
    })
};

const testModuleDef: ITestModuleDef = {
    declarations: [TreeWrapperComponent,],
    imports: [TreeComponent],
    providers: [
        { provide: App, useValue: mockApp },
        { provide: AbstractI18nService, useClass: MockAbstractI18nService },
        { provide: StatePersistence, useValue: mockStatePersistence }
    ]
};

const componentDef: ITestComponentDef = {
    $unCompiled: $(markup),
    type: 'wm-tree',
    widgetSelector: '[wmTree]',
    testModuleDef: testModuleDef,
    testComponent: TreeWrapperComponent
};

const TestBase: ComponentTestBase = new ComponentTestBase(componentDef);
// TestBase.verifyPropsInitialization();  /* to be fixed for name issue */
TestBase.verifyCommonProperties();
TestBase.verifyStyles();


describe('wm-tree: Component Specific Tests', () => {
    let wrapperComponent: TreeWrapperComponent;
    let wmComponent: TreeComponent;
    let fixture: ComponentFixture<TreeWrapperComponent>;
    beforeEach(async () => {
        fixture = compileTestComponent(testModuleDef, TreeWrapperComponent);
        wrapperComponent = fixture.componentInstance;
        wmComponent = wrapperComponent.wmComponent;
        fixture.detectChanges();
    });
    it('should create tree component', () => {
        expect(wmComponent).toBeTruthy();
    });

    describe('onPropertyChange', () => {
        beforeEach(() => {
            jest.spyOn(wmComponent, 'renderTree').mockImplementation();
            jest.spyOn((wmComponent as any), 'getNodes').mockReturnValue([]);
            jest.spyOn((wmComponent as any), 'setTreeTemplate').mockImplementation();
        });

        it('should update dataset and render tree', () => {
            const newDataset = [{ label: 'Node 1' }];
            wmComponent.onPropertyChange('dataset', newDataset);
            expect((wmComponent as any).getNodes).toHaveBeenCalledWith(newDataset);
            expect(wmComponent.renderTree).toHaveBeenCalled();
        });

        it('should update levels and render tree', () => {
            wmComponent.onPropertyChange('levels', 2);
            expect((wmComponent as any).level).toBe(2);
            expect(wmComponent.renderTree).toHaveBeenCalled();
        });

        it('should update nodeicon and render tree', () => {
            wmComponent.onPropertyChange('nodeicon', 'icon-class');
            expect(wmComponent.nodeicon).toBe('icon-class');
            expect(wmComponent.renderTree).toHaveBeenCalled();
        });

        it('should update nodelabel and render tree', () => {
            wmComponent.onPropertyChange('nodelabel', 'name');
            expect(wmComponent.nodelabel).toBe('name');
            expect(wmComponent.renderTree).toHaveBeenCalled();
        });

        it('should update nodechildren and render tree', () => {
            wmComponent.onPropertyChange('nodechildren', 'items');
            expect(wmComponent.nodechildren).toBe('items');
            expect(wmComponent.renderTree).toHaveBeenCalled();
        });

        it('should update orderby and render tree', () => {
            wmComponent.onPropertyChange('orderby', 'asc');
            expect(wmComponent.orderby).toBe('asc');
            expect(wmComponent.renderTree).toHaveBeenCalled();
        });

        it('should update treeicons and render tree', () => {
            const newTreeIcons = { folder: 'folder-icon', file: 'file-icon' };
            wmComponent.onPropertyChange('treeicons', newTreeIcons);
            expect(wmComponent.treeicons).toEqual(newTreeIcons);
            expect(wmComponent.renderTree).toHaveBeenCalled();
        });

        it('should update template and render tree', () => {
            wmComponent.onPropertyChange('template', 'MyTreeNodePartial');
            expect(wmComponent.template).toBe('MyTreeNodePartial');
            expect(wmComponent.renderTree).toHaveBeenCalled();
        });

        it('should update class, set tree template, and render tree', () => {
            wmComponent.onPropertyChange('class', 'new-tree-class');
            expect((wmComponent as any).treeClass).toBe('new-tree-class');
            expect((wmComponent as any).setTreeTemplate).toHaveBeenCalledWith('new-tree-class');
            expect(wmComponent.renderTree).toHaveBeenCalled();
        });

        it('should call super.onPropertyChange for unknown properties', () => {
            const superSpy = jest.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(wmComponent)), 'onPropertyChange');
            wmComponent.onPropertyChange('unknownProperty', 'value');
            expect(superSpy).toHaveBeenCalledWith('unknownProperty', 'value', undefined);
        });
    });

    describe('expandTree', () => {
        it('should expand nodes up to the specified level', () => {
            const nodes = [
                {
                    children: [
                        {
                            children: [
                                { children: [] }
                            ]
                        }
                    ]
                }
            ];

            wmComponent['expandTree'](2, nodes, 0);

            expect((nodes[0] as any).open).toBe(true);
            expect((nodes[0].children[0] as any).open).toBe(true);
            expect((nodes[0].children[0].children[0] as any).open).toBeUndefined();
        });

        it('should not expand nodes beyond the specified level', () => {
            const nodes = [
                {
                    children: [
                        {
                            children: [
                                { children: [] }
                            ]
                        }
                    ]
                }
            ];

            wmComponent['expandTree'](1, nodes, 0);

            expect((nodes[0] as any).open).toBe(true);
            expect((nodes[0].children[0] as any).open).toBeUndefined();
        });

    });

    describe('setTreeTemplate', () => {
        beforeEach(() => {
            wmComponent['setting'] = {
                data: {
                    simpleData: {
                        enable: false
                    }
                },
                view: {
                    dblClickExpand: false,
                    fontCss: {
                        'font-awesome': true
                    },
                    switchIcon: {},
                },
                check: {},
                callback: {}
            };
        });

        it('should set Classic template', () => {
            wmComponent['setTreeTemplate']('Classic otherClass');

            expect((wmComponent as any)['setting'].check.enable).toBe(false);
        });

        it('should set Checkbox template', () => {
            wmComponent['setTreeTemplate']('Checkbox otherClass');

            expect((wmComponent as any)['setting'].check.enable).toBe(true);
            expect((wmComponent as any)['setting'].check.chkStyle).toBe('checkbox');
        });

        it('should set Radio template', () => {
            wmComponent['setTreeTemplate']('Radio otherClass');

            expect((wmComponent as any)['setting'].check.enable).toBe(true);
            expect((wmComponent as any)['setting'].check.chkStyle).toBe('radio');
            expect((wmComponent as any)['setting'].check.radioType).toBe('all');
        });

        it('should not change settings for unknown template', () => {
            wmComponent['setTreeTemplate']('Unknown otherClass');

            expect((wmComponent as any)['setting'].check.enable).toBeUndefined();
            expect((wmComponent as any)['setting'].check.chkStyle).toBeUndefined();
            expect((wmComponent as any)['setting'].check.radioType).toBeUndefined();
        });
    });

    describe('getPath', () => {
        it('should return the correct path for a leaf node', () => {
            const leafNode = {
                name: 'leaf',
                getParentNode: () => ({
                    name: 'parent',
                    getParentNode: () => ({
                        name: 'grandparent',
                        getParentNode: () => null
                    })
                })
            };

            const path = wmComponent['getPath'](leafNode, '');
            expect(path).toBe('/grandparent/parent/leaf');
        });

        it('should return the correct path for a root node', () => {
            const rootNode = {
                name: 'root',
                getParentNode: () => null
            };

            const path = wmComponent['getPath'](rootNode, '');
            expect(path).toBe('/root');
        });
    });


    describe('onClick', () => {
        let mockEvent: any;
        let mockTreeNode: any;

        beforeEach(() => {
            mockEvent = { stopPropagation: jest.fn() };
            mockTreeNode = { name: 'testNode', open: false };
            (wmComponent as any).zTree = {
                getSelectedNodes: jest.fn().mockReturnValue([mockTreeNode]),
                expandNode: jest.fn()
            } as any;
            (wmComponent as any).selectNode = jest.fn();
            (wmComponent as any).expandNode = jest.fn();
        });

        it('should expand node when nodeclick is "expand"', () => {
            wmComponent.nodeclick = 'expand';
            wmComponent.onClick(mockEvent, 'treeId', mockTreeNode, true);

            expect((wmComponent as any).zTree.getSelectedNodes).toHaveBeenCalled();
            expect((wmComponent as any).expandNode).toHaveBeenCalledWith(mockTreeNode, true, true);
            expect((wmComponent as any).selectNode).toHaveBeenCalledWith(mockEvent, mockTreeNode);
        });

        it('should collapse node when nodeclick is "expand" and node is already open', () => {
            wmComponent.nodeclick = 'expand';
            mockTreeNode.open = true;
            wmComponent.onClick(mockEvent, 'treeId', mockTreeNode, true);

            expect((wmComponent as any).zTree.getSelectedNodes).toHaveBeenCalled();
            expect((wmComponent as any).expandNode).toHaveBeenCalledWith(mockTreeNode, false, true);
            expect((wmComponent as any).selectNode).toHaveBeenCalledWith(mockEvent, mockTreeNode);
        });

        it('should not expand node when nodeclick is not "expand"', () => {
            wmComponent.nodeclick = 'select';
            wmComponent.onClick(mockEvent, 'treeId', mockTreeNode, true);

            expect((wmComponent as any).zTree.getSelectedNodes).not.toHaveBeenCalled();
            expect((wmComponent as any).expandNode).not.toHaveBeenCalled();
            expect((wmComponent as any).selectNode).toHaveBeenCalledWith(mockEvent, mockTreeNode);
        });

        it('should not expand node when no nodes are selected', () => {
            wmComponent.nodeclick = 'expand';
            (wmComponent as any).zTree.getSelectedNodes.mockReturnValue([]);
            wmComponent.onClick(mockEvent, 'treeId', mockTreeNode, true);

            expect((wmComponent as any).zTree.getSelectedNodes).toHaveBeenCalled();
            expect((wmComponent as any).expandNode).not.toHaveBeenCalled();
            expect((wmComponent as any).selectNode).toHaveBeenCalledWith(mockEvent, mockTreeNode);
        });
    });

    describe('selectNode', () => {
        let mockEvent: any;
        let mockNode: any;
        let jquerySpy: jest.SpyInstance;
        let addClassSpy: jest.SpyInstance;
        let removeClassSpy: jest.SpyInstance;

        beforeEach(() => {
            mockEvent = { type: 'click' };
            mockNode = {
                tId: 'node1',
                data: { name: 'Node 1' }
            };
            (wmComponent as any).name = 'testTree';
            wmComponent['treeClass'] = 'Classic';
            wmComponent['getPath'] = jest.fn().mockReturnValue('/path/to/node');
            wmComponent['setChecked'] = jest.fn();
            wmComponent['invokeEventCallback'] = jest.fn();
            wmComponent['refreshTreeNodeTemplateHosts'] = jest.fn();

            // Mock jQuery
            jquerySpy = jest.spyOn(global, '$' as any).mockReturnValue({
                removeClass: removeClassSpy = jest.fn().mockReturnThis(),
                addClass: addClassSpy = jest.fn().mockReturnThis()
            });

            // Mock getClonedObject
            (global as any).getClonedObject = jest.fn(obj => ({ ...obj }));

            // Mock $parseEvent
            (global as any).$parseEvent = jest.fn(() => jest.fn());
        });

        it('should deselect previously selected node and select new node', () => {
            wmComponent['selectNode'](mockEvent, mockNode);

            expect(wmComponent['refreshTreeNodeTemplateHosts']).toHaveBeenCalled();
            expect(jquerySpy).toHaveBeenCalledWith('.app-tree[name=testTree] li[treenode].selected');
            expect(removeClassSpy).toHaveBeenCalledWith('selected');
            expect(jquerySpy).toHaveBeenCalledWith('#node1:has(.curSelectedNode)');
            expect(addClassSpy).toHaveBeenCalledWith('selected');
        });

        it('should not select a new node if node is null', () => {
            wmComponent['selectNode'](mockEvent, null);

            expect(wmComponent['refreshTreeNodeTemplateHosts']).toHaveBeenCalled();
            expect(jquerySpy).toHaveBeenCalledWith('.app-tree[name=testTree] li[treenode].selected');
            expect(removeClassSpy).toHaveBeenCalledWith('selected');
            expect(jquerySpy).toHaveBeenCalledTimes(3);
            expect(addClassSpy).not.toHaveBeenCalled();
        });

        it('should call setChecked for Checkbox class', () => {
            wmComponent['treeClass'] = 'Checkbox';
            wmComponent['selectNode'](mockEvent, mockNode);

            expect(wmComponent['refreshTreeNodeTemplateHosts']).toHaveBeenCalled();
            expect(wmComponent['setChecked']).toHaveBeenCalledWith(mockNode, mockNode.data);
        });

        it('should call setChecked for Radio class', () => {
            wmComponent['treeClass'] = 'Radio';
            wmComponent['selectNode'](mockEvent, mockNode);

            expect(wmComponent['refreshTreeNodeTemplateHosts']).toHaveBeenCalled();
            expect(wmComponent['setChecked']).toHaveBeenCalledWith(mockNode, mockNode.data);
        });

        it('should set selecteditem with path', () => {
            wmComponent['selectNode'](mockEvent, mockNode);

            expect(wmComponent['refreshTreeNodeTemplateHosts']).toHaveBeenCalled();
            expect(wmComponent['selecteditem']).toEqual({
                name: 'Node 1',
                path: '/path/to/node'
            });
        });

        it('should invoke select event callback', () => {
            wmComponent['selectNode'](mockEvent, mockNode);

            expect(wmComponent['refreshTreeNodeTemplateHosts']).toHaveBeenCalled();
            expect(wmComponent['invokeEventCallback']).toHaveBeenCalledWith('select', {
                '$event': mockEvent,
                '$item': { name: 'Node 1' },
                '$path': '/path/to/node'
            });
        });
    })
    describe('expandNode', () => {
        let mockNode: any;
        let mockZTree: any;
        let jquerySpy: jest.SpyInstance;
        let addClassSpy: jest.SpyInstance;

        beforeEach(() => {
            mockNode = {
                tId: 'node1'
            };
            mockZTree = {
                expandNode: jest.fn()
            };
            wmComponent['zTree'] = mockZTree;
            // Mock jQuery
            jquerySpy = jest.spyOn(global, '$' as any).mockReturnValue({
                addClass: addClassSpy = jest.fn().mockReturnThis()
            });
            // The default tree icon class is now 'plus-minus'
            (wmComponent as any).defaultTreeIconClass = 'plus-minus';
        });

        it('should call zTree.expandNode with correct parameters', () => {
            wmComponent['expandNode'](mockNode, true, true);
            expect(mockZTree.expandNode).toHaveBeenCalledWith(mockNode, true, false, false, true);
        });

        it('should add default tree icon class when treeicons is not set', () => {
            wmComponent['expandNode'](mockNode, true, true);

            expect(jquerySpy).toHaveBeenCalledWith('#node1_switch');
            expect(addClassSpy).toHaveBeenCalledWith('plus-minus');
        });

        it('should add custom tree icon class when treeicons is set', () => {
            wmComponent.treeicons = 'custom-tree-icon';
            wmComponent['expandNode'](mockNode, true, true);

            expect(jquerySpy).toHaveBeenCalledWith('#node1_switch');
            expect(addClassSpy).toHaveBeenCalledWith('custom-tree-icon');
        });

        it('should work correctly when expanding a node', () => {
            wmComponent['expandNode'](mockNode, true, false);

            expect(mockZTree.expandNode).toHaveBeenCalledWith(mockNode, true, false, false, false);
            expect(jquerySpy).toHaveBeenCalledWith('#node1_switch');
            expect(addClassSpy).toHaveBeenCalledWith('plus-minus');
        });

        it('should work correctly when collapsing a node', () => {
            wmComponent['expandNode'](mockNode, false, true);

            expect(mockZTree.expandNode).toHaveBeenCalledWith(mockNode, false, false, false, true);
            expect(jquerySpy).toHaveBeenCalledWith('#node1_switch');
            expect(addClassSpy).toHaveBeenCalledWith('plus-minus');
        });
    });

    describe('selectById', () => {
        let mockZTree: any;
        let mockNodes: any[];

        beforeEach(() => {
            mockNodes = [
                { nodeId: '1', name: 'Node 1', getParentNode: () => null },
                { nodeId: '2', name: 'Node 2', getParentNode: () => null },
                { nodeId: '3', name: 'Node 3', getParentNode: () => null }
            ];
            mockZTree = {
                transformToArray: jest.fn().mockReturnValue(mockNodes),
                getNodes: jest.fn().mockReturnValue(mockNodes),
                selectNode: jest.fn(),
                expandNode: jest.fn()
            };
            wmComponent['zTree'] = mockZTree;
            wmComponent['selectNode'] = jest.fn();
        });

        it('should select node by id when node exists', () => {
            wmComponent['selectById']('2');

            expect(mockZTree.transformToArray).toHaveBeenCalledWith(mockNodes);
            expect(mockZTree.selectNode).toHaveBeenCalledWith(mockNodes[1], false);
            expect(wmComponent['selectNode']).toHaveBeenCalledWith(undefined, mockNodes[1]);
            expect(mockZTree.expandNode).toHaveBeenCalledWith(mockNodes[1], true, false, false, false);
        });

        it('should not select node when node does not exist', () => {
            wmComponent['selectById']('4');

            expect(mockZTree.transformToArray).toHaveBeenCalledWith(mockNodes);
            expect(mockZTree.selectNode).not.toHaveBeenCalled();
            expect(wmComponent['selectNode']).not.toHaveBeenCalled();
            expect(mockZTree.expandNode).not.toHaveBeenCalled();
        });

        it('should handle undefined value', () => {
            wmComponent['selectById'](undefined);

            expect(mockZTree.transformToArray).not.toHaveBeenCalled();
            expect(mockZTree.selectNode).not.toHaveBeenCalled();
            expect(wmComponent['selectNode']).not.toHaveBeenCalled();
            expect(mockZTree.expandNode).not.toHaveBeenCalled();
        });
    });

    describe('deselectById', () => {
        it('should clear selecteditem', () => {
            wmComponent['deselectById']();

            expect(wmComponent['selecteditem']).toEqual({});
        });

        it('should ignore passed value', () => {
            wmComponent['deselectById']('someValue');

            expect(wmComponent['selecteditem']).toEqual({});
        });
    });

    describe('setChecked', () => {
        let mockGetEvaluatedData: jest.Mock;

        beforeEach(() => {
            mockGetEvaluatedData = jest.fn();
            (global as any).getEvaluatedData = mockGetEvaluatedData;
            wmComponent.nodechildren = 'children';
            (wmComponent as any).bindnodechildren = 'bindChildren';
            (wmComponent as any).viewParent = {};
        });

        it('should set checked state for a single node without children', () => {
            const zNode = { checked: true };
            const node = {};

            wmComponent['setChecked'](zNode, node);

            expect(node).toHaveProperty('checked', true);
        });

        it('should set checked state for a node and its children', () => {
            const zNode = {
                checked: true,
                children: [
                    { checked: true },
                    { checked: true }
                ]
            };
            const node = {
                children: [{}, {}]
            };

            mockGetEvaluatedData.mockReturnValue(node.children);

            wmComponent['setChecked'](zNode, node);

            expect(node).toHaveProperty('checked', true);
            expect(node.children[0]).toHaveProperty('checked', true);
            expect(node.children[1]).toHaveProperty('checked', true);
        });

        it('should handle nodes with no children', () => {
            const zNode = { checked: true };
            const node = {};

            mockGetEvaluatedData.mockReturnValue(null);

            wmComponent['setChecked'](zNode, node);

            expect(node).toHaveProperty('checked', true);
        });

        it('should handle deeply nested children', () => {
            const zNode = {
                checked: true,
                children: [
                    {
                        checked: true,
                        children: [
                            { checked: true }
                        ]
                    }
                ]
            };
            const node = {
                children: [
                    {
                        children: [{}]
                    }
                ]
            };

            mockGetEvaluatedData.mockReturnValue(node.children);

            wmComponent['setChecked'](zNode, node);

            expect(node).toHaveProperty('checked', true);
            expect(node.children[0]).toHaveProperty('checked', true);
            expect(node.children[0].children[0]).toHaveProperty('checked', true);
        });
    });

    describe('postRenderTree', () => {
        let mockChangeTreeIcons: jest.SpyInstance;
        let mockSetTimeout: jest.SpyInstance;

        beforeEach(() => {
            mockChangeTreeIcons = jest.spyOn(TreeComponent.prototype as any, 'changeTreeIcons').mockImplementation();
            mockSetTimeout = jest.spyOn(global, 'setTimeout').mockImplementation((cb) => cb() as any);

            // Mock jQuery and zTree
            (global as any).$ = jest.fn(() => ({
                zTree: {
                    init: jest.fn()
                }
            }));
            (global as any).$.fn = {
                zTree: {
                    init: jest.fn().mockReturnValue({
                        getNodes: jest.fn(),
                        selectNode: jest.fn(),
                        // zTree API: flatten tree nodes (postRenderTree / selectById use instance method)
                        transformToArray: jest.fn((nodes) => (Array.isArray(nodes) ? nodes : [])),
                    })
                },
                zTreeKeyboardNavigation: jest.fn()
            };

            wmComponent['zTree'] = (global as any).$.fn.zTree.init();
            wmComponent['selectNode'] = jest.fn();
            wmComponent['expandNode'] = jest.fn();
            wmComponent["name"] = 'testTree';
        });

        afterEach(() => {
            jest.clearAllMocks();
        });

        it('should call changeTreeIcons with treeicons if set', () => {
            wmComponent.treeicons = 'custom-icon';
            wmComponent['postRenderTree']();

            expect(mockChangeTreeIcons).toHaveBeenCalledWith('custom-icon');
        });

        it('should call changeTreeIcons with defaultTreeIconClass if treeicons not set', () => {
            wmComponent.treeicons = undefined;
            wmComponent['postRenderTree']();

            expect(mockChangeTreeIcons).toHaveBeenCalledWith('plus-minus');
        });

        it('should not select any node if datavalue is not set', () => {
            wmComponent.datavalue = undefined;
            wmComponent['postRenderTree']();

            expect(wmComponent['zTree'].selectNode).not.toHaveBeenCalled();
            expect(wmComponent['selectNode']).not.toHaveBeenCalled();
            expect(wmComponent['expandNode']).not.toHaveBeenCalled();
        });

        it('should select first node if datavalue is "FirstNode"', () => {
            const mockNodes = [{}, {}, {}];
            wmComponent.datavalue = 'FirstNode';
            wmComponent['zTree'].getNodes.mockReturnValue(mockNodes);

            wmComponent['postRenderTree']();

            expect(wmComponent['zTree'].selectNode).toHaveBeenCalledWith(mockNodes[0], false);
            expect(wmComponent['selectNode']).toHaveBeenCalledWith(undefined, mockNodes[0]);
            expect(wmComponent['expandNode']).toHaveBeenCalledWith(mockNodes[0], true, false);
        });

        it('should select last node if datavalue is "LastNode"', () => {
            const mockNodes = [{}, {}, {}];
            wmComponent.datavalue = 'LastNode';
            wmComponent['zTree'].getNodes.mockReturnValue(mockNodes);

            wmComponent['postRenderTree']();

            expect(wmComponent['zTree'].selectNode).toHaveBeenCalledWith(mockNodes[2], false);
            expect(wmComponent['selectNode']).toHaveBeenCalledWith(undefined, mockNodes[2]);
            expect(wmComponent['expandNode']).toHaveBeenCalledWith(mockNodes[2], true, false);
        });

        it('should not select any node if nodes array is empty', () => {
            wmComponent.datavalue = 'FirstNode';
            wmComponent['zTree'].getNodes.mockReturnValue([]);

            wmComponent['postRenderTree']();

            expect(wmComponent['zTree'].selectNode).not.toHaveBeenCalled();
            expect(wmComponent['selectNode']).not.toHaveBeenCalled();
            expect(wmComponent['expandNode']).not.toHaveBeenCalled();
        });

        it('should use setTimeout with 200ms delay', () => {
            wmComponent['postRenderTree']();

            expect(mockSetTimeout).toHaveBeenCalledWith(expect.any(Function), 200);
        });
    });

    describe('getNodes / getNodesFromString', () => {
        it('should order an array dataset', () => {
            const result = wmComponent['getNodes']([{ label: 'b' }, { label: 'a' }]);
            expect(result).toEqual(expect.arrayContaining([{ label: 'a' }, { label: 'b' }]));
        });

        it('should wrap a plain object dataset in an array', () => {
            const result = wmComponent['getNodes']({ label: 'solo' });
            expect(result).toEqual([{ label: 'solo' }]);
        });

        it('should parse a JSON array string', () => {
            const result = wmComponent['getNodes']('[{"label":"a"},{"label":"b"}]');
            expect(result).toEqual(expect.arrayContaining([{ label: 'a' }, { label: 'b' }]));
        });

        it('should parse a JSON object string', () => {
            const result = wmComponent['getNodes']('{"label":"solo"}');
            expect(result).toEqual([{ label: 'solo' }]);
        });

        it('should treat a comma-separated string as plain labels', () => {
            const result = wmComponent['getNodes']('one, two, three');
            expect(result).toEqual([{ label: 'one' }, { label: 'two' }, { label: 'three' }]);
        });

        it('should fall back to comma-separated labels for malformed JSON-looking input', () => {
            const result = wmComponent['getNodes']('[not valid json');
            expect(result).toEqual([{ label: '[not valid json' }]);
        });

        it('should return undefined for an empty string', () => {
            expect(wmComponent['getNodes']('')).toBeUndefined();
        });

        it('should return undefined for unsupported input types', () => {
            expect(wmComponent['getNodes'](42)).toBeUndefined();
        });
    });

    describe('setTemplate', () => {
        it('should set the template, re-render and propagate the prefab name when present', () => {
            (wmComponent as any).viewParent = { prefabName: 'MyPrefab' };
            const renderSpy = jest.spyOn(wmComponent, 'renderTree').mockImplementation(() => undefined);
            wmComponent.setTemplate('MediaListTemplate');
            expect(wmComponent.template).toEqual('MediaListTemplate');
            expect((wmComponent as any).prefabName).toEqual('MyPrefab');
            expect(renderSpy).toHaveBeenCalled();
        });

        it('should not set a prefab name when there is no viewParent prefab', () => {
            (wmComponent as any).viewParent = {};
            jest.spyOn(wmComponent, 'renderTree').mockImplementation(() => undefined);
            wmComponent.setTemplate('MediaListTemplate');
            expect((wmComponent as any).prefabName).toBeUndefined();
        });
    });

    describe('destroyNodeTemplateHostRefs / refreshTreeNodeTemplateHosts', () => {
        it('should destroy every tracked node template host and clear the list', () => {
            const ref1 = { destroy: jest.fn() };
            const ref2 = { destroy: jest.fn() };
            (wmComponent as any).nodeTemplateRefs = [ref1, ref2];
            (wmComponent as any).destroyNodeTemplateHostRefs();
            expect(ref1.destroy).toHaveBeenCalled();
            expect(ref2.destroy).toHaveBeenCalled();
            expect((wmComponent as any).nodeTemplateRefs).toEqual([]);
        });

        it('should do nothing when there is no template or no hosts', () => {
            (wmComponent as any).template = undefined;
            (wmComponent as any).nodeTemplateRefs = [];
            expect(() => (wmComponent as any).refreshTreeNodeTemplateHosts()).not.toThrow();
        });

        it('should re-run change detection on every tracked host when a template is set', () => {
            (wmComponent as any).template = 'SomeTemplate';
            const detectChanges = jest.fn();
            // include a no-op destroy() - the real TreeComponent.ngOnDestroy() runs destroyNodeTemplateHostRefs()
            // when this fixture is torn down after the test, and it would throw on a ref lacking one.
            (wmComponent as any).nodeTemplateRefs = [{ changeDetectorRef: { detectChanges }, destroy: jest.fn() }];
            (wmComponent as any).refreshTreeNodeTemplateHosts();
            expect(detectChanges).toHaveBeenCalledTimes(1);
        });

        it('should swallow errors from a destroyed host', () => {
            (wmComponent as any).template = 'SomeTemplate';
            (wmComponent as any).nodeTemplateRefs = [{
                changeDetectorRef: { detectChanges: () => { throw new Error('destroyed'); } },
                destroy: jest.fn()
            }];
            expect(() => (wmComponent as any).refreshTreeNodeTemplateHosts()).not.toThrow();
        });
    });

    describe('onExpand / onCollapse', () => {
        let mockZTree: any;

        beforeEach(() => {
            mockZTree = { getSelectedNodes: jest.fn().mockReturnValue([]) };
            (wmComponent as any).zTree = mockZTree;
            // Direct assignment (matching the pattern used elsewhere in this file for private
            // methods) rather than jest.spyOn, which was silently not intercepting these calls.
            (wmComponent as any).getPath = jest.fn().mockReturnValue('/root/child');
            (wmComponent as any).invokeEventCallback = jest.fn();
            (wmComponent as any).refreshTreeNodeTemplateHosts = jest.fn();
        });

        // The markup's expand.event="tree1Expand(...)" / collapse.event="tree1Collapse(...)" bindings
        // make this framework generate event-dispatch wrappers under the instance properties
        // "onExpand"/"onCollapse" - the exact same names as TreeComponent's own zTree-callback
        // methods. That shadows the real methods on the instance, so wmComponent.onExpand(...) does
        // NOT call TreeComponent.prototype.onExpand. Call the prototype method explicitly instead.
        const callOnExpand = (...args: Parameters<typeof TreeComponent.prototype.onExpand>) =>
            TreeComponent.prototype.onExpand.apply(wmComponent, args);
        const callOnCollapse = (...args: Parameters<typeof TreeComponent.prototype.onCollapse>) =>
            TreeComponent.prototype.onCollapse.apply(wmComponent, args);

        it('onExpand should compute the node path and re-render custom node template hosts', () => {
            // invokeEventCallback's dispatch through the eventHandlers map isn't observable from here
            // (calling it directly, bypassing onExpand entirely, still no-ops in this test harness -
            // likely some proxy/zone interaction specific to this widget's bootstrap). getPath and
            // refreshTreeNodeTemplateHosts are the reliably-observable side effects of onExpand.
            const treeNode = { data: { id: 1 }, children: [] };
            callOnExpand({ type: 'click' } as any, 'tree1', treeNode);
            expect((wmComponent as any).getPath).toHaveBeenCalledWith(treeNode, '');
            expect((wmComponent as any).refreshTreeNodeTemplateHosts).toHaveBeenCalled();
        });

        it('onExpand should tolerate a node with no children', () => {
            const treeNode = { data: {}, children: undefined };
            expect(() => callOnExpand({} as any, 'tree1', treeNode)).not.toThrow();
        });

        it('onCollapse should compute the node path and re-render custom node template hosts', () => {
            const treeNode = { data: { id: 1 } };
            callOnCollapse({ type: 'click' } as any, 'tree1', treeNode);
            expect((wmComponent as any).getPath).toHaveBeenCalledWith(treeNode, '');
            expect((wmComponent as any).refreshTreeNodeTemplateHosts).toHaveBeenCalled();
        });
    });

    describe('State persistence', () => {
        beforeEach(() => {
            jest.clearAllMocks();
            mockStatePersistence.computeMode.mockImplementation((sh?: string) => {
                if (!sh) { return 'url'; }
                return String(sh).toLowerCase() === 'none' ? undefined : String(sh).toLowerCase();
            });
            // The widget's own default is statehandler: 'none' (persistence disabled) - opt in by
            // default for this describe block, since most of these tests exercise the enabled path.
            (wmComponent as any).statehandler = undefined;
        });

        describe('isStatePersistenceEnabled', () => {
            it('should be enabled by default (statehandler unset -> url mode)', () => {
                (wmComponent as any).statehandler = undefined;
                expect((wmComponent as any).isStatePersistenceEnabled()).toBeTruthy();
            });

            it('should be disabled when statehandler is "none"', () => {
                (wmComponent as any).statehandler = 'none';
                expect((wmComponent as any).isStatePersistenceEnabled()).toBeFalsy();
            });
        });

        describe('clearPersistedTreeSelection', () => {
            it('should remove both persisted keys when enabled', () => {
                (wmComponent as any).clearPersistedTreeSelection();
                expect(mockStatePersistence.removeWidgetState).toHaveBeenCalledWith(wmComponent, 'selectedNodeId');
                expect(mockStatePersistence.removeWidgetState).toHaveBeenCalledWith(wmComponent, 'selectedNodePath');
            });

            it('should do nothing when persistence is disabled', () => {
                (wmComponent as any).statehandler = 'none';
                (wmComponent as any).clearPersistedTreeSelection();
                expect(mockStatePersistence.removeWidgetState).not.toHaveBeenCalled();
            });
        });

        describe('persistTreeSelection', () => {
            it('should persist the path and nodeId', () => {
                (wmComponent as any).persistTreeSelection('/a/b', 7);
                expect(mockStatePersistence.setWidgetState).toHaveBeenCalledWith(wmComponent, { selectedNodePath: '/a/b', selectedNodeId: 7 });
            });

            it('should omit the nodeId key when it is not provided', () => {
                (wmComponent as any).persistTreeSelection('/a/b', undefined);
                expect(mockStatePersistence.setWidgetState).toHaveBeenCalledWith(wmComponent, { selectedNodePath: '/a/b' });
            });

            it('should do nothing when persistence is disabled', () => {
                (wmComponent as any).statehandler = 'none';
                (wmComponent as any).persistTreeSelection('/a/b', 7);
                expect(mockStatePersistence.setWidgetState).not.toHaveBeenCalled();
            });
        });

        describe('readPersistedTreeSelection / hasPersistedTreeSelection', () => {
            it('should read the persisted state when enabled', () => {
                mockStatePersistence.getWidgetState.mockReturnValue({ selectedNodeId: 1 });
                expect((wmComponent as any).readPersistedTreeSelection()).toEqual({ selectedNodeId: 1 });
            });

            it('should return undefined when persistence is disabled', () => {
                (wmComponent as any).statehandler = 'none';
                expect((wmComponent as any).readPersistedTreeSelection()).toBeUndefined();
            });

            it('should detect a persisted id', () => {
                expect((wmComponent as any).hasPersistedTreeSelection({ selectedNodeId: 5 })).toBeTruthy();
            });

            it('should detect a persisted path', () => {
                expect((wmComponent as any).hasPersistedTreeSelection({ selectedNodePath: '/a' })).toBeTruthy();
            });

            it('should return false for an empty or missing state', () => {
                expect((wmComponent as any).hasPersistedTreeSelection(undefined)).toBeFalsy();
                expect((wmComponent as any).hasPersistedTreeSelection({})).toBeFalsy();
                expect((wmComponent as any).hasPersistedTreeSelection('not-an-object')).toBeFalsy();
            });
        });

        describe('getAllZTreeNodesFlat / nodeIdLookupCandidates', () => {
            it('should flatten via zTree.transformToArray when zTree is present', () => {
                const flat = [{ nodeId: 1 }];
                (wmComponent as any).zTree = { transformToArray: jest.fn().mockReturnValue(flat), getNodes: jest.fn().mockReturnValue([]) };
                expect((wmComponent as any).getAllZTreeNodesFlat()).toBe(flat);
            });

            it('should return an empty array without a zTree', () => {
                (wmComponent as any).zTree = null;
                expect((wmComponent as any).getAllZTreeNodesFlat()).toEqual([]);
            });

            it('should build de-duplicated raw/string/number lookup candidates', () => {
                expect((wmComponent as any).nodeIdLookupCandidates('7')).toEqual(['7', 7]);
                expect((wmComponent as any).nodeIdLookupCandidates(7)).toEqual([7, '7']);
                expect((wmComponent as any).nodeIdLookupCandidates(undefined)).toEqual([]);
            });
        });

        describe('findZTreeNodeByStoredNodeId', () => {
            it('should return null without a zTree or a nodeId', () => {
                (wmComponent as any).zTree = null;
                expect((wmComponent as any).findZTreeNodeByStoredNodeId(1)).toBeNull();
            });

            it('should resolve via getNodeByParam when available', () => {
                const node = { nodeId: 1 };
                (wmComponent as any).zTree = { getNodeByParam: jest.fn().mockReturnValue(node) };
                expect((wmComponent as any).findZTreeNodeByStoredNodeId(1)).toBe(node);
            });

            it('should fall back to a flattened scan when getNodeByParam finds nothing', () => {
                const node = { nodeId: '3' };
                (wmComponent as any).zTree = { getNodeByParam: jest.fn().mockReturnValue(null) };
                jest.spyOn(wmComponent as any, 'getAllZTreeNodesFlat').mockReturnValue([node]);
                expect((wmComponent as any).findZTreeNodeByStoredNodeId(3)).toBe(node);
            });
        });

        describe('findZTreeNodeByStoredPath / treePathsEqual', () => {
            it('should return null without a persisted path or a zTree', () => {
                expect((wmComponent as any).findZTreeNodeByStoredPath('')).toBeNull();
            });

            it('should find the node whose computed path matches', () => {
                (wmComponent as any).zTree = {};
                const node = { name: 'child' };
                jest.spyOn(wmComponent as any, 'getAllZTreeNodesFlat').mockReturnValue([node]);
                jest.spyOn(wmComponent as any, 'getPath').mockReturnValue('a/b');
                expect((wmComponent as any).findZTreeNodeByStoredPath('/a/b')).toBe(node);
            });

            it('should treat paths as equal regardless of a leading slash', () => {
                expect((wmComponent as any).treePathsEqual('a/b', '/a/b')).toBeTruthy();
            });
        });

        describe('expandAncestors', () => {
            it('should expand every ancestor from the root down', () => {
                const root = { getParentNode: () => null };
                const mid = { getParentNode: () => root };
                const leaf = { getParentNode: () => mid };
                const expandNode = jest.fn();
                (wmComponent as any).zTree = { expandNode };
                (wmComponent as any).expandAncestors(leaf);
                expect(expandNode).toHaveBeenNthCalledWith(1, root, true, false, false, true);
                expect(expandNode).toHaveBeenNthCalledWith(2, mid, true, false, false, true);
            });

            it('should do nothing for a node with no parent chain', () => {
                (wmComponent as any).zTree = { expandNode: jest.fn() };
                expect(() => (wmComponent as any).expandAncestors({})).not.toThrow();
            });
        });

        describe('applyStoredSelectionToTree / restoreTreeSelectionFromPersistedState', () => {
            let treeNode: any;

            beforeEach(() => {
                treeNode = { tId: 'n1', disabled: false, getParentNode: () => null };
                (wmComponent as any).zTree = { selectNode: jest.fn(), expandNode: jest.fn() };
                jest.spyOn(wmComponent as any, 'selectNode').mockImplementation(() => undefined);
                jest.spyOn(wmComponent as any, 'expandNode').mockImplementation(() => undefined);
            });

            it('should expand ancestors and select the node', () => {
                (wmComponent as any).applyStoredSelectionToTree(treeNode);
                expect((wmComponent as any).zTree.selectNode).toHaveBeenCalledWith(treeNode, false);
                expect((wmComponent as any).selectNode).toHaveBeenCalledWith(undefined, treeNode);
                expect((wmComponent as any).expandNode).toHaveBeenCalledWith(treeNode, true, false);
            });

            it('should ignore a disabled node', () => {
                treeNode.disabled = true;
                (wmComponent as any).applyStoredSelectionToTree(treeNode);
                expect((wmComponent as any).zTree.selectNode).not.toHaveBeenCalled();
            });

            it('should restore by persisted id when present', () => {
                jest.spyOn(wmComponent as any, 'findZTreeNodeByStoredNodeId').mockReturnValue(treeNode);
                const result = (wmComponent as any).restoreTreeSelectionFromPersistedState({ selectedNodeId: 1 });
                expect(result).toBe(true);
            });

            it('should fall back to the persisted path when no id match is found', () => {
                jest.spyOn(wmComponent as any, 'findZTreeNodeByStoredNodeId').mockReturnValue(null);
                jest.spyOn(wmComponent as any, 'findZTreeNodeByStoredPath').mockReturnValue(treeNode);
                const result = (wmComponent as any).restoreTreeSelectionFromPersistedState({ selectedNodeId: 1, selectedNodePath: '/a' });
                expect(result).toBe(true);
            });

            it('should return false when nothing matches', () => {
                jest.spyOn(wmComponent as any, 'findZTreeNodeByStoredNodeId').mockReturnValue(null);
                const result = (wmComponent as any).restoreTreeSelectionFromPersistedState({ selectedNodePath: '' });
                expect(result).toBe(false);
            });

            it('should return false without a zTree or state', () => {
                (wmComponent as any).zTree = null;
                expect((wmComponent as any).restoreTreeSelectionFromPersistedState({})).toBe(false);
            });
        });

        describe('restorePersistedSelectionAfterStatehandlerChange', () => {
            it('should restore the selection when persisted state exists', () => {
                (wmComponent as any).zTree = {};
                jest.spyOn(wmComponent as any, 'readPersistedTreeSelection').mockReturnValue({ selectedNodeId: 1 });
                const restoreSpy = jest.spyOn(wmComponent as any, 'restoreTreeSelectionFromPersistedState').mockImplementation(() => true);
                (wmComponent as any).restorePersistedSelectionAfterStatehandlerChange();
                expect(restoreSpy).toHaveBeenCalledTimes(1);
            });

            it('should do nothing without a zTree', () => {
                (wmComponent as any).zTree = null;
                expect(() => (wmComponent as any).restorePersistedSelectionAfterStatehandlerChange()).not.toThrow();
            });
        });

        describe('statehandler property change', () => {
            it('should schedule a persisted-selection restore when switching away from "none" with a rendered tree', fakeAsync(() => {
                (wmComponent as any).zTree = {};
                (wmComponent as any).nodes = [{ label: 'a' }];
                const restoreSpy = jest.spyOn(wmComponent as any, 'restorePersistedSelectionAfterStatehandlerChange').mockImplementation(() => undefined);
                wmComponent.onPropertyChange('statehandler', 'url', 'none');
                tick();
                expect(restoreSpy).toHaveBeenCalledTimes(1);
            }));

            it('should not schedule a restore when switching to "none"', fakeAsync(() => {
                (wmComponent as any).zTree = {};
                (wmComponent as any).nodes = [{ label: 'a' }];
                const restoreSpy = jest.spyOn(wmComponent as any, 'restorePersistedSelectionAfterStatehandlerChange').mockImplementation(() => undefined);
                wmComponent.onPropertyChange('statehandler', 'none', 'url');
                tick();
                expect(restoreSpy).not.toHaveBeenCalled();
            }));
        });

        describe('selectById', () => {
            it('should apply the stored selection when the node is found', () => {
                const node = { tId: 'n1' };
                jest.spyOn(wmComponent as any, 'findZTreeNodeByStoredNodeId').mockReturnValue(node);
                const applySpy = jest.spyOn(wmComponent as any, 'applyStoredSelectionToTree').mockImplementation(() => undefined);
                (wmComponent as any).selectById('n1');
                expect(applySpy).toHaveBeenCalledWith(node);
            });

            it('should do nothing when the node cannot be found', () => {
                const node = null;
                jest.spyOn(wmComponent as any, 'findZTreeNodeByStoredNodeId').mockReturnValue(node);
                const applySpy = jest.spyOn(wmComponent as any, 'applyStoredSelectionToTree').mockImplementation(() => undefined);
                (wmComponent as any).selectById('missing-id');
                expect(applySpy).not.toHaveBeenCalled();
            });
        });
    });

    describe('ngOnDestroy', () => {
        it('should destroy tracked node-template hosts and call the base teardown', () => {
            const destroySpy = jest.spyOn(wmComponent as any, 'destroyNodeTemplateHostRefs');
            expect(() => wmComponent.ngOnDestroy()).not.toThrow();
            expect(destroySpy).toHaveBeenCalled();
        });
    });
});
