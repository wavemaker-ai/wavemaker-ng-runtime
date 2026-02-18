import { navigationService } from '../variable/variables.utils';
import {clone, isArray, isNil, isObject, isString, isUndefined} from "lodash-es";
import {$parseExpr} from "@wm/core";

/**
 * Evaluates bound page param expressions directly against the variable's context.
 * This ensures the latest bound values are captured at navigation time,
 * even if the $watch mechanism hasn't propagated them to variable.dataSet yet.
 */
const resolveDataSetBindings = (variable) => {
    const bindings = variable._binddataSet;
    if (!bindings || !isArray(bindings)) {
        return;
    }
    bindings.forEach(binding => {
        if (binding.value && isString(binding.value) && binding.value.startsWith('bind:')) {
            const expr = binding.value.replace('bind:', '');
            try {
                const fn = $parseExpr(expr);
                if (fn) {
                    const value = fn(variable._context, {});
                    if (!isUndefined(value)) {
                        const key = binding.target.includes('.') ? binding.target.split('.').pop() : binding.target;
                        variable.dataSet[key] = clone(value);
                    }
                }
            } catch (e) {
                // silently skip if expression evaluation fails
            }
        }
    });
};

/**
 * Merges any page param values resolved into dataBinding.dataSet
 * (when page param bindings are configured in dataBinding with dataSet.xxx targets)
 * into the main dataSet used for URL params.
 */
const mergeDataBindingPageParams = (variable) => {
    if (variable.dataBinding && isObject(variable.dataBinding.dataSet)) {
        Object.keys(variable.dataBinding.dataSet).forEach(key => {
            const val = variable.dataBinding.dataSet[key];
            if (!isUndefined(val)) {
                variable.dataSet[key] = val;
            }
        });
    }
};

/**
 * Handles variable navigation operations
 * @param variable
 * @param options
 */
export const navigate = (variable, options) => {
    if (options && options.data) {
        variable.dataSet = options.data;
    } else {
        resolveDataSetBindings(variable);
        mergeDataBindingPageParams(variable);
    }
    let viewName;
    const pageName = variable.dataBinding.pageName || variable.pageName,
        operation = variable.operation,
        urlParams = clone(variable.dataSet),
        cacheable = isNil(options?.cacheable) ? variable.cacheable : options.cacheable;
    options = options || {};

    if (!isNil(cacheable) && (!isString(cacheable) || cacheable.trim() !== '')) {
        urlParams['_cache_page'] = cacheable;
    }

    /* if operation is goToPage, navigate to the pageName */
    switch (operation) {
        case 'goToPreviousPage':
            navigationService.goToPrevious();
            break;
        case 'gotoPage':
            navigationService.goToPage(pageName, {
                transition: variable.pageTransitions,
                $event: options.$event,
                urlParams: urlParams,
                cacheable: variable.cacheable
            });
            break;
        case 'gotoView':
            viewName = (variable.dataBinding && variable.dataBinding.viewName) || variable.viewName;
            break;
        case 'gotoTab':
            viewName = (variable.dataBinding && variable.dataBinding.tabName) || variable.tabName;
            break;
        case 'gotoAccordion':
            viewName = (variable.dataBinding && variable.dataBinding.accordionName) || variable.accordionName;
            break;
        case 'gotoSegment':
            viewName = (variable.dataBinding && variable.dataBinding.segmentName) || variable.segmentName;
            break;
    }

    /* if view name found, call routine to navigate to it */
    if (viewName) {
        navigationService.goToView(viewName, {
            pageName: pageName,
            transition: variable.pageTransitions,
            $event: options.$event,
            urlParams: urlParams
        }, variable);
    }
};
