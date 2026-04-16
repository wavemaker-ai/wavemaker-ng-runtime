import { getAttrMarkup, IBuildTaskDef, register } from '@wm/transpiler';
import { Element, Text } from "@angular/compiler";

const tagName = 'div';

register('wm-page-content', (): IBuildTaskDef => {
    return {
        template: (node: Element) => {
            // For SPA pages, just append onPageContentReady() without conditional wrapping
            for(let attr of node.attrs) {
                if(attr.name === 'spa' && attr.value === 'true') {
                    // No conditional wrapping needed - content should render immediately
                    node.children.push(new Text('{{onPageContentReady()}}', null, undefined, undefined));
                    break;
                }
            }
        },
        pre: attrs => `<${tagName} wmPageContent ${attrs.get('spa') && 'wmSpaPage' || ''} wmSmoothscroll="${attrs.get('smoothscroll') || 'false'}" ${getAttrMarkup(attrs)}>`,
        post: () => `</${tagName}>`,
        imports: (attrs) => {
            if (attrs.get('spa')) {
                return ['spa-page-content']
            }
            return [];
        }
    };
});

export default () => {};
