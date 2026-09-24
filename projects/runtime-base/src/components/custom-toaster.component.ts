import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, AfterViewInit, Component, ViewChild, ViewContainerRef, TemplateRef, OnDestroy } from '@angular/core';

import { Toast } from 'ngx-toastr';

import { $watch, $appDigest } from '@wm/core';
import {forEach, isString} from "lodash-es";
import { ContainerDirective, PartialContainerDirective, PartialParamDirective, PartialParamHandlerDirective } from '@wm/components/base';

declare const $;

@Component({
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: true,
    imports: [CommonModule, ContainerDirective, PartialParamHandlerDirective, PartialContainerDirective, PartialParamDirective],
    selector: '[custom-toaster-component]',
    template: `
        <div class="parent-custom-toast"></div>
        <ng-container #customToast></ng-container>
        <ng-template #customToastTmpl>
          <div wmContainer partialContainer content.bind="pagename">
            @for (param of params | keyvalue; track param) {
              <div wmParam hidden
              [name]="param.key" [value]="param.value"></div>
            }
          </div>
        </ng-template>`,
    preserveWhitespaces: false
})
export class CustomToasterComponent extends Toast implements AfterViewInit, OnDestroy {

    @ViewChild('customToast', { static: true, read: ViewContainerRef }) customToastRef: ViewContainerRef;
    @ViewChild('customToastTmpl') customToastTmpl: TemplateRef<any>;
    pagename: any;
    watchers: any = [];
    params: any = {};

    // ngx-toastr 20: Toast/ToastBase's constructor no longer takes toastrService/toastPackage as
    // params — both are now inject()-ed as base-class fields (ToastBase), so this subclass's own
    // constructor no longer needs them either; super() takes no args. `toastrService`/`toastPackage`
    // stay accessible via the inherited base-class fields (no need to redeclare them here — doing
    // so would shadow the base class's own inject()-populated fields).
    constructor() {
        super();
        // ngx-toastr 20: `message` is now a Signal (computed(() => this.toastPackage.message)),
        // not a plain property — must be called as a function to read its value.
        this.pagename = this.message() || '';
        this.generateParams();
    }

    // Generate the params for partial page. If bound, watch the expression and set the value
    generateParams() {
        // ngx-toastr 20: `options` is now a Signal (linkedSignal(() => this.toastPackage.config)),
        // not a plain property — must be called as a function to read its value.
        forEach((<any>this.options()).partialParams, (param) => {
            if (isString(param.value) && param.value.indexOf('bind:') === 0) {
                //[Todo-CSP]: bind expr fn should be generated in the toaster action for this
                this.watchers.push($watch(
                    param.value.substr(5),
                    (<any>this.options()).context,
                    {},
                    nv => {
                        this.params[param.name] = nv;
                        $appDigest();
                    }
                ));
            } else {
                this.params[param.name] = param.value;
            }
        });
    }

    async generateDynamicComponent() {
        const $targetLayout = $('.parent-custom-toast');

        this.customToastRef.clear();

        $targetLayout[0].appendChild(this.customToastRef.createEmbeddedView(this.customToastTmpl).rootNodes[0]);
    }

    ngAfterViewInit() {
        this.generateDynamicComponent();
    }

    ngOnDestroy() {
        forEach(this.watchers, watcher => watcher());
        super.ngOnDestroy();
    }
}
