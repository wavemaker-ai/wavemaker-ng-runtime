import {getChildAttrs, getFormMarkupAttr, IBuildTaskDef, register} from '@wm/transpiler';
import {getNgModelAttr} from '@wm/core';

const tagName = 'div';

register('wm-checkbox', (): IBuildTaskDef => {
    return {
        pre: attrs => {
            if (attrs.get('type') === 'button') {
                return `<${tagName} wmCheckbox ${getFormMarkupAttr(attrs)} ${getChildAttrs(attrs)} ${getNgModelAttr(attrs)}>`
            } else {
                return `<${tagName} wmCheckbox ${getFormMarkupAttr(attrs)} ${getChildAttrs(attrs)} ${getNgModelAttr(attrs)} style="height:100%">`
            }

        },
        post: () => `</${tagName}>`
    };
});

export default () => {};
