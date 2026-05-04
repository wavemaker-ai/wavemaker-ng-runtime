import { ApplicationRef, Attribute, Component, ComponentRef, EnvironmentInjector, Inject, Injector, NgZone, OnDestroy, Optional, ViewEncapsulation, createComponent } from '@angular/core';
import { APPLY_STYLES_TYPE, getEvaluatedData, getOrderedDataset, provideAsWidgetRef, StylableComponent, styler } from '@wm/components/base';
import { registerProps } from './tree.props';
import { $parseEvent, getClonedObject } from "@wm/core";
import { isArray, isEmpty, isObject, isString } from "lodash-es";
import { TreeNodeTemplateHostComponent } from './tree-node-template-host.component';

declare const $;

const WIDGET_INFO = {widgetType: 'wm-tree', hostClass: 'app-tree'};
const defaultTreeIconClass = 'plus-minus';

@Component({
    standalone: true,
    selector: 'ul[wmTree]',
    templateUrl: './tree.component.html',
    providers: [
        provideAsWidgetRef(TreeComponent)
    ],
    encapsulation: ViewEncapsulation.None
})
export class TreeComponent extends StylableComponent implements OnDestroy {
    static initializeProps = registerProps();

    private nodes: Array<any>;
    private zTreeNodes: Array<any>;
    private level;
    private treeClass;
    private name;
    private zTree;

    public datavalue: string;
    public treeicons: string;
    public selecteditem: any;
    public nodeid: string;
    public nodeaction: string;
    public nodeclick: string;
    public nodelabel: string;
    public nodeicon: string;
    public nodechildren: string;
    public orderby: string;
    /** Partial name for custom tree node UI (set via setTemplate or binding). */
    public template: string;

    /** Dynamic hosts for custom node template (cleared on each render). */
    private nodeTemplateRefs: Array<ComponentRef<TreeNodeTemplateHostComponent>> = [];
    private readonly ngZone: NgZone;
    private readonly applicationRef: ApplicationRef;
    private readonly environmentInjector: EnvironmentInjector;

