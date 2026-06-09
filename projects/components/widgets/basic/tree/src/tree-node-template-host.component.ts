import { Component, Input } from '@angular/core';

import {
    ItemTemplateDirective,
    PartialContainerDirective,
    PartialParamHandlerDirective,
} from '@wm/components/base';

@Component({
    selector: 'wm-tree-node-template-host',
    standalone: true,
    imports: [
        ItemTemplateDirective,
        PartialParamHandlerDirective,
        PartialContainerDirective,
    ],
    template: `
        <span class="wm-tree-node-inner" [wmItemTemplate]="template" [userComponentParams]="userComponentParams" partialContainer>
            <span partial-container-target></span>
        </span>
    `,
})
export class TreeNodeTemplateHostComponent {
    @Input() template: string;
    @Input() userComponentParams: any;
}
