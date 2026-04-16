import { Attribute, Element } from '@angular/compiler';
import { updateTemplateAttrs } from '@wm/core';

import { getAttrMarkup, getBoundToExpr, IBuildTaskDef, register } from '@wm/transpiler';

const wmListTag = 'wm-list';
const listTagName = 'div';
const dataSetKey = 'dataset';

register(wmListTag, (): IBuildTaskDef => {
    return {
        requires: ['wm-form', 'wm-liveform'],
        template: (node: Element, shared) => {

            const datasetAttr = node.attrs.find(attr => attr.name === dataSetKey);
            const widgetNameAttr = node.attrs.find(attr => attr.name === 'name');

            if (!datasetAttr) {
                return;
            }
            const boundExpr = getBoundToExpr(datasetAttr.value);

            if (!boundExpr) {
                return;
            }
            updateTemplateAttrs(node, boundExpr, widgetNameAttr.value, 'itemRef.');
            
            const listTemplateNode = (node.children || []).find(
                (c) => c instanceof Element && (c as Element)?.name === 'wm-listtemplate'
            ) as Element | undefined;

            if (listTemplateNode) {
                const meta: { [k: string]: string } = {};
                (listTemplateNode.attrs || []).forEach(a => {
                    meta[a.name] = a.value;
                });
                shared.set('listTemplateAttrs', JSON.stringify(meta));
            } else {
                shared.set('listTemplateAttrs', null);
            }
        },
        pre: (attrs, shared, parentForm, parentLiveForm) => {
            const parent = parentForm || parentLiveForm;
            shared.set('form_reference', parent && parent.get('form_reference'));

            const listTemplateAttrsJson = shared.get('listTemplateAttrs');
            if (listTemplateAttrsJson) {
                // Escape double quotes so they can sit safely inside an HTML attribute
                const escapedJson = listTemplateAttrsJson.replace(/"/g, '&quot;');
                attrs.set('itemattrs', escapedJson);
            }

            return `<${listTagName} wmList wmLiveActions ${getAttrMarkup(attrs)}>`;
        },
        post: () => `</${listTagName}>`,
        provide: (attrs, shared) => {
            const provider = new Map();
            provider.set('parent_form_reference', shared.get('form_reference'));
            return provider;
        }
    };
});

register('wm-listtemplate', (): IBuildTaskDef => {
    return {
        pre: () => `<ng-template #listTemplate let-item="item" let-$index="$index" let-itemRef="itemRef" let-$first="$first" let-$last="$last"  let-currentItemWidgets="currentItemWidgets" >`,
        post: () => `</ng-template>`
    };
});

function copyAttribute(from: Element, fromAttrName: string, to: Element, toAttrName: string) {
    const fromAttr = from.attrs.find( a => a.name === fromAttrName);
    if (fromAttr) {
        to.attrs.push(new Attribute(toAttrName, fromAttr.value, fromAttr.sourceSpan, fromAttr.keySpan, fromAttr.valueSpan, undefined, undefined));
    }
}

register('wm-list-action-template', (): IBuildTaskDef => {
    return {
        template: (node: Element) => {

            const position = node.attrs.find(attr => attr.name === 'position').value;

            const btns = <Element[]> node.children
                .filter(e => e instanceof Element && (<Element> e).name === 'wm-button');

            // add swipe-position on button nodes to identify whether buttons are from left or right action templates
            btns.forEach((btnNode) => {
                copyAttribute(node, 'position', btnNode, 'swipe-position');
            });
        },
        pre: (attrs, el) => {
            if (attrs.get('position') === 'left') {
                return `<ng-template #listLeftActionTemplate>
                            <li class="app-list-item-action-panel app-list-item-left-action-panel actionMenu" ${getAttrMarkup(attrs)}>`;
            }
            if (attrs.get('position') === 'right') {
                return `<ng-template #listRightActionTemplate>
                            <li class="app-list-item-action-panel app-list-item-right-action-panel actionMenu" ${getAttrMarkup(attrs)}>`;
            }
        },
        post: () => `</li></ng-template>`
    };
});

export default () => {};
