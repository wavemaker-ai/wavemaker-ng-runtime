import {ContentChildren, Directive, Inject, Injector, OnDestroy, Optional} from '@angular/core';
import { StylableComponent } from "./stylable.component";
import { RedrawableDirective } from "../redraw/redrawable.directive";
import { IWidgetConfig } from '../../framework/types';
import {includes, pickBy} from "lodash-es";

@Directive()
export abstract class BaseContainerComponent extends StylableComponent implements OnDestroy {
    // reference to the components which needs a redraw(eg, grid, chart) when the show of this component changes
    @ContentChildren(RedrawableDirective, { descendants: true }) reDrawableComponents;
    public content;
    public Widgets;

    constructor(inj: Injector, WIDGET_CONFIG: IWidgetConfig, explicitContext: any) {
        super(inj, WIDGET_CONFIG, explicitContext);
    }

    private updateRedrawableComponents(widgets) {
        pickBy(widgets, widget => {
            // check for redrawable widget and whether it is already exist in reDrawableComponents query list or not
            if (widget && widget.nativeElement && widget.nativeElement.hasAttribute('redrawable') && !includes(this.reDrawableComponents._results, widget)) {
                this.reDrawableComponents._results.push(widget);
            }
            if (widget && widget.Widgets) {
                this.updateRedrawableComponents(widget.Widgets);
            }
        });
    }

    private redrawChildren() {
        // If container is bound to partial content, manually updating reDrawableComponents query list.
        if (this.content && this.Widgets) {
            this.updateRedrawableComponents(this.Widgets);
        }
        setTimeout(() => {
            if (this.reDrawableComponents) {
                this.reDrawableComponents.forEach(c => c.redraw());
            }
        }, 100);
    }

    onPropertyChange(key: string, nv: any, ov?: any) {
        super.onPropertyChange(key, nv, ov);
        if (key === 'show') {
            if (nv) {
                this.redrawChildren();
            }
        }
    }

    ngOnDestroy() {
        // MEMORY LEAK FIX: Clear redrawable components references
        // The reDrawableComponents QueryList holds references to child components
        // and updateRedrawableComponents manually pushes to _results array
        if (this.reDrawableComponents) {
            // Clear the manually added items from _results
            if (this.reDrawableComponents._results) {
                this.reDrawableComponents._results.length = 0;
            }
            // Reset the QueryList
            this.reDrawableComponents.reset([]);
        }

        // MEMORY LEAK FIX: Clear Widgets object to release child widget references
        // This object holds references to all child widgets in the container
        if (this.Widgets) {
            Object.keys(this.Widgets).forEach(key => {
                delete this.Widgets[key];
            });
            this.Widgets = null;
        }

        // MEMORY LEAK FIX: Clear content reference
        this.content = null;

        // Call parent ngOnDestroy (StylableComponent → BaseComponent)
        // This will clear the context and unregister the widget
        super.ngOnDestroy();
    }
}
