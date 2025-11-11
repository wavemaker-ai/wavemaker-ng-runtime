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
    let registeredWithParent = false;
    // Always register by id so getById works even if parent is unavailable
    registryById.set(widgetId, widget);

    // Attach to parent Widgets map only if available
    if (name && viewParent && isDefined(viewParent.Widgets) && viewParent.Widgets) {
        registeredWithParent = true;
        viewParent.Widgets[name] = widget;
    }

    // Unregister method.
    return () => {
        // MEMORY LEAK FIX: Clear widget object before deleting from registry
        const widgetObj = registryById.get(widgetId);
        if (widgetObj) {
            widgetObj.widget = null;
            widgetObj.viewParent = null;
            widgetObj.context = null;
        }
        registryById.delete(widgetId);
        if (registeredWithParent && viewParent && viewParent.Widgets) {
            viewParent.Widgets[name] = undefined;
        }
    };
};

/**
 * Deregisters the oldname in widgets registry and sets new name
 */
export const renameWidget = (viewParent: any, widget: any, nv: string, ov?: string) => {
    // DEFENSIVE FIX: Check if viewParent exists before accessing Widgets
    if (!viewParent || !isDefined(viewParent.Widgets)) {
        return;
    }
    if (ov) {
        viewParent.Widgets[ov] = undefined;
    }
    if (nv) {
        viewParent.Widgets[nv] = widget;
    }
};
