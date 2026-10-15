import { AfterViewInit, Component, OnDestroy, ViewChild, ChangeDetectionStrategy } from '@angular/core';
import { Subscription } from 'rxjs';
import { PrefabDirective } from '@wm/components/prefab';
import { PrefabManagerService } from '../services/prefab-manager.service';
import { PrefabDirective as PrefabLoader } from '../directives/prefab.directive';

const PREFAB = 'PREFAB';

@Component({
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: true,
    imports: [PrefabDirective, PrefabLoader],
    selector: 'wm-prefab-preview',
    template: `
        <div class="prefab-preview row">
            <section wmPrefab name="prefab-preview" prefabname="__self__"></section>
        </div>
    `
})
export class PrefabPreviewComponent implements AfterViewInit, OnDestroy {
    private config: any;
    private previewMode: boolean;

    @ViewChild(PrefabDirective, { static: true }) prefabInstance;
    private windowMessageListener: (e: MessageEvent) => void;
    private readyStateSubscription: Subscription;

    constructor(private readonly prefabManager: PrefabManagerService) {

        // MEMORY LEAK FIX: Store bound function reference for cleanup
        this.windowMessageListener = (e: MessageEvent) => {
            const context = e.data?.context;

            if (context !== PREFAB) {
                return;
            }

            const action = e.data.action;
            const payload = e.data.payload;

            if (action === 'init') {
                this.init();
            } else if (action === 'set-property') {
                this.setProperty(payload);
            } else if (action === 'get-outbound-properties') {
                this.getOutboundProps();
            } else if (action === 'invoke-script') {
                this.invokeScript(payload);
            }
        };
        
        window.addEventListener('message', this.windowMessageListener);
    }

    postMessage(action, payload?: any) {
        const data = {
            context: PREFAB,
            action,
            payload
        };
        window.top.postMessage(data, '*');
    }

    setupEventListeners() {
        this.prefabInstance.invokeEventCallback = (eventName, locals = {}) => {
            this.postMessage('event-log', { name: eventName, data: locals });
        };
    }

    init() {
        this.previewMode = true;

        // MEMORY LEAK FIX: Store subscription reference
        this.readyStateSubscription = this.prefabInstance.readyState.subscribe(
            () => { },
            () => { },
            () => {
                this.prefabManager.getConfig('__self__')
                    .then(config => {
                        this.config = config;
                        this.postMessage('config', config);

                        this.setupEventListeners();
                    });
            }
        );
    }

    setProperty(payload: any) {
        this.prefabInstance.widget[payload.name] = payload.value;
    }

    isOutBoundProp(info) {
        return info.bindable === 'out-bound' || info.bindable === 'in-out-bound';
    }

    getOutboundProps() {
        const payload = {};
        for (const [name, info] of Object.entries(this.config.properties || {})) {
            if (this.isOutBoundProp(info)) {
                payload[name] = this.prefabInstance.widget[name];
            }
        }

        this.postMessage('outbound-properties', payload);
    }

    invokeScript(payload: any) {
        const script = `\n return ${payload.script};`;

        const fn = new Function('Prefab', script);

        const retVal = fn(this.prefabInstance);

        this.postMessage('method-output', { methodName: payload.methodName, output: retVal });
    }

    ngAfterViewInit() {
        this.setupEventListeners();
        this.postMessage('init');
    }

    ngOnDestroy() {
        // MEMORY LEAK FIX: Remove window message listener
        if (this.windowMessageListener) {
            window.removeEventListener('message', this.windowMessageListener);
            this.windowMessageListener = null;
        }

        // MEMORY LEAK FIX: Unsubscribe from readyState
        if (this.readyStateSubscription) {
            this.readyStateSubscription.unsubscribe();
            this.readyStateSubscription = null;
        }

        // MEMORY LEAK FIX: Clear ViewChild reference
        this.prefabInstance = null;

        // MEMORY LEAK FIX: Clear config
        this.config = null;
    }
}

