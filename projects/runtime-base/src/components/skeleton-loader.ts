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

export class WMSkeletonLoader extends HTMLElement {
    private _config: SkeletonConfig;

    private defaultConfig: SkeletonConfig = {
        backgroundColor: '#f9f9f9',
        foregroundColor: '#e0e0e0',
        animationDuration: 1.5,
        borderRadius: '3px',
        spacing: '15px',
        itemCount: 3,
        tableRowCount: 6,
        height: 'auto',
        width: '100%',
        shimmerColor: 'rgba(255, 255, 255, 0.6)'
    };

    static get observedAttributes() {
        return ['widget-type', 'config'];
    }

    constructor() {
        super();
        this._config = { ...this.defaultConfig };

        Object.defineProperty(this, 'config', {
            get: () => this._config,
            set: (value) => {
                this._config = { ...this.defaultConfig, ...value };
                this.updateLoader(this.getAttribute('widget-type') || 'default');
            },
            configurable: true,
            enumerable: true
        });
    }

    attributeChangedCallback(name: string, oldValue: string, newValue: string) {
        if (name === 'config' && newValue) {
            this._config = { ...this._config, ...JSON.parse(newValue) };
            this.updateLoader(this.getAttribute('widget-type') || 'default');
        } else if (name === 'widget-type') {
            this.updateLoader(newValue || 'default');
        }
    }

    connectedCallback() {
        const configAttr = this.getAttribute('config');
        if (configAttr) {
            this._config = { ...this._config, ...JSON.parse(configAttr) };
        }
        this.updateLoader(this.getAttribute('widget-type') || 'default');
    }

    // ============ HELPER METHODS ============

    private createEl(className: string, children?: HTMLElement[]): HTMLElement {
        const el = document.createElement('div');
        el.className = className;
        children?.forEach(child => el.appendChild(child));
        return el;
    }

    private createSkeletonEl(className: string): HTMLElement {
        return this.createEl(`${className} skeleton-animated`);
    }

    private createMultipleEls(count: number, className: string, animated = true): HTMLElement[] {
        return Array.from({ length: count }, () => 
            animated ? this.createSkeletonEl(className) : this.createEl(className)
        );
    }

    private appendChildren(parent: HTMLElement, children: HTMLElement[]): void {
        children.forEach(child => parent.appendChild(child));
    }

    // ============ STYLE GENERATION ============

    private getStyles(widgetType: string): string {
        const baseStyles = this.getBaseStyles(widgetType);
        const typeStyles: { [key: string]: string } = {
            app: this.getAppStyles(),
            list: this.getListStyles(),
            table: this.getTableStyles(),
            chart: this.getChartStyles(),
            form: this.getFormStyles(),
            card: this.getCardStyles(),
            tabs: this.getTabStyles(),
            accordion: this.getAccordionStyles(),
            default: this.getDefaultStyles(),
            prefab: this.getPrefabStyles()
        };

        return `${baseStyles}${typeStyles[widgetType] || typeStyles.default}`;
    }

    private getBaseStyles(widgetType: string): string {
        const { animationDuration, borderRadius, shimmerColor, width, height } = this._config;
        const isApp = widgetType === 'app';

        return `
            :host {
                display: block;
                width: ${isApp ? '100%' : width};
                height: ${isApp ? '100%' : height};
                contain: content;
                ${isApp ? `position: fixed; top: 0; left: 0; z-index: 9999; background-color: rgba(255, 255, 255, 0.9);` : ''}
            }
            .skeleton-loader {
                width: 100%;
                border-radius: ${borderRadius};
                overflow: hidden;
                position: relative;
                box-sizing: border-box;
                contain: content;
                ${isApp ? `position: absolute; top: 0; left: 0; right: 0; bottom: 0;` : ''}
            }
            .skeleton-animated {
                position: relative;
                overflow: hidden;
            }
            .skeleton-animated::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: linear-gradient(90deg, rgba(255, 255, 255, 0) 0%, ${shimmerColor} 50%, rgba(255, 255, 255, 0) 100%);
                transform: translateX(-100%);
                animation: loading ${animationDuration}s infinite;
                z-index: 1;
            }
            @keyframes loading {
                100% { transform: translateX(100%); }
            }
        `;
    }

