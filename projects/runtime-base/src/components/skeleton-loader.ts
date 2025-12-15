interface SkeletonConfig {
    backgroundColor?: string;
    foregroundColor?: string;
    animationDuration?: number;
    borderRadius?: string;
    spacing?: string;
    itemCount?: number;
    tableRowCount?: number;
    height?: string;
    width?: string;
    shimmerColor?: string;
    chartType?: string;
    cardClass?: string;
}

const DEFAULT_CONFIG: SkeletonConfig = {
    backgroundColor: 'transparent',
    foregroundColor: '#e8e8e8',
    animationDuration: 1.5,
    borderRadius: '4px',
    spacing: '10px',
    itemCount: 3,
    tableRowCount: 6,
    height: 'auto',
    width: '100%',
    shimmerColor: 'rgba(255, 255, 255, 0.7)'
};

// ============ HELPER UTILITIES ============
class DOMHelper {
    static el(className: string, children?: HTMLElement[]): HTMLElement {
        const el = document.createElement('div');
        el.className = className;
        children?.forEach(child => el.appendChild(child));
        return el;
    }

    static skelEl(className: string): HTMLElement {
        return this.el(`${className} skeleton-animated`);
    }

    static multiEl(count: number, className: string, animated = true): HTMLElement[] {
        return Array.from({ length: count }, () => animated ? this.skelEl(className) : this.el(className));
    }
}

// ============ STYLE GENERATOR ============
class StyleGenerator {
    constructor(private config: SkeletonConfig) { }

    private get c() { return this.config; }

    getBaseStyles(widgetType: string): string {
        const isApp = widgetType === 'app';
        return `
            :host {
                display: block;
                width: ${isApp ? '100%' : this.c.width};
                height: ${isApp ? '100%' : this.c.height};
                ${isApp ? 'position:fixed;top:0;left:0;z-index:9999;background-color:rgba(255,255,255,0.95);' : ''}
            }
            :host(.fade-out) {
                animation: skeletonFadeOut 0.2s ease-out forwards;
                pointer-events: none;
            }
            .skeleton-loader {
                width: 100%;
                overflow: hidden;
                position: relative;
                box-sizing: border-box;
                ${isApp ? 'position:absolute;top:0;left:0;right:0;bottom:0;' : ''}
            }
            .skeleton-animated {
                position: relative;
                overflow: hidden;
                background-color: ${this.c.foregroundColor};
            }
            .skeleton-animated::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: linear-gradient(90deg, transparent 0%, ${this.c.shimmerColor} 50%, transparent 100%);
                transform: translateX(-100%);
                animation: shimmer ${this.c.animationDuration}s infinite;
            }
            @keyframes shimmer {
                100% { transform: translateX(100%); }
            }
            @keyframes skeletonFadeOut {
                from { opacity: 1; }
                to { opacity: 0; }
            }
        `;
    }

    getListStyles(): string {
        // DEFAULT_CLS = 'app-livelist app-panel' from list.component.ts
        return `
            /* List skeleton - shimmer placeholders only */
            .list-loader .skeleton-avatar {
                width: 40px;
                height: 40px;
                border-radius: 50%;
                flex-shrink: 0;
                display: inline-block;
                vertical-align: middle;
                margin-right: 12px;
            }
            .list-loader .skeleton-text {
                height: 14px;
                border-radius: 3px;
                margin-bottom: 6px;
                display: block;
            }
            .list-loader .skeleton-text:nth-child(1) { width: 60%; }
            .list-loader .skeleton-text:nth-child(2) { width: 80%; }
            .list-loader .skeleton-text:nth-child(3) { width: 45%; }
        `;
    }