    private setting = {
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

    constructor(
        inj: Injector,
        @Attribute('datavalue.bind') private binddatavalue,
        @Attribute('nodelabel.bind') private bindnodelabel,
        @Attribute('nodeicon.bind') private bindnodeicon,
        @Attribute('nodechildren.bind') private bindnodechildren,
        @Attribute('nodeid.bind') private bindnodeid,
        @Inject('EXPLICIT_CONTEXT') @Optional() explicitContext: any
    ) {
        super(inj, WIDGET_INFO, explicitContext);
        this.ngZone = inj.get(NgZone);
        this.applicationRef = inj.get(ApplicationRef);
        this.environmentInjector = inj.get(EnvironmentInjector);
        styler(this.nativeElement, this, APPLY_STYLES_TYPE.CONTAINER);

        this.setting.view['nodeClasses']    = this.setNodeClasses;
        this.setting.callback["onClick"]    = this.onClick.bind(this);
        this.setting.callback["onExpand"]   = this.onExpand.bind(this);
        this.setting.callback["onCollapse"] = this.onCollapse.bind(this);
    }

    public onPropertyChange(key: string, nv: any, ov?: any): void {
        switch (key) {
            case 'dataset':
                this.nodes = this.getNodes(nv);
                this.renderTree();
                break;
            case 'levels':
                this.level = nv;
                this.renderTree();
                break;
            case 'nodeicon':
                this.nodeicon = nv;
                this.renderTree();
                break;
            case 'nodelabel':
                this.nodelabel = nv;
                this.renderTree();
                break;
            case 'nodechildren':
                this.nodechildren = nv;
                this.renderTree();
                break;
            case 'orderby':
                this.orderby = nv;
                this.renderTree();
                break;
            case 'treeicons':
                this.treeicons = nv;
                this.renderTree();
                break;
            case 'template':
                this.template = nv;
                this.renderTree();
                break;
            case 'class':
                this.treeClass = nv;
                this.setTreeTemplate(this.treeClass);
                super.onPropertyChange(key, nv, ov);
                this.renderTree();
                break;
            default:
                super.onPropertyChange(key, nv, ov);
                break;
        }
    }

    // set tree node template
    public setTemplate(partialName: string) {
        this.template = partialName;
        if (this.viewParent && this.viewParent.prefabName) {
            this['prefabName'] = this.viewParent.prefabName;
        }
        this.renderTree();
    }

    private destroyNodeTemplateHostRefs(): void {
        this.nodeTemplateRefs.forEach(ref => ref.destroy());
        this.nodeTemplateRefs = [];
    }

    /** Re-run change detection on custom node partials after zTree mutates node state (e.g. open). No-op when template is unset or no hosts exist. */
    private refreshTreeNodeTemplateHosts(): void {
        if (!this.template || !this.nodeTemplateRefs.length) {
            return;
        }
        this.ngZone.run(() => {
            for (const ref of this.nodeTemplateRefs) {
                try {
                    ref.changeDetectorRef.detectChanges();
                } catch {
                    /* host destroyed */
                }
            }
        });
    }

    /** Item passed to the custom template: zTree node API + row fields + toggle/select helpers. */
    private buildCustomTemplateItemProxy(treeNode: any): any {
        const rowData = treeNode.data;
        const itemPayload = rowData && typeof rowData === 'object' ? getClonedObject(rowData) : rowData;

        const self = this;
        const nodeHelperProto = Object.create(treeNode);
        nodeHelperProto.toggleExpand = (event?: Event) => {
            if (event) {
                event.preventDefault?.();
                event.stopPropagation?.();
            }
            if (!treeNode.isParent) {
                return;
            }
            self.expandNode(treeNode, !treeNode.open, true);
        };
        Object.defineProperty(nodeHelperProto, 'isSelected', {
            enumerable: true,
            configurable: true,
            get: () => !!self.zTree?.isSelectedNode?.(treeNode),
        });

        const nodeApi = Object.create(nodeHelperProto);
        return {
            ... itemPayload,
            _node: nodeApi,
        };
    }

    private mountTreeNodeTemplateHost(host: HTMLElement, treeNode: any): void {
        const ref = createComponent(TreeNodeTemplateHostComponent, {
            environmentInjector: this.environmentInjector,
            elementInjector: this.inj,
            hostElement: host,
        });
        ref.setInput('template', this.template);
        ref.setInput('userComponentParams', { dataObject: this.buildCustomTemplateItemProxy(treeNode) });
        this.applicationRef.attachView(ref.hostView);
        ref.changeDetectorRef.detectChanges();
        this.nodeTemplateRefs.push(ref);
    }

    private addDiyDom = (_treeId: string, treeNode: any) => {
        if (!this.template) {
            return;
        }
        const aObj = $('#' + treeNode.tId + '_a');
        if (!aObj.length || aObj.find('.wm-tree-node-template-host').length) {
            return;
        }
        /** hide default zTree switch & icon and hide the built-in label span when using a custom template. */
        const switchEl = $('#' + treeNode.tId + '_switch');
        switchEl.hide();
        $('#' + treeNode.tId + '_span').hide();

        const host = document.createElement('span');
        host.className = 'wm-tree-node-template-host wm-tree-node-item';
        aObj.append(host);
        this.mountTreeNodeTemplateHost(host, treeNode);
    };

    ngOnDestroy() {
        this.destroyNodeTemplateHostRefs();
        super.ngOnDestroy();
    }

    // expands the tree nodes if the property is selected.
    private expandTree(level, node, childLevel) {
        node.map(childNode => {
            const children = childNode.children;
            if (children && childLevel < level) {
                childNode.open = true;
                this.expandTree(level, children, childLevel+1);
            } else {
                childLevel = 0;
                return;
            }
        });
    }

    // sets the template for the tree based on the property selected.
    private setTreeTemplate(value) {
        const classList = value?.split(" ");
        if (classList?.length) {
            if (classList.includes('Classic')) {
                this.setting.check["enable"] = false;
            } else if (classList.includes('Checkbox')) {
                this.setting.check["enable"] = true;
                this.setting.check["chkStyle"] = 'checkbox';
            } else if (classList.includes('Radio')) {
                this.setting.check["enable"] = true;
                this.setting.check["chkStyle"] = 'radio';
                this.setting.check["radioType"] = "all";
            }
        }
    }

    // extracts nodes from string format
    private getNodesFromString(value) {
        return value.split(',').map((item) => {
            return {
                'label': item && item.trim()
            };
        });
    }

    // gets the nodes and orders the nodes if required
    private getNodes(newVal) {
        let nodes;
        if (isArray(newVal)) {
            nodes = getOrderedDataset(newVal, this.orderby);
        } else if (isObject(newVal)) {
            nodes = [newVal];
        } else if (isString(newVal) && !isEmpty(newVal)) {
            const trimmed = newVal.trim();
            if (trimmed) {
                if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
                    try {
                        const parsed = JSON.parse(trimmed);
                        if (isArray(parsed)) {
                            nodes = getOrderedDataset(parsed, this.orderby);
                        } else if (isObject(parsed)) {
                            nodes = [parsed];
                        }
                    } catch {
                        // Not valid JSON; treat as comma-separated labels below.
                    }
                }
                if (!nodes) {
                    nodes = this.getNodesFromString(trimmed);
                }
            }
        }
        return nodes;
    }