    private getListStyles(): string {
        const { backgroundColor, foregroundColor, spacing, borderRadius } = this._config;
        return `
            .list-loader {
                background-color: ${backgroundColor};
                padding: ${spacing};
                display: flex;
                flex-direction: column;
                gap: 6px;
            }
            .list-loader .list-item {
                display: inline-block;
                padding: ${spacing} 10px;
                background-color: #fff;
                border-radius: ${borderRadius};
            }
            .list-loader .list-item-avatar {
                width: 35px;
                height: 16px;
                background-color: ${foregroundColor};
                border-radius: ${borderRadius};
                margin-right: ${spacing};
            }
            .list-loader .list-item-content { flex: 1; }
            .list-loader .list-item-title {
                height: 15px;
                width: 97%;
                background-color: ${foregroundColor};
                margin-bottom: 10px;
                border-radius: ${borderRadius};
            }
            .list-loader .list-item-subtitle {
                height: 15px;
                background-color: ${foregroundColor};
                border-radius: ${borderRadius};
                margin-top: 10px;
            }
            .list-loader .list-item-subtitle:nth-child(2) { width: 85%; }
            .list-loader .list-item-subtitle:nth-child(3) { width: 72%; }
            .list-loader .list-item-subtitle:nth-child(4) { width: 60%; }
            .list-loader .background {
                background-color: #fff;
                display: flex;
            }
        `;
    }

    private getCardStyles(): string {
        const { backgroundColor, borderRadius } = this._config;
        return `
            .card-loader {
                background-color: ${backgroundColor};
                padding: 0;
            }
            .card-loader .card-column {
                background-color: ${backgroundColor};
            }
            ${this.getListStyles()}
            .card-loader .card-column .list-loader {
                width: 100%;
                display: inline-block;
            }
            .card-loader .card-column .list-item {
                border-bottom: 0;
                background-color: transparent;
                padding: 10px;
                display: inline-block;
            }
            .card-loader .background {
                background-color: #fff;
                display: flex;
                padding: 10px;
                border-radius: ${borderRadius};
            }
        `;
    }

    private getTableStyles(): string {
        const { foregroundColor, spacing, borderRadius, shimmerColor } = this._config;
        return `
            .skeleton-loader .table-loader {
                border-radius: ${borderRadius};
                overflow: hidden;
            }
            .skeleton-loader .table-header {
                display: flex;
                margin-bottom: 10px;
                gap: ${spacing};
                background-color: #f0f0f0;
                border-radius: ${borderRadius};
                padding: ${spacing};
            }
            .skeleton-loader .table-header-cell {
                flex: 1;
                height: 15px;
                background-color: ${foregroundColor};
                border-radius: ${borderRadius};
            }
            .skeleton-loader .table-row {
                display: flex;
                gap: ${spacing};
                border-radius: ${borderRadius};
                padding: ${spacing};
            }
            .skeleton-loader .table-row:hover {
                background-color: ${shimmerColor};
            }
            .skeleton-loader .table-cell {
                flex: 1;
                height: 15px;
                background-color: ${foregroundColor};
                border-radius: ${borderRadius};
            }
        `;
    }