    getCardStyles(): string {
        // DEFAULT_CLS = 'app-card card app-panel' from card.component.ts
        // Card footer: 'app-card-footer text-muted card-footer'
        // Card content: 'app-card-content card-body card-block'
        return `
            /* Card skeleton - shimmer placeholders only */
            .card-loader .app-livelist-container {
                display: block;
                padding-bottom: 1px;
            }
            .card-loader .skeleton-picture {
                width: 60%;
                aspect-ratio: 1;
                border-radius: 50%;
                margin: 0 auto;
                display: block;
            }
            .card-loader .skeleton-text {
                height: 1.2em;
                width: 50%;
                border-radius: 3px;
                margin: 0.25em auto;
                display: block;
            }
            .card-loader .skeleton-text.skeleton-title {
                height: 1.4em;
                width: 45%;
            }
            .card-loader .skeleton-text.skeleton-subtitle {
                height: 1em;
                width: 35%;
            }
            .card-loader .skeleton-icon {
                width: 2em;
                height: 2em;
                border-radius: 4px;
                display: inline-block;
            }
        `;
    }

    getTableStyles(): string {
        // DEFAULT_CLS = 'app-grid app-panel panel' from table.component.ts
        return `
            /* Table skeleton - shimmer placeholders only */
            .table-loader .skeleton-cell {
                height: 14px;
                border-radius: 3px;
            }
        `;
    }

    getChartStyles(): string {
        // Charts are custom visualizations - need minimal structural styles + shimmer
        return `
            /* Chart skeleton - minimal structure, shimmer for placeholders */
            .chart-loader .chart-area {
                height: 200px;
                position: relative;
                border-left: 2px solid ${this.c.foregroundColor};
                border-bottom: 2px solid ${this.c.foregroundColor};
                margin: 20px 10px 30px 40px;
            }
            .column-loader .chart-data {
                display: flex;
                align-items: flex-end;
                justify-content: space-around;
                height: 100%;
                padding: 0 20px;
            }
            .column-loader .skeleton-bar {
                width: 40px;
                border-radius: 3px 3px 0 0;
            }
            .column-loader .skeleton-bar:nth-child(1) { height: 60%; }
            .column-loader .skeleton-bar:nth-child(2) { height: 80%; }
            .column-loader .skeleton-bar:nth-child(3) { height: 45%; }
            .column-loader .skeleton-bar:nth-child(4) { height: 90%; }
            .column-loader .skeleton-bar:nth-child(5) { height: 55%; }
            .bar-loader .chart-data {
                display: flex;
                flex-direction: column;
                justify-content: space-around;
                height: 100%;
                padding: 10px 0;
            }
            .bar-loader .skeleton-bar {
                height: 24px;
                border-radius: 0 3px 3px 0;
            }
            .bar-loader .skeleton-bar:nth-child(1) { width: 70%; }
            .bar-loader .skeleton-bar:nth-child(2) { width: 85%; }
            .bar-loader .skeleton-bar:nth-child(3) { width: 50%; }
            .bar-loader .skeleton-bar:nth-child(4) { width: 95%; }
            .bar-loader .skeleton-bar:nth-child(5) { width: 60%; }
            .pie-loader .chart-area, .donut-loader .chart-area {
                border: none;
                display: flex; 
                justify-content: center;
                align-items: center;
                margin: 20px;
            }
            .pie-loader .skeleton-circle {
                width: 160px;
                height: 160px;
                border-radius: 50%;
            }
            .donut-loader .skeleton-donut {
                width: 160px;
                height: 160px;
                border-radius: 50%;
                position: relative;
            }
            .donut-loader .skeleton-donut-hole {
                position: absolute;
                width: 80px;
                height: 80px;
                background: #fff;
                border-radius: 50%;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
            }
            .line-loader .chart-data, .area-loader .chart-data {
                height: 100%;
                position: relative;
            }
            .line-loader .skeleton-line {
                position: absolute;
                bottom: 0;
                left: 0;
                right: 0;
                height: 3px;
                clip-path: polygon(0 80%, 20% 40%, 40% 60%, 60% 20%, 80% 50%, 100% 30%, 100% 100%, 0 100%);
            }
            .area-loader .skeleton-area {
                position: absolute;
                bottom: 0;
                left: 0;
                right: 0;
                height: 70%;
                opacity: 0.5;
                clip-path: polygon(0 70%, 20% 40%, 40% 55%, 60% 20%, 80% 45%, 100% 25%, 100% 100%, 0 100%);
            }
        `;
    }