    // adds class to the nodes inorder to add icons to respective node.
    private setNodeClasses(treeId, treeNode) {
        return treeNode.icon ? {add: [`${treeNode.icon}`]} : '';
    };

    // adds tree icons to the nodes on load of the tree
    private changeTreeIcons(nv) {
        let eleClose = $('ul[name="' + this.name + '"] li span.button.switch');

        $(eleClose).map((idx, ele) => {
            $(ele).addClass(nv);
            $(ele).on("click",function(e) {
                setTimeout(() => {
                    $(ele).addClass(nv);
                }, 0);
            });
        })
    }

    // Returns the node path
    private getPath(treeNode, path) {
        if(treeNode.getParentNode() === null) {
            path = "/" + treeNode.name + path;
        } else {
            path = this.getPath(treeNode.getParentNode(), path) + "/" + treeNode.name;
        }
        return path;
    }

    // binds the click event to all nodes to open the child nodes
    public onClick(event, treeId, treeNode, clickFlag) {
        if(this.nodeclick === "expand") {
            var nodes = this.zTree.getSelectedNodes();
            if (nodes.length>0) {
                this.expandNode(nodes[0], !nodes[0].open, true);
            }
        }
        this.selectNode(event, treeNode);
    }

    // Adds tree icon classes to child nodes when expanded
    public onExpand(event, treeId, treeNode) {
        let self = this;
        let path = this.getPath(treeNode, "");

        const eventParams = {
            '$event'  : event,
            "$item"   : getClonedObject(treeNode.data),
            "$path" : path
        };
        this.invokeEventCallback('expand', eventParams);

        const children = treeNode.children;
        children?.map((el) => {
            if (el.isParent) {
                let ele = $(`#${el.tId}_switch`);
                $(ele).addClass(self.treeicons || defaultTreeIconClass);
                $(ele).on("click", function(e) {
                    setTimeout(() => {
                        $(ele).addClass(self.treeicons || defaultTreeIconClass);
                    }, 0);
                });
            }
        });
        this.refreshTreeNodeTemplateHosts();
    }

    public onCollapse(event, treeId, treeNode) {
        let path = this.getPath(treeNode, "");
        const eventParams = {
            '$event'  : event,
            "$item"   : getClonedObject(treeNode.data),
            "$path" : path
        };
        this.invokeEventCallback('collapse', eventParams);
        this.refreshTreeNodeTemplateHosts();
    }

    // function to support backward compatibility of objects
    private constructZTreeData(data, zTreeData) {
        data.forEach(node => {
            const zNode = {};
            const evaluatedLabel = getEvaluatedData(node, { field: this.nodelabel, bindExpression: this.bindnodelabel }, this.viewParent);
            // Avoid zTree rendering the literal "undefined" when label field is missing or nodelabel does not match dataset (e.g. data uses "key" only).
            const name =
                evaluatedLabel !== undefined && evaluatedLabel !== null && evaluatedLabel !== ''
                    ? evaluatedLabel
                    : (node.label ?? node.key ?? node.name ?? '');
            const icon = getEvaluatedData(node, { field: this.nodeicon, bindExpression: this.bindnodeicon }, this.viewParent) || node.icon;
            const nodeId = getEvaluatedData(node, { field: this.nodeid, bindExpression: this.bindnodeid }, this.viewParent);
            const children = getEvaluatedData(node, { field: this.nodechildren, bindExpression: this.bindnodechildren }, this.viewParent) || node.children;
            zNode['name'] = name === undefined || name === null ? '' : String(name);
            if(!this.template) {
                zNode['icon'] = icon;
            }
            zNode['nodeId'] = nodeId;
            zNode['data'] = getClonedObject(node);
            if (node.selected) {
                zNode['selected'] = true;
            }
            if (node.iconSkin != null && node.iconSkin !== '') {
                zNode['iconSkin'] = node.iconSkin;
            }
            if (node.iconOpen != null && node.iconOpen !== '') {
                zNode['iconOpen'] = node.iconOpen;
            }
            if (node.iconClose != null && node.iconClose !== '') {
                zNode['iconClose'] = node.iconClose;
            }
            if (isArray(children) && children.length) {
                zNode['children'] = [];
                this.constructZTreeData(children, zNode['children']);
            }
            zTreeData.push(zNode);
        });
    }

