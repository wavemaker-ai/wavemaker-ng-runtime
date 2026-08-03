import {PROP_BOOLEAN, PROP_NUMBER, PROP_STRING, register} from '@wm/components/base';

export const registerProps = () => {
    register(
        'wm-stepperheader',
        new Map(
            [
                ['class', PROP_STRING],
                ['name', PROP_STRING],
                ['show', {value: true, ...PROP_BOOLEAN}],
                ['stepstyle', {value: 'auto', ...PROP_STRING}],
                ['tabindex', {value: 0, ...PROP_NUMBER}],
                ['wizardname', PROP_STRING]
            ]
        )
    );
};
