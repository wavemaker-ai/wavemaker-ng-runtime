import { getNgModelAttr } from '@wm/core';
import { getFormMarkupAttr, IBuildTaskDef, register, getChildAttrs } from '@wm/transpiler';

const tagName = 'ul';

register('wm-chipset', (): IBuildTaskDef => {
    return {
        pre: (attrs) => {
            const hintAttr = attrs.get("hint") ? ` title="${attrs.get("hint")}" ` : '';
            return `<${tagName} wmChipset ${hintAttr} ${getFormMarkupAttr(attrs)} ${getChildAttrs(attrs)}
               ${getNgModelAttr(attrs)}>`;
        },
        post: () => `</${tagName}>`
    };
});

export default () => {};
