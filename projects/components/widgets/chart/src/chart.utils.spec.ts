import * as utils from './chart.utils';

declare const $;

// ---- fakes for the nvd3 / d3 globals ------------------------------------------------------

type Call = [string, any[]];

const makeNode = (calls: Call[], path = '', subs: string[] = []): any => {
    const children: Record<string, any> = {};
    const node: any = new Proxy({}, {
        get(_t, prop: string) {
            if (prop === 'then') { return undefined; }
            if (subs.includes(prop)) {
                return (children[prop] = children[prop] || makeNode(calls, `${path}${prop}.`));
            }
            return (...args: any[]) => {
                calls.push([`${path}${prop}`, args]);
                return node;
            };
        }
    });
    return node;
};

const makeChart = (calls: Call[]) => makeNode(calls, '', ['legend', 'tooltip', 'xAxis', 'yAxis', 'dispatch']);

const callsOf = (calls: Call[], name: string) => calls.filter(c => c[0] === name).map(c => c[1]);
const lastArg = (calls: Call[], name: string) => {
    const found = callsOf(calls, name);
    return found[found.length - 1]?.[0];
};

describe('chart.utils', () => {
    let calls: Call[];
    let modelCalls: string[];
    let d3Selections: Record<string, any>;

    beforeEach(() => {
        calls = [];
        modelCalls = [];
        d3Selections = {};
        const model = (name: string) => jest.fn(() => { modelCalls.push(name); return makeChart(calls); });
        (global as any).nv = {
            models: {
                multiBarChart: model('multiBarChart'),
                cumulativeLineChart: model('cumulativeLineChart'),
                lineChart: model('lineChart'),
                stackedAreaChart: model('stackedAreaChart'),
                multiBarHorizontalChart: model('multiBarHorizontalChart'),
                pieChart: model('pieChart'),
                scatterChart: model('scatterChart')
            }
        };
        (global as any).d3 = {
            format: jest.fn((spec: string) => (d: any) => {
                if (spec === '.2f') { return Number(d).toFixed(2); }
                if (spec === '.2%') { return (Number(d) * 100).toFixed(2) + '%'; }
                if (spec === '%') { return Math.round(Number(d) * 100) + '%'; }
                if (spec === ',.2s') { return `${d}s`; }
                if (spec === '.1s') { return `${d}k`; }
                return `${spec}:${d}`;
            }),
            timeFormat: jest.fn((fmt: string) => (date: Date) => `${fmt}|${date instanceof Date ? 'date' : 'other'}`),
            select: jest.fn((sel: string) => d3Selections[sel] || makeNode(calls, `select(${sel}).`)),
            selectAll: jest.fn(() => makeNode(calls, 'selectAll.'))
        };
    });

    afterEach(() => {
        delete (global as any).nv;
        delete (global as any).d3;
    });

    describe('chart type predicates', () => {
        it('identifies chart types', () => {
            expect(utils.isPieChart('Pie')).toBe(true);
            expect(utils.isPieChart('Donut')).toBe(false);
            expect(utils.isLineChart('Line')).toBe(true);
            expect(utils.isBarChart('Bar')).toBe(true);
            expect(utils.isDonutChart('Donut')).toBe(true);
            expect(utils.isBubbleChart('Bubble')).toBe(true);
            expect(utils.isColumnChart('Column')).toBe(true);
            expect(utils.isAreaChart('Area')).toBe(true);
            expect(utils.isPieType('Pie')).toBe(true);
            expect(utils.isPieType('Donut')).toBe(true);
            expect(utils.isPieType('Bar')).toBe(false);
        });

        it('knows which charts use JSON data, array data and line-style axes', () => {
            expect(utils.isChartDataJSON('Column')).toBe(true);
            expect(utils.isChartDataJSON('Custom')).toBe(true);
            expect(utils.isChartDataJSON('Area')).toBe(false);
            expect(utils.isChartDataArray('Cumulative Line')).toBe(true);
            expect(utils.isChartDataArray('Line')).toBe(false);
            expect(utils.isLineTypeChart('Area')).toBe(true);
            expect(utils.isLineTypeChart('Pie')).toBe(false);
            expect(utils.isAxisDomainSupported('Column')).toBe(true);
            expect(utils.isAxisDomainSupported('Area')).toBe(true);
            expect(utils.isAxisDomainSupported('Pie')).toBe(false);
        });

        it('exposes the chart type lists', () => {
            expect(utils.chartTypes).toContain('Donut');
            expect(utils.allShapes).toContain('circle');
            expect(utils.getDateList()).toHaveLength(3);
        });
    });

    describe('value maps', () => {
        it('maps bar spacing in both directions', () => {
            expect(utils.getBarSpacingValue('small', 'value')).toBe(0.3);
            expect(utils.getBarSpacingValue(0.5, 'key')).toBe('medium');
            expect(utils.getBarSpacingValue('small', 'other')).toBeUndefined();
        });

        it('maps radius in both directions', () => {
            expect(utils.getRadiusValue('large', 'value')).toBe(0.7);
            expect(utils.getRadiusValue(0.6, 'key')).toBe('medium');
            expect(utils.getRadiusValue('large', 'other')).toBeUndefined();
        });

        it('computes label settings', () => {
            expect(utils.getLabelValues('hide', false, 'value')).toEqual({ showlabels: false });
            expect(utils.getLabelValues('inside', false, 'value')).toEqual({ showlabels: true, showlabelsoutside: false });
            expect(utils.getLabelValues('outside', false, 'value')).toEqual({ showlabels: true, showlabelsoutside: true });
            expect(utils.getLabelValues('other', false, 'value')).toEqual({});
        });

        it('parses numbers or converts keys through the callback', () => {
            const cb = jest.fn(() => 'converted');
            expect(utils.getNumberValue('0.5', cb)).toBe('0.5');
            expect(utils.getNumberValue('small', cb)).toBe('converted');
            expect(cb).toHaveBeenCalledWith('small', 'value');
        });
    });

    describe('sample data', () => {
        it.each([
            ['jsonFormat', 1, 1], ['jsonFormat', 2, 2], ['jsonFormat', 3, 3],
            ['lineChartFormat', 1, 1], ['lineChartFormat', 2, 2], ['lineChartFormat', 3, 3],
            ['arrayFormat', 1, 1], ['arrayFormat', 2, 2], ['arrayFormat', 3, 3],
            ['bubbleFormat', 1, 1], ['bubbleFormat', 2, 2], ['bubbleFormat', 3, 3]
        ])('%s with %d series gives %d groups', (format, series, expected) => {
            const data = utils.constructSampleData(format, series, 'circle');
            expect(data).toHaveLength(expected);
            expect(data[0].key).toBe('Europe');
        });

        it('builds pie data and unknown formats', () => {
            expect(utils.constructSampleData('pieChartFormat', 1, 'x')).toHaveLength(4);
            expect(utils.constructSampleData('unknown', 1, 'x')).toEqual([]);
        });

        it('uses a fixed or random bubble shape', () => {
            expect(utils.constructSampleData('bubbleFormat', 1, 'square')[0].values[0].shape).toBe('square');
            jest.spyOn(Math, 'random').mockReturnValue(0);
            expect(utils.constructSampleData('bubbleFormat', 1, 'random')[0].values[0].shape).toBe('circle');
            (Math.random as jest.Mock).mockRestore();
        });

        it.each([
            ['Line', 'lineChartFormat'],
            ['Pie', 'pieChartFormat'],
            ['Donut', 'pieChartFormat'],
            ['Bubble', 'bubbleFormat'],
            ['Column', 'jsonFormat'],
            ['Custom', 'jsonFormat'],
            ['Area', 'arrayFormat']
        ])('chooses the data type for %s', (type, expected) => {
            expect(utils.getDataType({ type })).toBe(expected);
        });

        it('builds sample data from the widget context', () => {
            const data = utils.getSampleData({ type: 'Column', yaxisdatakey: 'a,b,c', shape: 'circle' });
            expect(data).toHaveLength(3);
        });
    });

    describe('axis helpers', () => {
        it('validates axis domains', () => {
            expect(utils.isAxisDomainValid({ xdomain: 'Min', type: 'Column' }, 'x')).toBe(true);
            expect(utils.isAxisDomainValid({ xdomain: 'Min', type: 'Pie' }, 'x')).toBe(false);
            expect(utils.isAxisDomainValid({ ydomain: 'Max', type: 'Column' }, 'y')).toBe(false);
        });

        it('checks min/max finiteness', () => {
            expect(utils.areMinMaxValuesValid({ min: 1, max: 2 })).toBe(true);
            expect(utils.areMinMaxValuesValid({ min: Infinity, max: 2 })).toBe(false);
            expect(utils.areMinMaxValuesValid({ min: 1, max: 'x' })).toBe(false);
        });

        it('lowers the y scale minimum so the minimum value is not clipped', () => {
            expect(utils.getYScaleMinValue(2.5)).toBeCloseTo(2.4);
            expect(utils.getYScaleMinValue(3)).toBe(2);
        });
    });

    describe('d3 post processing', () => {
        it('highlights or hides data points on a given or preview chart', () => {
            utils.highlightPoints('7', true);
            expect(callsOf(calls, 'select(#wmChart7 svg).selectAll')).toBeDefined();
            expect((global as any).d3.select).toHaveBeenCalledWith('#wmChart7 svg');
            utils.highlightPoints(undefined, true);
            expect((global as any).d3.select).toHaveBeenCalledWith('#preview-chart svg');
            expect(callsOf(calls, 'select(#preview-chart svg).selectAll')).toHaveLength(1);
            expect(calls.some(c => c[0].endsWith('.style') && c[1][0] === 'stroke-width' && c[1][1] === '6px')).toBe(true);
        });

        it('hides points when highlighting is off', () => {
            utils.highlightPoints('1', false);
            expect(callsOf(calls, 'select(#wmChart1 svg).selectAll')).toHaveLength(1);
        });

        it('sets the line thickness only when lines exist', () => {
            const style = jest.fn();
            d3Selections['#wmChart1 svg'] = { selectAll: () => ({ size: () => 2, style }) };
            utils.setLineThickness('1', 3);
            expect(style).toHaveBeenCalledWith('stroke-width', 3);
            style.mockClear();
            utils.setLineThickness('1', undefined);
            expect(style).toHaveBeenCalledWith('stroke-width', 1.5);
            d3Selections['#preview-chart svg'] = { selectAll: () => ({ size: () => 0, style }) };
            style.mockClear();
            utils.setLineThickness(undefined, 2);
            expect(style).not.toHaveBeenCalled();
        });

        it('post-processes line type charts only', () => {
            const style = jest.fn();
            d3Selections['#wmChart9 svg'] = { selectAll: () => ({ size: () => 1, style: (...a: any[]) => { style(...a); return { style: () => ({ style: () => {} }) }; } }) };
            utils.postPlotChartProcess({ type: 'Line', $id: '9', linethickness: 2, highlightpoints: true });
            expect(style).toHaveBeenCalled();
            style.mockClear();
            utils.postPlotChartProcess({ type: 'Pie', $id: '9' });
            expect(style).not.toHaveBeenCalled();
            d3Selections['#preview-chart svg'] = { selectAll: () => ({ size: () => 0, style: () => ({ style: () => ({ style: () => {} }) }) }) };
            expect(() => utils.postPlotChartProcess({ type: 'Area', $id: '9', highlightpoints: false }, true)).not.toThrow();
        });

        it('toggles axis visibility', () => {
            const xStyle = jest.fn();
            const yStyle = jest.fn();
            d3Selections['#preview-chart g.nv-axis.nv-x'] = { style: xStyle };
            d3Selections['#preview-chart g.nv-axis.nv-y'] = { style: yStyle };
            utils.toggleAxisShow('showxaxis', true);
            utils.toggleAxisShow('showxaxis', false);
            utils.toggleAxisShow('showyaxis', true);
            expect(xStyle).toHaveBeenNthCalledWith(1, 'visibility', 'visible');
            expect(xStyle).toHaveBeenNthCalledWith(2, 'visibility', 'hidden');
            expect(yStyle).toHaveBeenCalledWith('visibility', 'visible');
            utils.toggleAxisShow('showyaxis', false);
            expect(yStyle).toHaveBeenLastCalledWith('visibility', 'hidden');
        });
    });

    describe('legend visibility and position', () => {
        it.each([
            [false, false], ['false', false], [true, true], ['true', true],
            ['hide', false], ['top', true], ['bottom', true], [undefined, true]
        ])('isShowLegend(%s) is %s', (value, expected) => {
            expect(utils.isShowLegend(value)).toBe(expected);
        });

        const setupLegend = (opts: { wrapTransform?: string | null; wrapHeight?: number; svgHeight?: number } = {}) => {
            document.body.innerHTML = '<div id="wmChart5"><svg><g class="nvd3 nv-wrap"></g></svg></div>';
            const wrapEl = document.querySelector('#wmChart5 svg>.nvd3.nv-wrap') as any;
            const svgEl = document.querySelector('#wmChart5 svg') as any;
            wrapEl.getBoundingClientRect = () => ({ height: opts.wrapHeight ?? 100 });
            svgEl.getBoundingClientRect = () => ({ height: opts.svgHeight ?? 200 });
            const legendEl = { getBoundingClientRect: () => ({ height: 20 }) };
            const legendAttr = jest.fn();
            const wrapAttr = jest.fn((name: string, value?: any) => (value === undefined ? opts.wrapTransform : undefined));
            d3Selections['#wmChart5 .nv-legendWrap'] = { _groups: [[legendEl]], attr: legendAttr };
            d3Selections['#wmChart5 .nv-wrap'] = { attr: wrapAttr };
            return { legendAttr, wrapAttr };
        };

        it('moves the legend to the bottom and re-positions the chart wrap', () => {
            const { legendAttr, wrapAttr } = setupLegend({ wrapTransform: 'translate(30, 40)' });
            utils.modifyLegendPosition({ showlegend: 'bottom' }, 'bottom', '5');
            expect(legendAttr).toHaveBeenCalledWith('transform', 'translate(0 , 75)');
            expect(wrapAttr).toHaveBeenCalledWith('transform', 'translate(30,5)');
        });

        it('falls back to the svg height when the wrap reports no height, and handles missing transforms', () => {
            const { legendAttr, wrapAttr } = setupLegend({ wrapTransform: null, wrapHeight: 0, svgHeight: 200 });
            utils.modifyLegendPosition({ showlegend: 'bottom' }, 'bottom', '5');
            expect(legendAttr).toHaveBeenCalledWith('transform', 'translate(0 , ' + (200 - 35 - 20 - 5) + ')');
            expect(wrapAttr).not.toHaveBeenCalledWith('transform', expect.stringContaining('translate('));
        });

        it('does nothing when the legend is hidden, missing, or not at the bottom', () => {
            const { legendAttr } = setupLegend();
            utils.modifyLegendPosition({ showlegend: 'hide' }, 'bottom', '5');
            utils.modifyLegendPosition({ showlegend: 'top' }, 'top', '5');
            d3Selections['#wmChart5 .nv-legendWrap'] = { _groups: [[undefined]], attr: legendAttr };
            utils.modifyLegendPosition({ showlegend: 'bottom' }, 'bottom', '5');
            expect(legendAttr).not.toHaveBeenCalled();
        });

        it('uses the preview chart id when no id is given', () => {
            d3Selections['#preview-chart .nv-legendWrap'] = { _groups: [[undefined]], attr: jest.fn() };
            utils.modifyLegendPosition({ showlegend: true }, 'bottom', undefined);
            expect((global as any).d3.select).toHaveBeenCalledWith('#preview-chart .nv-legendWrap');
        });
    });

    describe('formatting', () => {
        it('formats dates, defaulting the format and expanding %c', () => {
            utils.getDateFormatedData(undefined, '2020-05-20');
            expect((global as any).d3.timeFormat).toHaveBeenLastCalledWith('%x');
            expect(utils.getDateFormatedData('%c', '2020-05-20')).toContain('%a %b %e %X %Y');
            expect(utils.getDateFormatedData('%Y', '2020-05-20')).toBe('%Y|date');
        });

        it('formats numbers with the named abbreviations', () => {
            expect(utils.getNumberFormatedData('Thousand', 1500)).toBe('1.5K');
            expect(utils.getNumberFormatedData('Thousand', 2000)).toBe('2K');
            expect(utils.getNumberFormatedData('Million', 2500000)).toBe('2.5M');
            expect(utils.getNumberFormatedData('Billion', 3000000000)).toBe('3B');
        });

        it('formats percentages, fixed decimals and custom formats', () => {
            expect(utils.getNumberFormatedData('%', 0.256)).toBe('25.60%');
            expect(utils.getNumberFormatedData('.f', 1.5)).toBe('1.5');
            expect(utils.getNumberFormatedData('.f', 3)).toBe('3');
            expect(utils.getNumberFormatedData(',.0f', 4)).toBe(',.0f:4');
        });

        it('auto formats when no number format is given', () => {
            expect(utils.getNumberFormatedData(undefined, 1500)).toBe('1500k');
            expect(utils.getNumberFormatedData(undefined, 5)).toBe('5');
            expect(utils.getNumberFormatedData(undefined, 0)).toBe(0);
        });

        it('keeps non-numeric strings intact when trimming zeros', () => {
            expect(utils.getNumberFormatedData('x', 'abc')).toBe('x:abc');
        });
    });

    describe('initProperties', () => {
        it('copies missing basic properties from the widget context and keeps given ones', () => {
            const out = utils.initProperties({ xaxislabel: 'X', yaxislabel: 'Y', theme: 'Azure' }, { yaxislabel: 'Given' });
            expect(out.xaxislabel).toBe('X');
            expect(out.yaxislabel).toBe('Given');
            expect(out.theme).toBe('Azure');
        });

        it('creates a map when none or an empty one is given', () => {
            expect(utils.initProperties({ theme: 'Azure' }, undefined).theme).toBe('Azure');
            expect(utils.initProperties({ theme: 'Azure' }, {}).theme).toBe('Azure');
        });
    });

    describe('customiseTooltip', () => {
        const make = (type: string, ctx: any = {}) => {
            const chart = makeChart(calls);
            utils.customiseTooltip(chart, { ynumberformat: undefined }, { type, ...ctx }, 'Label');
            const generator = lastArg(calls, 'tooltip.contentGenerator');
            return generator;
        };

        it('renders a value tooltip for regular charts', () => {
            const html = make('Column')({ data: { x: 'A', y: 5 }, color: 'red' }, {});
            expect(html).toContain('<b>A</b>');
            expect(html).toContain('Label');
            expect(html).toContain('background-color:red');
            expect(html).toContain('>5<');
        });

        it('uses the x value as the label for pie and donut charts', () => {
            const html = make('Pie')({ data: { x: 'Slice', y: 10 }, color: 'blue' }, undefined);
            expect(html).toContain('class="key">Slice<');
            expect(html).toContain('<b></b>');
        });

        it('prefers the number format of the tooltip, then the widget, then the property map', () => {
            const generator = make('Column', { ynumberformat: 'Thousand' });
            expect(generator({ data: { x: 'A', y: 1500 }, color: 'c' }, {})).toContain('1.5K');
            expect(generator({ data: { x: 'A', y: 2000000 }, color: 'c' }, { ynumberformat: 'Million' })).toContain('2M');
        });
    });

    describe('initChart', () => {
        const baseMap = (extra: any = {}) => ({
            theme: 'Terrestrial', showxaxis: true, showyaxis: true, showlegend: 'top', offsettop: 1, offsetright: 2,
            offsetbottom: 3, offsetleft: 4, tooltips: true, ...extra
        });

        const build = (ctx: any, map: any = {}, x?: any, y?: any, preview = false) => {
            const widgetContext = { xaxisdatakey: 'xKey', yaxisdatakey: 'yKey', xDataKeyArr: ['a', 'b', 'c'], ...ctx };
            const chart = utils.initChart(widgetContext, x, y, baseMap(map), preview);
            return { chart, widgetContext };
        };

        it.each([
            ['Column', 'multiBarChart'],
            ['Cumulative Line', 'cumulativeLineChart'],
            ['Line', 'lineChart'],
            ['Area', 'stackedAreaChart'],
            ['Bar', 'multiBarHorizontalChart'],
            ['Pie', 'pieChart'],
            ['Donut', 'pieChart'],
            ['Bubble', 'scatterChart']
        ])('creates the nvd3 model for %s', (type, model) => {
            build({ type });
            expect(modelCalls[0]).toBe(model);
        });

        it('cannot build charts of unknown types (the multi bar fallback is never reached)', () => {
            expect(() => build({ type: 'Custom' })).toThrow(TypeError);
            expect(modelCalls).toEqual([]);
        });

        it('stacks horizontal bars when requested', () => {
            build({ type: 'Bar' }, { viewtype: 'Stacked' });
            expect(lastArg(calls, 'stacked')).toBe(true);
        });

        it('configures bar spacing and stacked columns', () => {
            build({ type: 'Column' }, { barspacing: 'small', viewtype: 'Stacked', reducexticks: true });
            expect(lastArg(calls, 'groupSpacing')).toBe(0.3);
            expect(lastArg(calls, 'stacked')).toBe(true);
            calls.length = 0;
            build({ type: 'Bar' }, { viewtype: 'Grouped', showvalues: true });
            expect(lastArg(calls, 'groupSpacing')).toBe(0.5);
            expect(lastArg(calls, 'stacked')).toBe(false);
            expect(lastArg(calls, 'showValues')).toBe(true);
        });

        it('configures donut ratio, labels and the key-value label type', () => {
            build({ type: 'Donut' }, { donutratio: 'large', showlabels: 'outside', labeltype: 'key-value' });
            expect(lastArg(calls, 'donutRatio')).toBe(0.7);
            expect(lastArg(calls, 'donut')).toBe(true);
            expect(lastArg(calls, 'showLabels')).toBe(true);
            expect(lastArg(calls, 'labelsOutside')).toBe(true);
            const labelType = callsOf(calls, 'labelType').pop()![0];
            expect(labelType({ data: { x: 'a', y: 1 } })).toBe('a 1');
        });

        it('configures pie charts with percent or formatted values', () => {
            build({ type: 'Pie' }, { labeltype: 'percent', labelthreshold: 0.5 });
            expect(lastArg(calls, 'labelThreshold')).toBe(0.5);
            expect(lastArg(calls, 'valueFormat')(0.5)).toBe('50%');
            calls.length = 0;
            build({ type: 'Pie' }, { labeltype: 'value', ynumberformat: 'Thousand' });
            expect(lastArg(calls, 'valueFormat')(2000)).toBe('2K');
            expect(callsOf(calls, 'tooltip.contentGenerator')).toHaveLength(1);
        });

        it('sets x and y domains when the values are finite and ignores invalid ones', () => {
            build({ type: 'Column' }, {}, { min: { x: 2.5 }, max: { x: 9 } }, { min: [0, 1.5], max: [0, 8] });
            expect(lastArg(calls, 'xDomain')[1]).toBe(9);
            expect(lastArg(calls, 'xDomain')[0]).toBeCloseTo(2.4);
            expect(lastArg(calls, 'yDomain')[1]).toBe(8);
            calls.length = 0;
            build({ type: 'Column' }, {}, { min: ['a'], max: ['b'] }, { min: { y: 'a' }, max: { y: 'b' } });
            expect(callsOf(calls, 'xDomain')).toHaveLength(0);
            expect(callsOf(calls, 'yDomain')).toHaveLength(0);
        });

        it('applies axis labels, units, multiple y values and tooltip rules', () => {
            build({ type: 'Column', yaxisdatakey: 'a,b' }, { xaxislabel: 'X', yaxislabel: 'Y', xunits: 'kg', yunits: 'm' });
            expect(lastArg(calls, 'xAxis.axisLabel')).toBe('X(kg)');
            expect(lastArg(calls, 'yAxis.axisLabel')).toBe('Y(m)');
            expect(callsOf(calls, 'tooltip.contentGenerator')).toHaveLength(0);
            calls.length = 0;
            build({ type: 'Column', yaxisdatakey: 'a' }, {});
            expect(lastArg(calls, 'xAxis.axisLabel')).toBeDefined();
            expect(callsOf(calls, 'tooltip.contentGenerator')).toHaveLength(1);
            calls.length = 0;
            build({ type: 'Bubble', yaxisdatakey: 'a' }, {});
            expect(callsOf(calls, 'tooltip.contentGenerator')).toHaveLength(0);
        });

        it('falls back to default captions', () => {
            build({ type: 'Column', xaxisdatakey: undefined, yaxisdatakey: undefined }, {});
            expect(lastArg(calls, 'xAxis.axisLabel')).toBe('x caption');
            expect(lastArg(calls, 'yAxis.axisLabel')).toBe('y caption');
        });

        it('formats x ticks as dates for line charts (real data and preview)', () => {
            build({ type: 'Line' }, { xdateformat: '%Y' });
            expect(lastArg(calls, 'xAxis.tickFormat')(1)).toBe('%Y|date');
            calls.length = 0;
            build({ type: 'Line' }, {}, undefined, undefined, true);
            expect(lastArg(calls, 'xAxis.tickFormat')(1)).toBe('%x|date');
        });

        it('formats x ticks as dates for other charts, numbers, or axis keys', () => {
            build({ type: 'Column' }, { xdateformat: '%Y' });
            expect(lastArg(calls, 'xAxis.tickFormat')('2020-01-01')).toBe('%Y|date');
            calls.length = 0;
            build({ type: 'Column' }, { xnumberformat: 'Thousand' });
            expect(lastArg(calls, 'xAxis.tickFormat')(3000)).toBe('3K');
            calls.length = 0;
            build({ type: 'Area' }, {});
            expect(lastArg(calls, 'xAxis.tickFormat')(1)).toBe('b');
            calls.length = 0;
            build({ type: 'Column' }, {});
            expect(callsOf(calls, 'xAxis.tickFormat')).toHaveLength(0);
            build({ type: 'Bubble' }, {}, undefined, undefined, true);
            expect(callsOf(calls, 'xAxis.tickFormat')).toHaveLength(0);
        });

        it('formats y ticks and bar values', () => {
            build({ type: 'Bar' }, { ynumberformat: 'Thousand' });
            expect(lastArg(calls, 'yAxis.tickFormat')(2000)).toBe('2K');
            expect(lastArg(calls, 'valueFormat')(2000)).toBe('2K');
        });

        it('supports custom colors as strings, arrays or the theme', () => {
            build({ type: 'Column' }, { customcolors: '#111,#222' });
            expect(lastArg(calls, 'color')).toEqual(['#111', '#222']);
            build({ type: 'Column' }, { customcolors: ['#333'] });
            expect(lastArg(calls, 'color')).toEqual(['#333']);
            build({ type: 'Column' }, { customcolors: '' , theme: 'Azure' });
            expect(lastArg(calls, 'color')[0]).toBe('#3182bd');
        });

        it('sets legend, margins, tooltips and the no-data message', () => {
            const { widgetContext } = build({ type: 'Column' }, { legendtype: 'Classic', nodatamessage: 'Nothing', showlegend: 'hide' });
            expect(lastArg(calls, 'legend.vers')).toBe('classic');
            expect(lastArg(calls, 'showLegend')).toBe(false);
            expect(lastArg(calls, 'margin')).toEqual({ top: 1, right: 2, bottom: 3, left: 4 });
            expect(lastArg(calls, 'tooltip.enabled')).toBe(true);
            expect(widgetContext.message).toBe('Nothing');
            expect(lastArg(calls, 'noData')).toBe('Nothing');
            build({ type: 'Column' }, {});
            expect(lastArg(calls, 'legend.vers')).toBe('furious');
            expect(lastArg(calls, 'noData')).toBe('No data found');
        });

        it('re-plots highlighted points on state change for line type charts', () => {
            jest.useFakeTimers();
            build({ type: 'Line', highlightpoints: true, $id: '3' });
            const handler = callsOf(calls, 'dispatch.on').pop()![1];
            expect(callsOf(calls, 'dispatch.on').pop()![0]).toBe('stateChange');
            handler();
            jest.advanceTimersByTime(150);
            expect((global as any).d3.select).toHaveBeenCalledWith('#wmChart3 svg');
            calls.length = 0;
            build({ type: 'Line', highlightpoints: false });
            expect(callsOf(calls, 'dispatch.on')).toHaveLength(0);
            jest.useRealTimers();
        });

        it.each(['Column', 'Cumulative Line', 'Line', 'Area', 'Bar', 'Pie', 'Donut', 'Bubble'])('wires working accessors for %s charts', type => {
            build({ type }, { showlabels: 'inside' });
            const sample = { x: 1, y: 2, 0: 1, 1: 2, data: { x: 'a', y: 2 } };
            const accessors = calls.filter(c => ['x', 'y'].includes(c[0]));
            expect(accessors.length === 0 || accessors.every(c => typeof c[1][0] === 'function')).toBe(true);
            accessors.forEach(c => expect(() => c[1][0](sample)).not.toThrow());
        });

        it('moves the legend to the right for pie and donut charts', () => {
            build({ type: 'Pie', showlegend: 'right' });
            expect(lastArg(calls, 'legendPosition')).toBe('right');
            calls.length = 0;
            build({ type: 'Donut', showlegend: 'top' });
            expect(callsOf(calls, 'legendPosition')).toHaveLength(0);
            build({ type: 'Column', showlegend: 'right' });
            expect(callsOf(calls, 'legendPosition').filter(a => a[0] === 'right')).toHaveLength(0);
        });
    });
});
