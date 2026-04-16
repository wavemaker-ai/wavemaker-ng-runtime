import {AUTO_LAYOUT_PROPS, register} from '@wm/components/base';

export const registerProps = () => {
    register(
        'wm-listtemplate',
        new Map(
            [
                ...AUTO_LAYOUT_PROPS
            ]
        )
    );
};