    getFormStyles(): string {
        // Form uses 'app-form' / 'app-liveform' with 'panel app-panel'
        // Form group uses 'form-group app-composite-widget clearfix'
        return `
            /* Form skeleton - shimmer placeholders only */
            .form-loader .skeleton-label {
                height: 14px;
                width: 100px;
                border-radius: 3px;
                margin-bottom: 8px;
            }
            .form-loader .skeleton-input {
                height: 12px;
                width: 60%;
                border-radius: 3px;
            }
        `;
    }

    getAccordionStyles(): string {
        // DEFAULT_CLS = 'app-accordion panel-group' from accordion.directive.ts
        return `
            /* Accordion skeleton - shimmer placeholders only */
            .accordion-loader .skeleton-icon {
                width: 16px;
                height: 16px;
                border-radius: 3px;
                margin-right: 0.5em;
                display: inline-block;
                vertical-align: middle;
            }
            .accordion-loader .skeleton-title {
                height: 14px;
                width: 150px;
                border-radius: 3px;
                display: inline-block;
                vertical-align: middle;
            }
            .accordion-loader .skeleton-content-line {
                height: 12px;
                border-radius: 3px;
                margin-bottom: 10px;
            }
            .accordion-loader .skeleton-content-line:nth-child(1) { width: 100%; }
            .accordion-loader .skeleton-content-line:nth-child(2) { width: 80%; }
            .accordion-loader .skeleton-content-line:nth-child(3) { width: 60%; }
        `;
    }

    getTabsStyles(): string {
        // DEFAULT_CLS = 'app-tabs clearfix' from tabs.component.ts
        // Tab pane: 'tab-pane' from tab-pane.component.ts
        return `
            /* Tabs skeleton - shimmer placeholders only */
            .tabs-loader .skeleton-tab-label {
                height: 14px;
                width: 60px;
                border-radius: 3px;
            }
            .tabs-loader .skeleton-content-line {
                height: 12px;
                border-radius: 3px;
                margin-bottom: 12px;
            }
            .tabs-loader .skeleton-content-line:nth-child(1) { width: 100%; }
            .tabs-loader .skeleton-content-line:nth-child(2) { width: 75%; }
            .tabs-loader .skeleton-content-line:nth-child(3) { width: 50%; }
        `;
    }

    getAppStyles(): string {
        // Page classes from page.directive.ts: DEFAULT_CLS = 'app-page container'
        // Header: 'app-header clearfix', Footer: 'app-footer clearfix'
        // Left panel: 'app-left-panel', Content: 'app-content clearfix'
        return `
            /* App skeleton - full page layout structure */
            .app-loader {
                display: grid;
                grid-template-areas: "header header" "nav main" "footer footer";
                grid-template-columns: 220px 1fr;
                grid-template-rows: 56px 1fr 48px;
                height: 100%;
                background: #f5f5f5;
            }
            .app-loader .app-header {
                grid-area: header;
                background: #fff;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                display: flex;
                align-items: center;
                padding: 0 20px;
            }
            .app-loader .skeleton-logo {
                width: 120px;
                height: 28px;
                border-radius: 4px;
            }
            .app-loader .app-left-panel {
                grid-area: nav;
                background: #fff;
                padding: 20px 15px;
                border-right: 1px solid #eee;
            }
            .app-loader .skeleton-nav-item {
                height: 36px;
                border-radius: 4px;
                margin-bottom: 8px;
            }
            .app-loader .app-content {
                grid-area: main;
                padding: 20px;
            }
            .app-loader .skeleton-content-block {
                height: 120px;
                background: #fff;
                border-radius: 4px;
                margin-bottom: 15px;
                box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            }
            .app-loader .app-footer {
                grid-area: footer;
                background: #fff;
                border-top: 1px solid #eee;
            }
        `;
    }

