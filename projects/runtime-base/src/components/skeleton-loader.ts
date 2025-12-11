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
    constructor(private config: SkeletonConfig) {}

    private get c() {
        return this.config;
    }

    getBaseStyles(widgetType: string): string {
        const isApp = widgetType === 'app';
        return `:host{display:block;width:${isApp ? '100%' : this.c.width};height:${isApp ? '100%' : this.c.height};contain:content;${isApp ? 'position:fixed;top:0;left:0;z-index:9999;background-color:rgba(255,255,255,0.9);' : ''}}.skeleton-loader{width:100%;border-radius:${this.c.borderRadius};overflow:hidden;position:relative;box-sizing:border-box;contain:content;${isApp ? 'position:absolute;top:0;left:0;right:0;bottom:0;' : ''}}.skeleton-animated{position:relative;overflow:hidden;}.skeleton-animated::before{content:'';position:absolute;top:0;left:0;width:100%;height:100%;background:linear-gradient(90deg,rgba(255,255,255,0) 0%,${this.c.shimmerColor} 50%,rgba(255,255,255,0) 100%);transform:translateX(-100%);animation:loading ${this.c.animationDuration}s infinite;z-index:1;}@keyframes loading{100%{transform:translateX(100%);}}`;
    }

    getListStyles(): string {
        return `.list-loader{background-color:${this.c.backgroundColor};padding:${this.c.spacing};display:flex;flex-direction:column;gap:6px;}.list-loader .list-item{display:inline-block;padding:${this.c.spacing} 10px;background-color:#fff;border-radius:${this.c.borderRadius};}.list-loader .list-item-avatar{width:35px;height:16px;background-color:${this.c.foregroundColor};border-radius:${this.c.borderRadius};margin-right:${this.c.spacing};}.list-loader .list-item-content{flex:1;}.list-loader .list-item-title{height:15px;width:97%;background-color:${this.c.foregroundColor};margin-bottom:10px;border-radius:${this.c.borderRadius};}.list-loader .list-item-subtitle{height:15px;background-color:${this.c.foregroundColor};border-radius:${this.c.borderRadius};margin-top:10px;}.list-loader .list-item-subtitle:nth-child(2){width:85%;}.list-loader .list-item-subtitle:nth-child(3){width:72%;}.list-loader .list-item-subtitle:nth-child(4){width:60%;}.list-loader .background{background-color:#fff;display:flex;}`;
    }

    getCardStyles(): string {
        return `.card-loader{background-color:${this.c.backgroundColor};padding:0;}.card-loader .card-column{background-color:${this.c.backgroundColor};}${this.getListStyles()}.card-loader .card-column .list-loader{width:100%;display:inline-block;}.card-loader .card-column .list-item{border-bottom:0;background-color:transparent;padding:10px;display:inline-block;}.card-loader .background{background-color:#fff;display:flex;padding:10px;border-radius:${this.c.borderRadius};}`;
    }

    getTableStyles(): string {
        return `.skeleton-loader .table-loader{border-radius:${this.c.borderRadius};overflow:hidden;}.skeleton-loader .table-header{display:flex;margin-bottom:10px;gap:${this.c.spacing};background-color:#f0f0f0;border-radius:${this.c.borderRadius};padding:${this.c.spacing};}.skeleton-loader .table-header-cell{flex:1;height:15px;background-color:${this.c.foregroundColor};border-radius:${this.c.borderRadius};}.skeleton-loader .table-row{display:flex;gap:${this.c.spacing};border-radius:${this.c.borderRadius};padding:${this.c.spacing};}.skeleton-loader .table-row:hover{background-color:${this.c.shimmerColor};}.skeleton-loader .table-cell{flex:1;height:15px;background-color:${this.c.foregroundColor};border-radius:${this.c.borderRadius};}`;
    }

    getChartStyles(): string {
        return `.chart-loader{padding:${this.c.spacing};border-radius:${this.c.borderRadius};position:relative;overflow:hidden;}.chart-area{height:150px;position:relative;}.column-loader .chart-data{display:flex;gap:150px;align-items:flex-end;height:100%;}.column-loader .column{width:40px;background-color:${this.c.foregroundColor};border-radius:${this.c.borderRadius} ${this.c.borderRadius} 0 0;height:150px;}.bar-loader .chart-data{display:flex;flex-direction:column;height:100%;}.bar-loader .bar{height:18px;background-color:${this.c.foregroundColor};border-radius:3px;width:80%;margin-top:10px;}.line-loader .chart-data,.area-loader .chart-data,.bubble-loader .chart-data{position:relative;height:100%;}.line-loader .line,.cumulativeline-loader .line{width:100%;height:160px;position:relative;top:-15px;border:1px solid ${this.c.foregroundColor};border-top:none;border-right:none;}.line-loader .line .line-segment,.cumulativeline-loader .line .line-segment{width:100%;height:3px;background-color:${this.c.foregroundColor};position:absolute;top:82px;left:-50px;transform:rotate(173deg);}.area-loader .area{position:absolute;bottom:0;left:0;right:0;height:70%;background:linear-gradient(to bottom,${this.c.foregroundColor},${this.c.foregroundColor}10);clip-path:polygon(0 100%,0 30%,20% 45%,40% 20%,60% 40%,80% 25%,100% 35%,100% 100%);}.bubble-loader .bubble{width:100%;height:150px;position:relative;border:1px solid ${this.c.foregroundColor};border-top:none;border-right:none;display:flex;justify-content:space-between;}.bubble-loader .point{width:12px;height:12px;background-color:${this.c.foregroundColor};border-radius:50%;box-shadow:0 0 5px ${this.c.foregroundColor};}.bubble-loader .point:nth-child(1),.bubble-loader .point:nth-child(5){top:100px;}.bubble-loader .point:nth-child(3){top:50px;}.bubble-loader .point:nth-child(4){top:20px;}.pie-loader .chart-area,.donut-loader .chart-area{height:100%;display:flex;justify-content:center;}.pie-loader .pie-segment{width:150px;height:150px;background-color:${this.c.foregroundColor};border-radius:50%;}.donut-loader .donut-segment{width:150px;height:150px;background-color:${this.c.foregroundColor};border-radius:50%;position:relative;}.donut-loader .donut-segment .donut-inside{width:100px;height:100px;background-color:#fff;border-radius:50%;position:relative;left:25px;top:25px;}`;
    }

    getFormStyles(): string {
        return `.form-loader{display:flex;flex-direction:column;gap:${this.c.spacing};padding:${this.c.spacing};background-color:${this.c.backgroundColor};border-radius:${this.c.borderRadius};}.form-loader .form-field{height:40px;background-color:${this.c.foregroundColor};border-radius:${this.c.borderRadius};position:relative;margin-bottom:${this.c.spacing};}.form-loader .form-label{position:absolute;top:-20px;left:0;width:30%;height:15px;background-color:${this.c.shimmerColor};border-radius:${this.c.borderRadius};}`;
    }

    getAccordionStyles(): string {
        return `.accordion-loader{display:flex;flex-direction:column;background-color:${this.c.backgroundColor};border:1px solid ${this.c.foregroundColor}20;border-radius:${this.c.borderRadius};}.accordion-loader .accordion-item{border-bottom:1px solid ${this.c.foregroundColor}20;}.accordion-loader .accordion-item:last-child{border-bottom:none;}.accordion-loader .accordion-header{display:flex;align-items:center;padding:16px ${this.c.spacing};position:relative;cursor:wait;background-color:#fff;}.accordion-loader .accordion-chevron{width:20px;height:20px;position:relative;margin-right:12px;flex-shrink:0;}.accordion-loader .accordion-chevron::before,.accordion-loader .accordion-chevron::after{content:'';position:absolute;background-color:${this.c.foregroundColor};border-radius:2px;transform-origin:center;}.accordion-loader .accordion-chevron::before{width:2px;height:10px;left:50%;top:50%;transform:translate(-50%,-50%);}.accordion-loader .accordion-chevron::after{width:10px;height:2px;left:50%;top:50%;transform:translate(-50%,-50%);}.accordion-loader .accordion-item.expanded .accordion-chevron::before{opacity:0;}.accordion-loader .accordion-title-block{flex-grow:1;display:flex;flex-direction:column;gap:8px;}.accordion-loader .accordion-title{height:18px;width:60%;background-color:${this.c.foregroundColor};border-radius:${this.c.borderRadius};}.accordion-loader .accordion-badge{width:32px;height:20px;background-color:${this.c.foregroundColor};border-radius:10px;margin-left:12px;flex-shrink:0;}.accordion-loader .accordion-content{overflow:hidden;padding:0 ${this.c.spacing} 16px 48px;border-top:1px solid ${this.c.foregroundColor}20;background-color:#fff;}.accordion-loader .content-block{display:flex;flex-direction:column;gap:16px;padding-top:16px;}.accordion-loader .content-section{display:flex;flex-direction:column;gap:10px;}.accordion-loader .content-line{height:15px;background-color:${this.c.foregroundColor};border-radius:${this.c.borderRadius};}.content-line-full{width:100%;}.content-line-long{width:90%;}.content-line-medium{width:75%;}`;
    }

    getTabsStyles(): string {
        return `.tabs-loader{display:flex;flex-direction:column;background-color:${this.c.backgroundColor};border-radius:${this.c.borderRadius};overflow:hidden;}.tabs-loader .tabs-header{display:flex;gap:50px;padding:${this.c.spacing};border-bottom:1px solid ${this.c.foregroundColor};background-color:${this.c.backgroundColor};}.tabs-loader .tab-item{height:25px;padding:0 20px;background-color:${this.c.foregroundColor};border-radius:${this.c.borderRadius};position:relative;}.tabs-loader .tab-item.active::after{content:'';position:absolute;bottom:-2px;left:0;width:100%;height:2px;background-color:${this.c.shimmerColor};}.tabs-loader .tab-content{padding:${this.c.spacing};}.tabs-loader .tab-panel{display:flex;flex-direction:column;gap:${this.c.spacing};}.content-line{height:15px;background-color:${this.c.foregroundColor};border-radius:${this.c.borderRadius};}.content-line:nth-child(2){width:85%;}.content-line:nth-child(3){width:70%;}`;
    }

    getAppStyles(): string {
        return `.app-loader{display:grid;grid-template-areas:"header header" "nav main" "footer footer";grid-template-columns:250px 1fr;grid-template-rows:60px 1fr 50px;gap:${this.c.spacing};padding:${this.c.spacing};background-color:transparent;}.header{grid-area:header;background-color:${this.c.foregroundColor};border-radius:${this.c.borderRadius};display:flex;align-items:center;padding:${this.c.spacing};}.nav{grid-area:nav;border-radius:${this.c.borderRadius};padding:${this.c.spacing};display:flex;flex-direction:column;gap:12px;}.nav-item{height:20px;background-color:${this.c.foregroundColor};border-radius:${this.c.borderRadius};}.main{grid-area:main;border-radius:${this.c.borderRadius};padding:${this.c.spacing};display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:${this.c.spacing};}.content-block{height:150px;background-color:${this.c.foregroundColor};border-radius:${this.c.borderRadius};}.footer{grid-area:footer;background-color:${this.c.foregroundColor};border-radius:${this.c.borderRadius};}`;
    }

    getPrefabStyles(): string {
        return `.main{height:300px;background:${this.c.foregroundColor};border-radius:${this.c.borderRadius};margin-bottom:10px;}`;
    }

    getDefaultStyles(): string {
        return `.default-loader{display:flex;align-items:center;justify-content:center;background-color:${this.c.backgroundColor};padding:${this.c.spacing};border-radius:${this.c.borderRadius};animation:pulse 1.5s infinite ease-in-out;}.default-loader-item{height:80px;width:80px;background-color:${this.c.foregroundColor};border-radius:50%;}@keyframes pulse{0%,100%{transform:scale(1);}50%{transform:scale(1.1);}}`;
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
    constructor(private config: SkeletonConfig) {}

    generate(widgetType: string): HTMLElement {
        const container = DOMHelper.el(`skeleton-loader ${widgetType}-loader`);
        const contentMap: Record<string, (c: HTMLElement) => void> = {
            app: (c) => this.buildApp(c),
            list: (c) => this.buildList(c, widgetType, this.config.cardClass),
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

    private buildApp(container: HTMLElement): void {
        const nav = DOMHelper.skelEl('nav');
        const main = DOMHelper.skelEl('main');
        DOMHelper.multiEl(6, 'nav-item').forEach(el => nav.appendChild(el));
        DOMHelper.multiEl(6, 'content-block').forEach(el => main.appendChild(el));
        [DOMHelper.skelEl('header'), nav, main, DOMHelper.skelEl('footer')].forEach(el => container.appendChild(el));
    }

    private buildPrefab(container: HTMLElement): void {
        container.appendChild(DOMHelper.skelEl('main'));
    }

    private buildTabs(container: HTMLElement): void {
        const header = DOMHelper.el('tabs-header');
        const tabCount = Math.min(this.config.itemCount || 3, 5);
        for (let i = 0; i < tabCount; i++) {
            header.appendChild(DOMHelper.skelEl(`tab-item${i === 0 ? ' active' : ''}`));
        }
        const panel = DOMHelper.el('tab-panel');
        DOMHelper.multiEl(3, 'content-line').forEach(el => panel.appendChild(el));
        container.appendChild(header);
        container.appendChild(DOMHelper.el('tab-content', [panel]));
    }

    private buildCard(container: HTMLElement): void {
        container.className = 'card-loader';
        const leftList = DOMHelper.el('list-loader');
        this.buildList(leftList, 'card', this.config.cardClass);
        container.appendChild(DOMHelper.el('card-column', [leftList]));
    }

    private buildList(container: HTMLElement, widget: string, cardClass?: string): void {
        const count = widget === 'card' ? 5 : 3;
        const subtitleCount = widget === 'card' ? 3 : 1;
        for (let i = 0; i < count; i++) {
            const content = DOMHelper.el('list-item-content', [DOMHelper.skelEl('list-item-title')]);
            DOMHelper.multiEl(subtitleCount, 'list-item-subtitle').forEach(el => content.appendChild(el));
            const listItem = DOMHelper.el(`list-item${widget === 'card' ? ' ' + cardClass : ''}`, [DOMHelper.el('background', [DOMHelper.skelEl('list-item-avatar'), content])]);
            container.appendChild(listItem);
        }
    }

    private buildTable(container: HTMLElement): void {
        const header = DOMHelper.el('table-header');
        DOMHelper.multiEl(3, 'table-header-cell').forEach(el => header.appendChild(el));
        container.appendChild(header);
        for (let i = 0; i < this.config.tableRowCount; i++) {
            const row = DOMHelper.el('table-row');
            DOMHelper.multiEl(3, 'table-cell').forEach(el => row.appendChild(el));
            container.appendChild(row);
        }
    }

    private buildChart(container: HTMLElement, type: string): void {
        container.className = `chart-loader ${type}-loader`;
        const chartData = DOMHelper.el('chart-data');
        const handlers: Record<string, () => void> = {
            column: () => DOMHelper.multiEl(5, 'column').forEach(el => chartData.appendChild(el)),
            bar: () => DOMHelper.multiEl(5, 'bar').forEach(el => chartData.appendChild(el)),
            line: () => chartData.appendChild(DOMHelper.skelEl('line').appendChild(DOMHelper.el('line-segment')) && DOMHelper.skelEl('line')),
            'cumulative line': () => chartData.appendChild(DOMHelper.skelEl('line').appendChild(DOMHelper.el('line-segment')) && DOMHelper.skelEl('line')),
            bubble: () => { const bubble = DOMHelper.el('bubble'); DOMHelper.multiEl(5, 'point').forEach(el => bubble.appendChild(el)); chartData.appendChild(bubble); },
            area: () => chartData.appendChild(DOMHelper.skelEl('area')),
            pie: () => chartData.appendChild(DOMHelper.skelEl('pie-segment')),
            donut: () => { const donut = DOMHelper.skelEl('donut-segment'); donut.appendChild(DOMHelper.el('donut-inside')); chartData.appendChild(donut); }
        };
        (handlers[type] || handlers.column)();
        container.appendChild(DOMHelper.el('chart-area', [chartData]));
    }

    private buildForm(container: HTMLElement): void {
        for (let i = 0; i < this.config.itemCount; i++) {
            const field = DOMHelper.skelEl('form-field');
            field.appendChild(DOMHelper.skelEl('form-label'));
            container.appendChild(field);
        }
    }

    private buildAccordion(container: HTMLElement): void {
        const itemCount = Math.min(this.config.itemCount || 4, 8);
        for (let i = 0; i < itemCount; i++) {
            const item = DOMHelper.el(`accordion-item${i === 0 ? ' expanded' : ''}`);
            const titleBlock = DOMHelper.el('accordion-title-block', [DOMHelper.skelEl('accordion-title')]);
            item.appendChild(DOMHelper.el('accordion-header', [titleBlock, DOMHelper.skelEl('accordion-badge')]));
            if (i === 0) {
                const section = DOMHelper.el('content-section');
                ['full', 'long', 'medium'].forEach(w => section.appendChild(DOMHelper.skelEl(`content-line content-line-${w}`)));
                item.appendChild(DOMHelper.el('accordion-content', [DOMHelper.el('content-block', [section])]));
            }
            container.appendChild(item);
        }
    }

    private buildDefault(container: HTMLElement): void {
        container.appendChild(DOMHelper.skelEl('default-loader-item'));
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
            this._config = { ...this._config, ...JSON.parse(newValue) };
            this.updateLoader(this.getAttribute('widget-type') || 'default');
        } else if (name === 'widget-type') {
            this.updateLoader(newValue || 'default');
        }
    }

    connectedCallback() {
        const configAttr = this.getAttribute('config');
        if (configAttr) this._config = { ...this._config, ...JSON.parse(configAttr) };
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