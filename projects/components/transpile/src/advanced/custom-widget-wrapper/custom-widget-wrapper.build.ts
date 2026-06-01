import { Element, Text } from '@angular/compiler';
import { getAttrMarkup, IBuildTaskDef, register } from '@wm/transpiler';

const tagName = 'section';

register('wm-custom-widget-container', (): IBuildTaskDef => {
    return {
        template: (node: Element)  => {
            // Wrap content in @if block with proper newlines to avoid template syntax errors
            node.children.unshift(new Text('@if (compileContent) {\n', null, undefined, undefined));
            node.children.push(new Text('\n}', null, undefined, undefined));
        },
        pre: attrs => `<${tagName} wmCustomWidget data-role="widget" ${getAttrMarkup(attrs)}>`,
        post: () => `</${tagName}>`
    };
});

export default () => {};