    private getChartStyles(): string {
        const { spacing, borderRadius, foregroundColor } = this._config;
        return `
            .chart-loader {
                padding: ${spacing};
                border-radius: ${borderRadius};
                position: relative;
                overflow: hidden;
            }
            .chart-area {
                height: 150px;
                position: relative;
            }
            
            /* Column Chart */
            .column-loader .chart-data {
                display: flex;
                gap: 150px;
                align-items: flex-end;
                height: 100%;
            }
            .column-loader .column {
                width: 40px;
                background-color: ${foregroundColor};
                border-radius: ${borderRadius} ${borderRadius} 0 0;
                height: 150px;
            }
            
            /* Bar Chart */
            .bar-loader .chart-data {
                display: flex;
                flex-direction: column;
                height: 100%;
            }
            .bar-loader .bar {
                height: 18px;
                background-color: ${foregroundColor};
                border-radius: 3px;
                width: 80%;
                margin-top: 10px;
            }
            
            /* Line/Area/Bubble Charts */
            .line-loader .chart-data,
            .area-loader .chart-data,
            .bubble-loader .chart-data {
                position: relative;
                height: 100%;
            }
            .line-loader .line,
            .cumulativeline-loader .line {
                width: 100%;
                height: 160px;
                position: relative;
                top: -15px;
                border: 1px solid ${foregroundColor};
                border-top: none;
                border-right: none;
            }
            .line-loader .line .line-segment,
            .cumulativeline-loader .line .line-segment {
                width: 100%;
                height: 3px;
                background-color: ${foregroundColor};
                position: absolute;
                top: 82px;
                left: -50px;
                transform: rotate(173deg);
            }
            .area-loader .area {
                position: absolute;
                bottom: 0;
                left: 0;
                right: 0;
                height: 70%;
                background: linear-gradient(to bottom, ${foregroundColor}, ${foregroundColor}10);
                clip-path: polygon(0 100%, 0 calc(30% + var(--wave-offset, 0%)), 20% calc(45% + var(--wave-offset, 0%)), 40% calc(20% + var(--wave-offset, 0%)), 60% calc(40% + var(--wave-offset, 0%)), 80% calc(25% + var(--wave-offset, 0%)), 100% calc(35% + var(--wave-offset, 0%)), 100% 100%);
            }
            
            /* Bubble Chart */
            .bubble-loader .bubble {
                width: 100%;
                height: 150px;
                position: relative;
                border: 1px solid ${foregroundColor};
                border-top: none;
                border-right: none;
                display: flex;
                justify-content: space-between;
            }
            .bubble-loader .point {
                width: 12px;
                height: 12px;
                background-color: ${foregroundColor};
                border-radius: 50%;
                box-shadow: 0 0 5px ${foregroundColor};
            }
            .bubble-loader .point:nth-child(1) { top: 100px; }
            .bubble-loader .point:nth-child(3) { top: 50px; }
            .bubble-loader .point:nth-child(4) { top: 20px; }
            .bubble-loader .point:nth-child(5) { top: 100px; }
            
            /* Pie/Donut Charts */
            .pie-loader .chart-area,
            .donut-loader .chart-area {
                height: 100%;
                display: flex;
                justify-content: center;
            }
            .pie-loader .pie-segment {
                width: 150px;
                height: 150px;
                background-color: ${foregroundColor};
                border-radius: 50%;
            }
            .donut-loader .donut-segment {
                width: 150px;
                height: 150px;
                background-color: ${foregroundColor};
                border-radius: 50%;
                position: relative;
            }
            .donut-loader .donut-segment .donut-inside {
                width: 100px;
                height: 100px;
                background-color: #fff;
                border-radius: 50%;
                position: relative;
                left: 25px;
                top: 25px;
            }
        `;
    }

    private getFormStyles(): string {
        const { spacing, backgroundColor, foregroundColor, borderRadius, shimmerColor } = this._config;
        return `
            .form-loader {
                display: flex;
                flex-direction: column;
                gap: ${spacing};
                padding: ${spacing};
                background-color: ${backgroundColor};
                border-radius: ${borderRadius};
            }
            .form-loader .form-field {
                height: 40px;
                background-color: ${foregroundColor};
                border-radius: ${borderRadius};
                position: relative;
                margin-bottom: ${spacing};
            }
            .form-loader .form-label {
                position: absolute;
                top: -20px;
                left: 0;
                width: 30%;
                height: 15px;
                background-color: ${shimmerColor};
                border-radius: ${borderRadius};
            }
        `;
    }

