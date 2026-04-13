import { isDefined } from '@wm/core';

/**
 * Widget Registry
 */
const registryById = new Map<string, any>();

/**
 * returns the widget by the given widgetId
 */
export const getById = (widgetId: string) => registryById.get(widgetId);


/**
 * Registers the Widget with the given id and name
 * Makes the Widget available with the viewParent
 * returns unRegister method
 */
export const register = (widget: any, viewParent: any, widgetId: string, name?: string): () => void => {
    let registered = false;
    registryById.set(widgetId, widget);
    if (name) {
        if (isDefined(viewParent.Widgets)) {
            registered = true;
            viewParent.Widgets[name] = widget;
        }
    }

    // Unregister method.
    return () => {
        registryById.delete(widgetId);
        if (registered) {
            // MEMORY LEAK FIX: Delete the property instead of setting to undefined
            // This ensures the property is completely removed from the object
            delete viewParent.Widgets[name];
        }
    };
};

/**
 * Deregisters the oldname in widgets registry and sets new name
 */
export const renameWidget = (viewParent: any, widget: any, nv: string, ov?: string) => {
    if (!isDefined(viewParent.Widgets)) {
        return;
    }
    if (ov) {
        // MEMORY LEAK FIX: Delete the old property instead of setting to undefined
        delete viewParent.Widgets[ov];
    }
    if (nv) {
        viewParent.Widgets[nv] = widget;
    }
};