    getPrefabStyles(): string {
        // DEFAULT_CLS = 'app-prefab' from prefab.directive.ts
        return `     
            /* Prefab skeleton - with centered spinner */
            .prefab-loader .skeleton-main {
                height: 100%;
                background: #fff;
                border-radius: ${this.c.borderRadius};
                box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .prefab-loader .skeleton-spinner {
                width: 40px;
                height: 40px;
                border: 3px solid black;
                border-top-color: ${this.c.shimmerColor};
                border-radius: 50%;
                animation: prefabSpin 0.8s linear infinite;
            }
            @keyframes prefabSpin {
                to { transform: rotate(360deg); }
            }
        `;
    }

    getDefaultStyles(): string {
        return `
            .default-loader {
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 40px;
            }
            .skeleton-default-item {
                width: 48px;
                height: 48px;
                border-radius: 50%;
            }
        `;
    }

    getStyles(widgetType: string): string {
        const styleMap: Record<string, () => string> = {
            app: () => this.getAppStyles(),
            list: () => this.getListStyles(),
            table: () => this.getTableStyles(),
            chart: () => this.getChartStyles(),
            form: () => this.getFormStyles(),
            card: () => this.getCardStyles(),
            tabs: () => this.getTabsStyles(),
            accordion: () => this.getAccordionStyles(),
            prefab: () => this.getPrefabStyles(),
            default: () => this.getDefaultStyles()
        };
        return this.getBaseStyles(widgetType) + (styleMap[widgetType] || styleMap.default)();
    }
}

// ============ CONTENT GENERATOR ============
class ContentGenerator {
    constructor(private config: SkeletonConfig) { }

    generate(widgetType: string): HTMLElement {
        const container = DOMHelper.el(`skeleton-loader ${widgetType}-loader`);
        const contentMap: Record<string, (c: HTMLElement) => void> = {
            app: (c) => this.buildApp(c),
            list: (c) => this.buildList(c),
            table: (c) => this.buildTable(c),
            chart: (c) => this.buildChart(c, this.config.chartType?.toLowerCase() || 'column'),
            form: (c) => this.buildForm(c),
            card: (c) => this.buildCard(c),
            tabs: (c) => this.buildTabs(c),
            accordion: (c) => this.buildAccordion(c),
            prefab: (c) => this.buildPrefab(c),
            default: (c) => this.buildDefault(c)
        };
        (contentMap[widgetType] || contentMap.default)(container);
        return container;
    }

    private buildList(container: HTMLElement): void {
        const count = this.config.itemCount || 3;

        // DEFAULT_CLS = 'app-livelist app-panel' - wrapper uses these classes
        const listWrapper = DOMHelper.el('app-livelist app-panel');

        // ul.list-group - actual Bootstrap class
        const listGroup = document.createElement('ul');
        listGroup.className = 'list-group';

        for (let i = 0; i < count; i++) {
            // li.list-group-item - actual Bootstrap class
            const listItem = document.createElement('li');
            listItem.className = 'list-group-item';

            // Avatar placeholder
            listItem.appendChild(DOMHelper.skelEl('skeleton-avatar'));

            // Text content wrapper
            const textWrapper = DOMHelper.el('skeleton-text-wrapper');
            textWrapper.style.display = 'inline-block';
            textWrapper.style.verticalAlign = 'middle';
            textWrapper.style.width = 'calc(100% - 60px)';

            textWrapper.appendChild(DOMHelper.skelEl('skeleton-text'));
            textWrapper.appendChild(DOMHelper.skelEl('skeleton-text'));

            listItem.appendChild(textWrapper);
            listGroup.appendChild(listItem);
        }
        listWrapper.appendChild(listGroup);
        container.appendChild(listWrapper);
    }