    private getAccordionStyles(): string {
        const { backgroundColor, foregroundColor, spacing, borderRadius } = this._config;
        return `
            .accordion-loader {
                display: flex;
                flex-direction: column;
                background-color: ${backgroundColor};
                border: 1px solid ${foregroundColor}20;
                border-radius: ${borderRadius};
            }
            .accordion-loader .accordion-item {
                border-bottom: 1px solid ${foregroundColor}20;
            }
            .accordion-loader .accordion-item:last-child {
                border-bottom: none;
            }
            .accordion-loader .accordion-header {
                display: flex;
                align-items: center;
                padding: 16px ${spacing};
                position: relative;
                cursor: wait;
                background-color: #fff;
            }
            .accordion-loader .accordion-chevron {
                width: 20px;
                height: 20px;
                position: relative;
                margin-right: 12px;
                flex-shrink: 0;
            }
            .accordion-loader .accordion-chevron::before,
            .accordion-loader .accordion-chevron::after {
                content: '';
                position: absolute;
                background-color: ${foregroundColor};
                border-radius: 2px;
                transform-origin: center;
            }
            .accordion-loader .accordion-chevron::before {
                width: 2px;
                height: 10px;
                left: 50%;
                top: 50%;
                transform: translate(-50%, -50%);
            }
            .accordion-loader .accordion-chevron::after {
                width: 10px;
                height: 2px;
                left: 50%;
                top: 50%;
                transform: translate(-50%, -50%);
            }
            .accordion-loader .accordion-item.expanded .accordion-chevron::before {
                opacity: 0;
            }
            .accordion-loader .accordion-title-block {
                flex-grow: 1;
                display: flex;
                flex-direction: column;
                gap: 8px;
            }
            .accordion-loader .accordion-title {
                height: 18px;
                width: 60%;
                background-color: ${foregroundColor};
                border-radius: ${borderRadius};
            }
            .accordion-loader .accordion-subtitle {
                height: 14px;
                width: 40%;
                background-color: ${foregroundColor};
                border-radius: ${borderRadius};
                opacity: 0.7;
            }
            .accordion-loader .accordion-badge {
                width: 32px;
                height: 20px;
                background-color: ${foregroundColor};
                border-radius: 10px;
                margin-left: 12px;
                flex-shrink: 0;
            }
            .accordion-loader .accordion-content {
                overflow: hidden;
                padding: 0 ${spacing} 16px 48px;
                border-top: 1px solid ${foregroundColor}20;
                background-color: #fff;
            }
            .accordion-loader .content-block {
                display: flex;
                flex-direction: column;
                gap: 16px;
                padding-top: 16px;
            }
            .accordion-loader .content-section {
                display: flex;
                flex-direction: column;
                gap: 10px;
            }
            .accordion-loader .content-heading {
                height: 15px;
                width: 30%;
                background-color: ${foregroundColor};
                border-radius: ${borderRadius};
            }
            .accordion-loader .content-line {
                height: 15px;
                background-color: ${foregroundColor};
                border-radius: ${borderRadius};
            }
            .content-line-full { width: 100%; }
            .content-line-long { width: 90%; }
            .content-line-medium { width: 75%; }
            .content-line-short { width: 60%; }
        `;
    }

    private getTabStyles(): string {
        const { backgroundColor, foregroundColor, spacing, borderRadius, shimmerColor } = this._config;
        return `
            .tabs-loader {
                display: flex;
                flex-direction: column;
                background-color: ${backgroundColor};
                border-radius: ${borderRadius};
                overflow: hidden;
            }
            .tabs-loader .tabs-header {
                display: flex;
                gap: 50px;
                padding: ${spacing};
                border-bottom: 1px solid ${foregroundColor};
                background-color: ${backgroundColor};
            }
            .tabs-loader .tab-item {
                height: 25px;
                padding: 0 20px;
                background-color: ${foregroundColor};
                border-radius: ${borderRadius};
                position: relative;
            }
            .tabs-loader .tab-item.active::after {
                content: '';
                position: absolute;
                bottom: -2px;
                left: 0;
                width: 100%;
                height: 2px;
                background-color: ${shimmerColor};
            }
            .tabs-loader .tab-content {
                padding: ${spacing};
            }
            .tabs-loader .tab-panel {
                display: flex;
                flex-direction: column;
                gap: ${spacing};
            }
            .content-line {
                height: 15px;
                background-color: ${foregroundColor};
                border-radius: ${borderRadius};
            }
            .content-line:nth-child(2) { width: 85%; }
            .content-line:nth-child(3) { width: 70%; }
        `;
    }

    private getAppStyles(): string {
        const { foregroundColor, spacing, borderRadius } = this._config;
        return `
            .app-loader {
                display: grid;
                grid-template-areas: "header header" "nav main" "footer footer";
                grid-template-columns: 250px 1fr;
                grid-template-rows: 60px 1fr 50px;
                gap: ${spacing};
                padding: ${spacing};
                background-color: transparent;
            }
            .header {
                grid-area: header;
                background-color: ${foregroundColor};
                border-radius: ${borderRadius};
                display: flex;
                align-items: center;
                padding: ${spacing};
            }
            .nav {
                grid-area: nav;
                border-radius: ${borderRadius};
                padding: ${spacing};
                display: flex;
                flex-direction: column;
                gap: 12px;
            }
            .nav-item {
                height: 20px;
                background-color: ${foregroundColor};
                border-radius: ${borderRadius};
            }
            .main {
                grid-area: main;
                border-radius: ${borderRadius};
                padding: ${spacing};
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
                gap: ${spacing};
            }
            .content-block {
                height: 150px;
                background-color: ${foregroundColor};
                border-radius: ${borderRadius};
            }
            .footer {
                grid-area: footer;
                background-color: ${foregroundColor};
                border-radius: ${borderRadius};
            }
        `;
    }

