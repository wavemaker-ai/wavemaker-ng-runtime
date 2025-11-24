import {Directive, Inject, Injector, OnDestroy, Optional, SecurityContext} from '@angular/core';

import {setProperty, toggleClass} from '@wm/core';
import {
    DISPLAY_TYPE,
    IWidgetConfig,
    provideAsWidgetRef,
    SanitizePipe,
    StylableComponent,
    styler
} from '@wm/components/base';

import {registerProps} from './label.props';
import {isObject} from "lodash-es";

const DEFAULT_CLS = 'app-label';
const WIDGET_CONFIG: IWidgetConfig = {
    widgetType: 'wm-label',
    hostClass: DEFAULT_CLS,
    displayType: DISPLAY_TYPE.INLINE_BLOCK
};

@Directive({
  standalone: true,
    selector: '[wmLabel]',
    providers: [
        provideAsWidgetRef(LabelDirective)
    ],
    exportAs: 'wmLabel'
})
export class LabelDirective extends StylableComponent implements OnDestroy {
    static initializeProps = registerProps();

    constructor(inj: Injector, private sanitizePipe:SanitizePipe, @Inject('EXPLICIT_CONTEXT') @Optional() explicitContext: any) {
        super(inj, WIDGET_CONFIG, explicitContext);

        styler(this.nativeElement, this);
    }

    onPropertyChange(key, nv, ov?) {
        // Guard against property changes after component destruction
        // This can happen when property changes are queued asynchronously
        if (this.isDestroyed) {
            return;
        }
        if (key === 'caption') {
            // Check for trustPipe safe values
            let bindContent = this.nativeElement.getAttribute('caption.bind');
            let safeValue = bindContent ? nv && bindContent.includes('trustAs:') : false;
            const insertZWSP = (value: any): string => {
                if (typeof value !== 'string') return value;
                return value.replace(/\d{5,}/g, (match) => {
                    return match.replace(/(.{9})(?=.)/g, '$1\u200B');
                });
            };
            if (isObject(nv) && !safeValue) {
                setProperty(this.nativeElement, 'textContent', JSON.stringify(nv));
            } else if (isObject(nv) && safeValue) {
                setProperty(this.nativeElement, 'innerHTML', nv[Object.keys(nv)[0]]);
            }  else {
                // Guard against sanitizePipe being null/undefined (e.g., after ngOnDestroy)
                if (this.sanitizePipe) {
                    setProperty(this.nativeElement, 'innerHTML', this.sanitizePipe.transform(insertZWSP(nv), SecurityContext.HTML));
                } else {
                    // Fallback to textContent if sanitizePipe is not available
                    setProperty(this.nativeElement, 'textContent', insertZWSP(nv));
                }
            }

        } else if (key === 'required') {
            toggleClass(this.nativeElement, 'required', nv);
        } else {
            super.onPropertyChange(key, nv, ov);
        }
    }

    ngOnDestroy() {
        // Call parent ngOnDestroy first (sets isDestroyed = true)
        // This ensures onPropertyChange checks fail fast if called asynchronously
        super.ngOnDestroy();

        // MEMORY LEAK FIX: Clear sanitizePipe reference after destruction flag is set
        // This retains references to the entire DI tree
        this.sanitizePipe = null;
    }
}