    private buildCard(container: HTMLElement): void {
        const cardClass = this.config.cardClass || 'col-xs-12 col-md-4';
        const count = this.config.itemCount || 3;

        // DEFAULT_CLS = 'app-livelist app-panel' - wrapper uses list classes
        const listWrapper = DOMHelper.el('app-livelist app-panel');

        // ul.app-livelist-container - actual WaveMaker class
        const listContainer = document.createElement('ul');
        listContainer.className = 'app-livelist-container clearfix';

        for (let i = 0; i < count; i++) {
            // li.app-list-item with Bootstrap grid class
            const listItem = document.createElement('li');
            listItem.className = `app-list-item ${cardClass}`;

            // DEFAULT_CLS = 'app-card card app-panel' from card.component.ts
            const card = DOMHelper.el('app-card card app-panel');

            // DEFAULT_CLS = 'app-card-content card-body card-block' from card-content.component.ts
            const content = DOMHelper.el('app-card-content card-body card-block');
            content.style.textAlign = 'center';

            // Skeleton placeholders
            content.appendChild(DOMHelper.skelEl('skeleton-picture'));
            content.appendChild(DOMHelper.skelEl('skeleton-text skeleton-title'));
            content.appendChild(DOMHelper.skelEl('skeleton-text skeleton-subtitle'));

            card.appendChild(content);

            // DEFAULT_CLS = 'app-card-footer text-muted card-footer' from card-footer.directive.ts
            const footer = DOMHelper.el('app-card-footer text-muted card-footer');
            footer.style.textAlign = 'center';

            // DEFAULT_CLS = 'btn-group app-button-group' from button-group.directive.ts
            const btnGroup = DOMHelper.el('btn-group app-button-group btn-group-justified');

            // 3 icon placeholders using 'btn app-button' from button.component.ts
            for (let j = 0; j < 3; j++) {
                const btn = DOMHelper.el('btn app-button btn-transparent');
                btn.appendChild(DOMHelper.skelEl('skeleton-icon'));
                btnGroup.appendChild(btn);
            }
            footer.appendChild(btnGroup);
            card.appendChild(footer);

            listItem.appendChild(card);
            listContainer.appendChild(listItem);
        }

        listWrapper.appendChild(listContainer);
        container.appendChild(listWrapper);
    }

    private buildTable(container: HTMLElement): void {
        const columnCount = 6;
        const rowCount = this.config.tableRowCount || 5;

        // DEFAULT_CLS = 'app-grid app-panel panel' from table.component.ts
        const gridWrapper = DOMHelper.el('app-grid app-panel panel');

        // Table element with Bootstrap classes
        const table = document.createElement('table');
        table.className = 'table table-bordered table-striped';

        // thead with header row
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        for (let i = 0; i < columnCount; i++) {
            const th = document.createElement('th');
            th.appendChild(DOMHelper.skelEl('skeleton-cell'));
            headerRow.appendChild(th);
        }
        thead.appendChild(headerRow);
        table.appendChild(thead);

        // tbody with data rows
        const tbody = document.createElement('tbody');
        for (let i = 0; i < rowCount; i++) {
            const tr = document.createElement('tr');
            for (let j = 0; j < columnCount; j++) {
                const td = document.createElement('td');
                td.appendChild(DOMHelper.skelEl('skeleton-cell'));
                tr.appendChild(td);
            }
            tbody.appendChild(tr);
        }
        table.appendChild(tbody);

        gridWrapper.appendChild(table);
        container.appendChild(gridWrapper);
    }

    private buildChart(container: HTMLElement, type: string): void {
        container.className = `skeleton-loader chart-loader ${type}-loader`;
        const chartArea = DOMHelper.el('chart-area');
        const chartData = DOMHelper.el('chart-data');

        switch (type) {
            case 'column':
                for (let i = 0; i < 5; i++) {
                    chartData.appendChild(DOMHelper.skelEl('skeleton-bar'));
                }
                break;
            case 'bar':
                for (let i = 0; i < 5; i++) {
                    chartData.appendChild(DOMHelper.skelEl('skeleton-bar'));
                }
                break;
            case 'pie':
                chartData.appendChild(DOMHelper.skelEl('skeleton-circle'));
                break;
            case 'donut': {
                const donut = DOMHelper.skelEl('skeleton-donut');
                donut.appendChild(DOMHelper.el('skeleton-donut-hole'));
                chartData.appendChild(donut);
                break;
            }
            case 'line':
                chartData.appendChild(DOMHelper.skelEl('skeleton-line'));
                break;
            case 'area':
                chartData.appendChild(DOMHelper.skelEl('skeleton-area'));
                break;
            default:
                for (let i = 0; i < 5; i++) {
                    chartData.appendChild(DOMHelper.skelEl('skeleton-bar'));
                }
        }

        chartArea.appendChild(chartData);
        container.appendChild(chartArea);
    }