    private getPrefabStyles(): string {
        const { foregroundColor, borderRadius } = this._config;
        return `
            .main {
                height: 300px;
                background: ${foregroundColor};
                border-radius: ${borderRadius};
                margin-bottom: 10px;
            }
        `;
    }

    private getDefaultStyles(): string {
        const { backgroundColor, foregroundColor, spacing, borderRadius } = this._config;
        return `
            .default-loader {
                display: flex;
                align-items: center;
                justify-content: center;
                background-color: ${backgroundColor};
                padding: ${spacing};
                border-radius: ${borderRadius};
                animation: pulse 1.5s infinite ease-in-out;
            }
            .default-loader-item {
                height: 80px;
                width: 80px;
                background-color: ${foregroundColor};
                border-radius: 50%;
            }
            @keyframes pulse {
                0%, 100% { transform: scale(1); }
                50% { transform: scale(1.1); }
            }
        `;
    }

    // ============ CONTENT CREATION ============

    private createLoaderContent(widgetType: string): HTMLElement {
        const loaderContent = this.createEl(`skeleton-loader ${widgetType}-loader`);

        const creators: { [key: string]: () => void } = {
            app: () => this.createAppContent(loaderContent),
            list: () => this.createListContent(loaderContent, widgetType, this._config.cardClass),
            table: () => this.createTableContent(loaderContent),
            chart: () => this.createChartContent(loaderContent, this._config.chartType?.toLowerCase()),
            form: () => this.createFormContent(loaderContent),
            card: () => this.createCardContent(loaderContent, widgetType),
            tabs: () => this.createTabsContent(loaderContent),
            accordion: () => this.createAccordionContent(loaderContent),
            default: () => this.createDefaultContent(loaderContent),
            prefab: () => this.createPrefabContent(loaderContent)
        };

        (creators[widgetType] || creators.default)();
        return loaderContent;
    }

    private createAppContent(container: HTMLElement): void {
        const header = this.createSkeletonEl('header');
        const nav = this.createSkeletonEl('nav');
        const main = this.createSkeletonEl('main');
        const footer = this.createSkeletonEl('footer');

        this.appendChildren(nav, this.createMultipleEls(6, 'nav-item'));
        this.appendChildren(main, this.createMultipleEls(6, 'content-block'));
        this.appendChildren(container, [header, nav, main, footer]);
    }

    private createPrefabContent(container: HTMLElement): void {
        container.appendChild(this.createSkeletonEl('main'));
    }

    private createTabsContent(container: HTMLElement): void {
        const header = this.createEl('tabs-header');
        const tabCount = Math.min(this._config.itemCount || 3, 5);

        for (let i = 0; i < tabCount; i++) {
            header.appendChild(this.createSkeletonEl(`tab-item${i === 0 ? ' active' : ''}`));
        }

        const content = this.createEl('tab-content');
        const panel = this.createEl('tab-panel');
        this.appendChildren(panel, this.createMultipleEls(3, 'content-line'));

        content.appendChild(panel);
        this.appendChildren(container, [header, content]);
    }

    private createCardContent(container: HTMLElement, widget: string): void {
        container.className = 'card-loader';
        const leftColumn = this.createEl('card-column');
        const leftList = this.createEl('list-loader');

        this.createListContent(leftList, widget, this._config.cardClass);
        leftColumn.appendChild(leftList);
        container.appendChild(leftColumn);
    }

    private createListContent(container: HTMLElement, widget: string, cardClass: string): void {
        const count = widget === 'card' ? 5 : 3;
        const subtitleCount = widget === 'card' ? 3 : 1;

        for (let i = 0; i < count; i++) {
            const listItem = this.createEl(`list-item${widget === 'card' ? ' ' + cardClass : ''}`);
            const colorDiv = this.createEl('background');
            const avatar = this.createSkeletonEl('list-item-avatar');
            const content = this.createEl('list-item-content');
            const title = this.createSkeletonEl('list-item-title');

            content.appendChild(title);
            this.appendChildren(content, this.createMultipleEls(subtitleCount, 'list-item-subtitle'));

            this.appendChildren(colorDiv, [avatar, content]);
            listItem.appendChild(colorDiv);
            container.appendChild(listItem);
        }
    }