    // Renders the tree on to the dom
    public renderTree() {
        this.destroyNodeTemplateHostRefs();
        this.setting.view['addDiyDom'] = this.template ? this.addDiyDom : undefined;
        this.nativeElement.classList.toggle('app-tree-custom', !!this.template);
        this.zTreeNodes = [];
        if(this.nodes?.length) {
            this.nativeElement.setAttribute('id', this.name);
            this.constructZTreeData(this.nodes, this.zTreeNodes);
            if(this.level > 0) {
                this.expandTree(this.level, this.zTreeNodes, 0);
            }
        }
        this.zTree = $.fn.zTree.init($('ul[name="' + this.name + '"]'), this.setting, this.zTreeNodes);
        $.fn.zTreeKeyboardNavigation(this.zTree, $('ul[name="' + this.name + '"]'), null, this.treeicons || defaultTreeIconClass);
        this.postRenderTree();
    }

    private setChecked(zNode, node) {
        node.checked = zNode.checked;
        const children = getEvaluatedData(node, {field: this.nodechildren, bindExpression: this.bindnodechildren}, this.viewParent) || node.children;
        if(children?.length) {
            children.forEach((node, index) => {
                this.setChecked(zNode.children[index], node);
            });
        }
    }

    private selectNode(event, node) {
        const deSelectElm = $(`.app-tree[name=${this.name}] li[treenode].selected`);
        deSelectElm.removeClass('selected');

        if(!node) {
            this.refreshTreeNodeTemplateHosts();
            return;
        }
        const selectElm = $(`#${node.tId}:has(.curSelectedNode)`);
        selectElm.addClass('selected');


        const classList = (this.treeClass || "").split(" ");
        if (classList.includes('Checkbox') || classList.includes('Radio')) {
            this.setChecked(node, node.data);
        }

        const path = this.getPath(node, "");
        this.selecteditem = getClonedObject(node.data) || {};
        this.selecteditem.path = path;

        const eventParams = {
            '$event'  : event,
            "$item"   : getClonedObject(node.data),
            "$path" : path
        };

        //[Todo-CSP]: this data will be dynamic, can not generate function upfront
        const nodeAction = node.data[this.nodeaction || 'action'];
        if (nodeAction) {
            $parseEvent(nodeAction)(this);
        }
        this.invokeEventCallback('select', eventParams);
        this.refreshTreeNodeTemplateHosts();
    }

    private expandNode(node, expand, eventFlag) {
        this.zTree.expandNode(node, expand, false, false, eventFlag);
        const el = $(`#${node.tId}_switch`);
        $(el).addClass(this.treeicons || defaultTreeIconClass);
        this.refreshTreeNodeTemplateHosts();
    }

    private postRenderTree() {
        setTimeout(() => {
            this.changeTreeIcons(this.treeicons || defaultTreeIconClass);

            const allNodes = this.zTree.transformToArray(this.zTree.getNodes());
            const selectedNode = allNodes.find(n => n.selected);

            if (selectedNode) {
                this.zTree.selectNode(selectedNode, false);
                this.selectNode(undefined, selectedNode);
                this.expandNode(selectedNode, true, false);
                return;
            }

            if (this.datavalue && !this.selecteditem) {
                const nodes = this.zTree.getNodes();
                let node;
                if(nodes.length) {
                    if (this.datavalue === 'FirstNode') {
                        node = nodes[0];
                    }
                    if(this.datavalue === 'LastNode') {
                        node = nodes[nodes.length - 1];
                    }
                }

                if(node) {
                    this.zTree.selectNode(node, false);
                    this.selectNode(undefined, node);
                    this.expandNode(node, true, false);
                }
            }
        }, 200);
    }

    private selectById(value?) {
        const simpleNodes = this.zTree?.transformToArray(this.zTree.getNodes());
        const node = simpleNodes?.find(node => value === node.nodeId);
        if(node) {
            this.zTree.selectNode(node, false);
            this.selectNode(undefined, node);
        }
    }
    private deselectById(value?) {
        this.selecteditem = {};
        this.selectById();
    }
}