    private buildForm(container: HTMLElement): void {
        // Form uses 'app-form' / 'app-liveform' with panel structure
        // DEFAULT_CLS = 'app-panel panel' from panel.component.ts
        const formWrapper = DOMHelper.el('app-liveform app-panel panel');
        const panelBody = DOMHelper.el('panel-body');

        for (let i = 0; i < (this.config.itemCount || 4); i++) {
            // DEFAULT_CLS = 'form-group app-composite-widget clearfix' from composite.directive.ts
            const group = DOMHelper.el('form-group app-composite-widget clearfix');

            // Label placeholder
            group.appendChild(DOMHelper.skelEl('skeleton-label'));

            // .form-control wrapper - actual Bootstrap class
            const field = DOMHelper.el('form-control');
            field.style.height = '38px';
            field.style.display = 'flex';
            field.style.alignItems = 'center';
            field.style.paddingLeft = '12px';
            field.appendChild(DOMHelper.skelEl('skeleton-input'));
            group.appendChild(field);

            panelBody.appendChild(group);
        }

        formWrapper.appendChild(panelBody);
        container.appendChild(formWrapper);
    }

    private buildAccordion(container: HTMLElement): void {
        const count = this.config.itemCount || 3;

        // DEFAULT_CLS = 'app-accordion panel-group' from accordion.directive.ts
        const accordion = DOMHelper.el('app-accordion panel-group');

        for (let i = 0; i < count; i++) {
            // .app-accordion-panel with Bootstrap panel classes
            const panel = DOMHelper.el('app-accordion-panel panel panel-default');

            // .panel-heading - actual Bootstrap class
            const header = DOMHelper.el('panel-heading');
            const title = DOMHelper.el('panel-title');
            title.appendChild(DOMHelper.skelEl('skeleton-icon'));
            title.appendChild(DOMHelper.skelEl('skeleton-title'));
            header.appendChild(title);
            panel.appendChild(header);

            // First panel expanded with content
            if (i === 0) {
                const collapse = DOMHelper.el('panel-collapse collapse in');
                const body = DOMHelper.el('panel-body');
                body.appendChild(DOMHelper.skelEl('skeleton-content-line'));
                body.appendChild(DOMHelper.skelEl('skeleton-content-line'));
                body.appendChild(DOMHelper.skelEl('skeleton-content-line'));
                collapse.appendChild(body);
                panel.appendChild(collapse);
            }

            accordion.appendChild(panel);
        }

        container.appendChild(accordion);
    }

    private buildTabs(container: HTMLElement): void {
        const tabCount = Math.min(this.config.itemCount || 3, 5);

        // DEFAULT_CLS = 'app-tabs clearfix' from tabs.component.ts
        const tabs = DOMHelper.el('app-tabs clearfix');

        // ul.nav.nav-tabs - actual Bootstrap classes
        const navTabs = document.createElement('ul');
        navTabs.className = 'nav nav-tabs';

        for (let i = 0; i < tabCount; i++) {
            const li = document.createElement('li');
            li.className = i === 0 ? 'active' : '';

            const anchor = document.createElement('a');
            anchor.className = 'tab-heading';
            anchor.appendChild(DOMHelper.skelEl('skeleton-tab-label'));

            li.appendChild(anchor);
            navTabs.appendChild(li);
        }
        tabs.appendChild(navTabs);

        // .tab-content - actual Bootstrap class
        const content = DOMHelper.el('tab-content');

        // DEFAULT_CLS = 'tab-pane' from tab-pane.component.ts
        const pane = DOMHelper.el('tab-pane active');
        const body = DOMHelper.el('tab-body');
        body.appendChild(DOMHelper.skelEl('skeleton-content-line'));
        body.appendChild(DOMHelper.skelEl('skeleton-content-line'));
        body.appendChild(DOMHelper.skelEl('skeleton-content-line'));
        pane.appendChild(body);
        content.appendChild(pane);

        tabs.appendChild(content);
        container.appendChild(tabs);
    }