    private createTableContent(container: HTMLElement): void {
        const header = this.createEl('table-header');
        this.appendChildren(header, this.createMultipleEls(3, 'table-header-cell'));
        container.appendChild(header);

        for (let i = 0; i < this._config.tableRowCount; i++) {
            const row = this.createEl('table-row');
            this.appendChildren(row, this.createMultipleEls(3, 'table-cell'));
            container.appendChild(row);
        }
    }

    private createChartContent(container: HTMLElement, type: string): void {
        container.className = `chart-loader ${type}-loader`;
        const chartArea = this.createEl('chart-area');
        const chartData = this.createEl('chart-data');

        const chartCreators: { [key: string]: () => void } = {
            column: () => this.appendChildren(chartData, this.createMultipleEls(5, 'column')),
            bar: () => this.appendChildren(chartData, this.createMultipleEls(5, 'bar')),
            line: () => this.createLineChart(chartData),
            'cumulative line': () => this.createLineChart(chartData),
            bubble: () => this.createBubbleChart(chartData),
            area: () => chartData.appendChild(this.createSkeletonEl('area')),
            pie: () => chartData.appendChild(this.createSkeletonEl('pie-segment')),
            donut: () => this.createDonutChart(chartData)
        };

        (chartCreators[type] || chartCreators.column)();
        chartArea.appendChild(chartData);
        container.appendChild(chartArea);
    }

    private createLineChart(chartData: HTMLElement): void {
        const line = this.createSkeletonEl('line');
        line.appendChild(this.createEl('line-segment'));
        chartData.appendChild(line);
    }

    private createBubbleChart(chartData: HTMLElement): void {
        const bubble = this.createEl('bubble');
        this.appendChildren(bubble, this.createMultipleEls(5, 'point'));
        chartData.appendChild(bubble);
    }

    private createDonutChart(chartData: HTMLElement): void {
        const donutSegment = this.createSkeletonEl('donut-segment');
        donutSegment.appendChild(this.createEl('donut-inside'));
        chartData.appendChild(donutSegment);
    }

    private createFormContent(container: HTMLElement): void {
        for (let i = 0; i < this._config.itemCount; i++) {
            const field = this.createSkeletonEl('form-field');
            field.appendChild(this.createSkeletonEl('form-label'));
            container.appendChild(field);
        }
    }

    private createAccordionContent(container: HTMLElement): void {
        const itemCount = Math.min(this._config.itemCount || 4, 8);

        for (let i = 0; i < itemCount; i++) {
            const accordionItem = this.createEl(`accordion-item${i === 0 ? ' expanded' : ''}`);
            const header = this.createEl('accordion-header');
            const titleBlock = this.createEl('accordion-title-block');
            
            titleBlock.appendChild(this.createSkeletonEl('accordion-title'));
            this.appendChildren(header, [titleBlock, this.createSkeletonEl('accordion-badge')]);
            accordionItem.appendChild(header);

            if (i === 0) {
                accordionItem.appendChild(this.createAccordionExpandedContent());
            }

            container.appendChild(accordionItem);
        }
    }

    private createAccordionExpandedContent(): HTMLElement {
        const content = this.createEl('accordion-content');
        const contentBlock = this.createEl('content-block');
        const section = this.createEl('content-section');

        ['full', 'long', 'medium'].forEach(width => {
            section.appendChild(this.createSkeletonEl(`content-line content-line-${width}`));
        });

        contentBlock.appendChild(section);
        content.appendChild(contentBlock);
        return content;
    }

    private createDefaultContent(container: HTMLElement): void {
        container.appendChild(this.createSkeletonEl('default-loader-item'));
    }

    private updateLoader(widgetType: string): void {
        const style = document.createElement('style');
        style.textContent = this.getStyles(widgetType);
        const content = this.createLoaderContent(widgetType);

        this.innerHTML = '';
        this.appendChild(style);
        this.appendChild(content);
    }
}

customElements.define('wm-skeleton-loader', WMSkeletonLoader);