    private buildApp(container: HTMLElement): void {
        // DEFAULT_CLS = 'app-header clearfix' from header.component.ts
        const header = DOMHelper.el('app-header clearfix');
        header.appendChild(DOMHelper.skelEl('skeleton-logo'));
        container.appendChild(header);

        // DEFAULT_CLS = 'app-left-panel' from left-panel.directive.ts
        const nav = DOMHelper.el('app-left-panel');
        for (let i = 0; i < 6; i++) {
            nav.appendChild(DOMHelper.skelEl('skeleton-nav-item'));
        }
        container.appendChild(nav);

        // DEFAULT_CLS = 'app-content clearfix' from content.component.ts
        const main = DOMHelper.el('app-content clearfix');
        for (let i = 0; i < 3; i++) {
            main.appendChild(DOMHelper.skelEl('skeleton-content-block'));
        }
        container.appendChild(main);

        // DEFAULT_CLS = 'app-footer clearfix' from footer.directive.ts
        container.appendChild(DOMHelper.el('app-footer clearfix'));
    }

    private buildPrefab(container: HTMLElement): void {
        // DEFAULT_CLS = 'app-prefab' from prefab.directive.ts
        const prefab = DOMHelper.el('app-prefab');
        const main = DOMHelper.skelEl('skeleton-main');
        // Add spinner inside the main skeleton area
        const spinner = document.createElement('div');
        spinner.className = 'skeleton-spinner';
        main.appendChild(spinner);
        prefab.appendChild(main);
        container.appendChild(prefab);
    }

    private buildDefault(container: HTMLElement): void {
        container.appendChild(DOMHelper.skelEl('skeleton-default-item'));
    }
}

// ============ MAIN COMPONENT ============
export class WMSkeletonLoader extends HTMLElement {
    private _config: SkeletonConfig = { ...DEFAULT_CONFIG };

    static get observedAttributes() { return ['widget-type', 'config']; }

    constructor() {
        super();
        Object.defineProperty(this, 'config', {
            get: () => this._config,
            set: (value) => {
                this._config = { ...DEFAULT_CONFIG, ...value };
                this.updateLoader(this.getAttribute('widget-type') || 'default');
            },
            configurable: true,
            enumerable: true
        });
    }

    attributeChangedCallback(name: string, _old: string, newValue: string) {
        if (name === 'config' && newValue) {
            try {
                this._config = { ...this._config, ...JSON.parse(newValue) };
            } catch {
                // Invalid JSON, ignore
            }
            this.updateLoader(this.getAttribute('widget-type') || 'default');
        } else if (name === 'widget-type') {
            this.updateLoader(newValue || 'default');
        }
    }

    connectedCallback() {
        const configAttr = this.getAttribute('config');
        if (configAttr) {
            try {
                this._config = { ...this._config, ...JSON.parse(configAttr) };
            } catch {
                // Invalid JSON, ignore
            }
        }
        this.updateLoader(this.getAttribute('widget-type') || 'default');
    }

    private updateLoader(widgetType: string): void {
        const styleGen = new StyleGenerator(this._config);
        const contentGen = new ContentGenerator(this._config);
        const style = document.createElement('style');
        style.textContent = styleGen.getStyles(widgetType);
        this.innerHTML = '';
        this.appendChild(style);
        this.appendChild(contentGen.generate(widgetType));
    }
}

customElements.define('wm-skeleton-loader', WMSkeletonLoader);