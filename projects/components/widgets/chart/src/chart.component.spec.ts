import { Component, ViewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DatePipe } from '@angular/common';
import { AbstractI18nService, App, AppDefaults, DataSource } from '@wm/core';
import { ImagePipe, ToDatePipe } from '@wm/components/base';
import { MockAbstractI18nService } from 'projects/components/base/src/test/util/date-test-util';
import { compileTestComponent } from 'projects/components/base/src/test/util/component-test-util';
import { ChartComponent } from './chart.component';

declare const $;

type Call = [string, any[]];

// chainable stand-in for d3 selections / nvd3 charts: every method records its call and returns the node
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

@Component({
    standalone: false,
    template: `<div wmChart name="chart1" type="Column" xaxisdatakey="x" yaxisdatakey="y"></div>`
})
class HostComponent {
    @ViewChild(ChartComponent, { static: true }) wmComponent: ChartComponent;
}

@Component({
    standalone: false,
    template: `<div wmChart name="chart2" type="Column" dataset.bind="Variables.v.dataSet"></div>`
})
class BoundHostComponent {
    @ViewChild(ChartComponent, { static: true }) wmComponent: ChartComponent;
}

describe('ChartComponent', () => {
    let calls: Call[];
    let appHandlers: Record<string, Function>;
    let app: any;
    let d3Overrides: Record<string, any>;
    let addGraphCallbacks: Function[];
    let windowResizeFn: Function;
    let chart: any;
    let fixture: any;

    const callsOf = (name: string) => calls.filter(c => c[0] === name).map(c => c[1]);

    const setup = (host: any = HostComponent) => {
        fixture = compileTestComponent({
            imports: [ChartComponent],
            declarations: [host],
            providers: [
                { provide: App, useValue: app },
                { provide: AbstractI18nService, useClass: MockAbstractI18nService },
                { provide: AppDefaults, useClass: AppDefaults },
                DatePipe,
                ToDatePipe,
                ImagePipe
            ]
        }, host);
        fixture.detectChanges();
        chart = fixture.componentInstance.wmComponent;
        chart._plotChartProxy = jest.fn();
        return chart;
    };

    beforeEach(() => {
        jest.useFakeTimers();
        calls = [];
        appHandlers = {};
        d3Overrides = {};
        addGraphCallbacks = [];
        app = {
            subscribe: jest.fn((evt: string, fn: Function) => { appHandlers[evt] = fn; return jest.fn(); }),
            notify: jest.fn(),
            notifyApp: jest.fn(),
            isPrism: true,
            getSelectedLocale: () => 'en'
        };
        const chartModel = () => jest.fn(() => makeNode(calls, '', ['legend', 'tooltip', 'xAxis', 'yAxis', 'dispatch']));
        (global as any).nv = {
            models: {
                multiBarChart: chartModel(), cumulativeLineChart: chartModel(), lineChart: chartModel(),
                stackedAreaChart: chartModel(), multiBarHorizontalChart: chartModel(), pieChart: chartModel(), scatterChart: chartModel()
            },
            addGraph: jest.fn((build: Function, done: Function) => { build(); addGraphCallbacks.push(done); }),
            utils: { windowResize: jest.fn((fn: Function) => { windowResizeFn = fn; return { clear: jest.fn() }; }) }
        };
        (global as any).d3 = {
            format: jest.fn(() => (d: any) => String(d)),
            timeFormat: jest.fn(() => () => 'date'),
            select: jest.fn((sel: any) => (typeof sel === 'string' && d3Overrides[sel]) || makeNode(calls, `select(${typeof sel === 'string' ? sel : 'el'}).`)),
            selectAll: jest.fn((sel: string) => d3Overrides['all:' + sel] || makeNode(calls, `selectAll(${sel}).`))
        };
    });

    afterEach(() => {
        jest.runOnlyPendingTimers();
        jest.clearAllTimers();
        jest.useRealTimers();
        jest.restoreAllMocks();
        TestBed.resetTestingModule();
        delete (global as any).nv;
        delete (global as any).d3;
        document.body.innerHTML = '';
    });

    describe('configuration helpers', () => {
        it('detects group by, aggregation and data filtering', () => {
            const c = setup();
            c.groupby = 'none';
            expect(c.isGroupByEnabled()).toBe(false);
            c.groupby = 'a';
            expect(c.isGroupByEnabled()).toBe(true);
            c.aggregation = 'sum';
            c.aggregationcolumn = 'amount';
            expect(c.isAggregationEnabled()).toBe(true);
            expect(c.isDataFilteringEnabled()).toBe(true);
            c.aggregation = 'none';
            c.orderby = 'a:asc';
            c.isVisuallyGrouped = false;
            expect(c.isDataFilteringEnabled()).toBeTruthy();
            c.isVisuallyGrouped = true;
            expect(c.isDataFilteringEnabled()).toBeFalsy();
        });

        it('validates axes only for bound datasets', () => {
            const c = setup();
            c.binddataset = null;
            expect(c.isValidAxis()).toBe(true);
            c.binddataset = 'x';
            c.xaxisdatakey = 'a';
            c.yaxisdatakey = undefined;
            expect(c.isValidAxis()).toBeFalsy();
            c.yaxisdatakey = 'b';
            expect(c.isValidAxis()).toBe('b');
        });

        it('detects live variables', () => {
            const c = setup();
            c.datasource = { category: 'wm.LiveVariable' };
            expect(c.isLiveVariable).toBe(true);
            c.datasource = { category: 'wm.ServiceVariable' };
            expect(c.isLiveVariable).toBe(false);
            c.datasource = undefined;
            expect(c.isLiveVariable).toBeFalsy();
        });
    });

    describe('data helpers', () => {
        it('uses indexes for the x axis of line charts unless the values are dates or numbers', () => {
            const c = setup();
            c.type = 'Line';
            c.xDataKeyArr = [];
            const date = new Date();
            expect(c.getxAxisVal({ k: 'a' }, 'k', 3)).toBe(3);
            expect(c.getxAxisVal({ k: date }, 'k', 4)).toBe(date);
            expect(c.xDataKeyArr).toEqual(['a', date]);
            c.type = 'Column';
            expect(c.getxAxisVal({ k: 'z' }, 'k', 0)).toBe('z');
            c.type = 'Line';
            c.xAxisDataType = 'integer';
            expect(c.getxAxisVal({ k: 5 }, 'k', 0)).toBe(5);
        });

        it('computes x and y min/max values for object and array points', () => {
            const c = setup();
            expect(c.getXMinMaxValues(undefined)).toBeUndefined();
            expect(c.getYMinMaxValues(undefined)).toBeUndefined();
            const objects = { values: [{ x: 2, y: 5 }, { x: 1, y: 3 }, { x: 3, y: 9 }] };
            const x = c.getXMinMaxValues(objects);
            expect([x.min.x, x.max.x]).toEqual([1, 3]);
            const arrays = [{ values: [[1, 4], [2, 8]] }, { values: [[3, 2], [4, 6]] }];
            const y = c.getYMinMaxValues(arrays);
            expect([y.min[1], y.max[1]]).toEqual([2, 8]);
            const xa = c.getXMinMaxValues({ values: [[10, 1], [30, 2]] });
            expect([xa.min[0], xa.max[0]]).toEqual([10, 30]);
        });

        it('treats a single undefined value as no data', () => {
            const c = setup();
            expect(c.getValidData([undefined])).toEqual([]);
            expect(c.getValidData([1])).toEqual([1]);
            expect(c.getValidData([undefined, undefined])).toEqual([undefined, undefined]);
        });

        it('builds data points for every chart data format', () => {
            const c = setup();
            c.type = 'Column';
            expect(c.valueFinder({ a: 'A', b: '3.5' }, 'a', 'b', 0)).toEqual({ x: 'A', y: 3.5, _dataObj: { a: 'A', b: '3.5' } });
            c.type = 'Bubble';
            c.bubblesize = 'sz';
            const bubble = c.valueFinder({ a: 1, b: 2, sz: '7' }, 'a', 'b', 0, 'square');
            expect(bubble).toEqual(expect.objectContaining({ size: 7, shape: 'square' }));
            expect(c.valueFinder({ a: 1, b: 2 }, 'a', 'b', 0).size).toBe(2);
            expect(c.valueFinder({ a: 1, b: 2 }, 'a', 'b', 0).shape).toBe('circle');
            c.type = 'Area';
            c.xAxisDataType = 'integer';
            const point = c.valueFinder({ a: 1, b: 2 }, 'a', 'b', 0);
            expect(point[0]).toBe(1);
            expect(point[1]).toBe(2);
        });

        it('only reports errors when no data messages are enabled', () => {
            const c = setup();
            c.showNoDataMsg = false;
            c.setErrMsg('x');
            expect(c.invalidConfig).toBeUndefined();
            c.showNoDataMsg = true;
            c.setErrMsg('x');
            expect(c.showContentLoadError).toBe(true);
            expect(c.invalidConfig).toBe(true);
            expect(c.errMsg).toBe('');
        });

        it('stores and returns processed chart data', () => {
            const c = setup();
            c.setChartData(null);
            expect(c.getChartData()).toEqual([]);
            c.setChartData([1]);
            expect(c.getChartData()).toEqual([1]);
        });
    });

    describe('processChartData', () => {
        const bound = () => {
            const c = setup();
            c.binddataset = 'Variables.v';
            c.xaxisdatakey = 'name';
            c.yaxisdatakey = 'a,b';
            return c;
        };

        it('returns sample data when the dataset is not bound', () => {
            const c = setup();
            c.binddataset = null;
            c.type = 'Column';
            expect(c.processChartData()).toHaveLength(1);
            expect(c.xDataKeyArr).toHaveLength(3);
        });

        it('returns no data for empty datasets', () => {
            const c = bound();
            c.chartData = [];
            expect(c.processChartData()).toEqual([]);
            c.chartData = undefined;
            expect(c.processChartData()).toEqual([]);
        });

        it('builds one series per y axis key', () => {
            const c = bound();
            c.type = 'Column';
            c.chartData = [{ name: 'n1', a: 1, b: 2 }, {}, { name: 'n2', a: 3, b: 4 }];
            const data = c.processChartData();
            expect(data).toHaveLength(2);
            expect(data[0].key).toBe('A');
            expect(data[0].values).toHaveLength(3);
        });

        it('builds pie data from the first y axis key', () => {
            const c = bound();
            c.type = 'Pie';
            c.chartData = [{ name: 'n1', a: 1 }, {}];
            const data = c.processChartData();
            expect(data[0].x).toBe('n1');
            c.chartData = [{}];
            expect(c.processChartData()).toEqual([]);
        });

        it('assigns bubble shapes per series', () => {
            const c = bound();
            c.type = 'Bubble';
            c.shape = 'random';
            c.chartData = [{ name: 1, a: 1, b: 2 }];
            const random = c.processChartData();
            expect(random[0].values[0].shape).toBe('circle');
            expect(random[1].values[0].shape).toBe('square');
            c.shape = 'diamond';
            expect(c.processChartData()[0].values[0].shape).toBe('diamond');
        });

        it('ignores non-array datasets', () => {
            const c = bound();
            c.chartData = { not: 'array' };
            expect(c.processChartData()).toEqual([]);
        });

        it('handles a missing y axis key', () => {
            const c = bound();
            c.yaxisdatakey = undefined;
            c.chartData = [{ name: 'n' }];
            expect(c.processChartData()).toEqual([]);
        });
    });

    describe('grouping', () => {
        it('groups and orders query results into visual series', () => {
            const c = setup();
            c.type = 'Column';
            c.xaxisdatakey = 'x';
            c.yaxisdatakey = 'y';
            c.groupby = 'g';
            c.orderby = 'x:desc';
            const out = c.getVisuallyGroupedData([{ g: 'A', x: 1, y: 2 }, { g: 'B', x: 2, y: 3 }, { g: 'A', x: 3, y: 4 }], 'g');
            expect(out.map(s => s.key)).toEqual(['A', 'B']);
            expect(out[0].values).toHaveLength(2);
        });

        it('supports unordered data and area charts', () => {
            const c = setup();
            c.type = 'Area';
            c.xaxisdatakey = 'x';
            c.yaxisdatakey = 'y';
            c.groupby = 'g';
            c.orderby = undefined;
            const out = c.getVisuallyGroupedData([{ g: 'A', x: 1, y: 2 }, { g: 'B', x: 2, y: 3 }], 'g');
            expect(out).toHaveLength(2);
        });

        it('only pads series with zero points for area charts', () => {
            const rows = [{ g: 'A', x: 1, y: 2 }, { g: 'A', x: 2, y: 3 }, { g: 'B', x: 1, y: 4 }];
            const c = setup();
            c.xaxisdatakey = 'x';
            c.yaxisdatakey = 'y';
            c.groupby = 'g';
            c.orderby = undefined;
            c.type = 'Column';
            expect(c.getVisuallyGroupedData(rows, 'g').map(s => s.values.length)).toEqual([2, 1]);
            c.type = 'Area';
            expect(c.getVisuallyGroupedData(rows, 'g').map(s => s.values.length)).toEqual([2, 2]);
        });

        it('returns an empty grouping when group by is disabled or aggregation is enabled', () => {
            const c = setup();
            c.groupby = 'none';
            expect(c.getGroupingDetails()).toEqual({ expression: '', isVisuallyGrouped: false, visualGroupingColumn: '' });
            c.groupby = 'a';
            c.aggregation = 'sum';
            c.aggregationcolumn = 'amt';
            expect(c.getGroupingDetails().expression).toBe('');
        });

        it('finds the visual grouping column and builds the group by expression', () => {
            const c = setup();
            c.xaxisdatakey = 'x';
            c.yaxisdatakey = 'y1,y2';
            c.aggregation = 'none';
            c.aggregationcolumn = undefined;
            c.groupby = 'x,y1,cat';
            const details = c.getGroupingDetails();
            expect(details.isVisuallyGrouped).toBe(true);
            expect(details.visualGroupingColumn).toBe('cat');
            expect(details.expression).toBe('cat,x,y1,x,y1,y2');
            expect(c.isVisuallyGrouped).toBe(true);
        });

        it('is not visually grouped when all group columns are axis columns', () => {
            const c = setup();
            c.xaxisdatakey = 'x';
            c.yaxisdatakey = 'y';
            c.aggregation = 'none';
            c.groupby = 'x,y';
            const details = c.getGroupingDetails();
            expect(details.isVisuallyGrouped).toBe(false);
            expect(details.visualGroupingColumn).toBeUndefined();
        });

        it('skips the aggregation column in the grouping expression', () => {
            const c = setup();
            c.xaxisdatakey = 'x';
            c.yaxisdatakey = 'y';
            c.aggregation = 'none';
            c.aggregationcolumn = 'x';
            c.groupby = 'x';
            expect(c.getGroupingDetails().expression).toBe('y');
            c.aggregationcolumn = 'y';
            c.yaxisdatakey = undefined;
            expect(c.getGroupingDetails().expression).toBe('x');
        });
    });

    describe('getAggregatedData', () => {
        const withVariable = (response: any, ok = true) => {
            const c = setup();
            c.xaxisdatakey = 'cat.name';
            c.yaxisdatakey = 'amt';
            c.groupby = 'cat.name';
            c.aggregation = 'sum';
            c.aggregationcolumn = 'amt';
            c.orderby = 'cat.name:asc';
            c.datasource = { execute: jest.fn(() => (ok ? Promise.resolve(response) : Promise.reject('x'))) };
            return c;
        };

        it('does nothing without a datasource', () => {
            const c = setup();
            c.datasource = undefined;
            expect(c.getAggregatedData(jest.fn())).toBeUndefined();
        });

        it('executes the aggregation with aliases and maps the response', async () => {
            const c = withVariable({ body: { content: [{ cat$name: 'A', amt: 5 }, { 'cat.name': 'B', amt$: 6 }] } });
            const cb = jest.fn();
            c.getAggregatedData(cb);
            const [name, args] = c.datasource.execute.mock.calls[0];
            expect(name).toBe('getAggregatedData');
            expect(args.aggregations).toEqual({
                groupByFields: ['cat.name'],
                aggregations: [{ field: 'amt', type: 'SUM', alias: 'amt' }]
            });
            expect(args.sort).toContain('cat$name asc');
            await Promise.resolve();
            await Promise.resolve();
            expect(c.chartData).toEqual([{ amt: 5, 'cat.name': 'A' }, { amt: undefined, 'cat.name': 'B' }]);
            expect(cb).toHaveBeenCalled();
        });

        it('queries without aggregation, grouping or sorting when disabled', async () => {
            const c = setup();
            c.groupby = 'none';
            c.orderby = undefined;
            c.aggregation = 'none';
            c.yaxisdatakey = undefined;
            c.datasource = { execute: jest.fn(() => Promise.resolve({ body: { content: [{ x: 1 }] } })) };
            c.xaxisdatakey = 'x';
            c.getAggregatedData(jest.fn());
            expect(c.datasource.execute.mock.calls[0][1]).toEqual({ aggregations: {}, sort: undefined });
            await Promise.resolve();
            await Promise.resolve();
            expect(c.chartData).toEqual([{ x: 1 }]);
        });

        it('records a fetch error and still calls back', async () => {
            const c = withVariable(null, false);
            c.showNoDataMsg = true;
            const cb = jest.fn();
            c.getAggregatedData(cb);
            await Promise.resolve();
            await Promise.resolve();
            expect(c.chartData).toEqual([]);
            expect(c.invalidConfig).toBe(true);
            expect(cb).toHaveBeenCalled();
        });
    });

    describe('default columns and options', () => {
        const columns = (list: any[]) => ({ execute: jest.fn((op: any) => (op === DataSource.Operation.GET_PROPERTIES_MAP ? list : undefined)) });

        it('picks a string column for x and numeric columns for y', () => {
            const c = setup();
            c.datasource = columns([
                { fieldName: 'id', type: 'integer' },
                { fieldName: 'name', type: 'string' },
                { fieldName: 'rel', type: 'integer', isRelated: true },
                { fieldName: 'amt', type: 'double' }
            ]);
            c.type = 'Column';
            expect(c.getDefaultColumns().slice(0, 2)).toEqual(['name', 'id']);
            c.type = 'Bubble';
            expect(c.getDefaultColumns().slice(0, 2)).toEqual(['id', 'amt']);
            c.datasource = columns(undefined as any);
            expect(c.getDefaultColumns()).toEqual([]);
        });

        it('sets default axis options with fallbacks', () => {
            const c = setup();
            c.datasource = columns([{ fieldName: 'name', type: 'string' }, { fieldName: 'n', type: 'integer' }]);
            c.type = 'Column';
            c.setDefaultAxisOptions();
            expect([c.xaxisdatakey, c.yaxisdatakey]).toEqual(['name', 'n']);
            c.datasource = columns([]);
            c.setDefaultAxisOptions();
            expect([c.xaxisdatakey, c.yaxisdatakey]).toEqual([null, null]);
        });

        it('customises the available options per property', () => {
            const c = setup();
            c.binddataset = null;
            expect(c.getCutomizedOptions('xaxisdatakey', ['f'])).toEqual(['f']);
            c.binddataset = 'v';
            c.numericColumns = ['n1'];
            c.nonPrimaryColumns = ['np'];
            c.groupby = 'g1,g2';
            c.aggregationcolumn = 'amt';
            c.aggregation = 'sum';
            c.datasource = { category: 'wm.LiveVariable' };

            expect(c.getCutomizedOptions('xaxisdatakey', ['f'])).toEqual(['g1', 'g2']);
            expect(c.getCutomizedOptions('yaxisdatakey', ['f'])).toEqual(['amt']);
            expect(c.getCutomizedOptions('groupby', ['f'])).toEqual(['np']);
            expect(c.getCutomizedOptions('aggregationcolumn', ['f'])).toEqual(['n1']);
            expect(c.getCutomizedOptions('orderby', ['f'])).toEqual(['g1', 'g2', 'amt']);
            expect(c.getCutomizedOptions('bubblesize', ['f'])).toEqual(['n1']);
            expect(c.getCutomizedOptions('unknown', ['f'])).toEqual(['f']);

            c.aggregation = 'count';
            expect(c.getCutomizedOptions('aggregationcolumn', ['f'])).toEqual(['f']);
            c.aggregation = 'none';
            expect(c.getCutomizedOptions('yaxisdatakey', ['f'])).toEqual(['n1']);
            c.groupby = 'none';
            expect(c.getCutomizedOptions('xaxisdatakey', ['f'])).toEqual(['f']);
            c.numericColumns = [];
            c.nonPrimaryColumns = [];
            expect(c.getCutomizedOptions('bubblesize', undefined)).toEqual(['f']);
            c.datasource = { category: 'x' };
            expect(c.getCutomizedOptions('yaxisdatakey', ['z'])).toEqual(['z']);
            expect(c.getCutomizedOptions('groupby', ['z'])).toEqual(['z']);
            expect(c.getCutomizedOptions('orderby', ['z'])).toEqual(['z']);
        });

        it('resets numeric and non primary columns', () => {
            const c = setup();
            c.dataset = { a: 1 };
            c.datasource = { execute: jest.fn(() => ({ a: { type: 'integer' } })) };
            c.setNumericandNonPrimaryColumns();
            expect(c.numericColumns).toEqual([]);
            expect(c.nonPrimaryColumns).toEqual([]);
            c.dataset = undefined;
            c.setNumericandNonPrimaryColumns();
            expect(c.numericColumns).toEqual([]);
        });
    });

    describe('label sizing', () => {
        const build = (opts: { bar?: boolean; transform?: string; opacity?: string; text?: string; wrapper?: boolean } = {}) => {
            const c = setup();
            c.type = opts.bar ? 'Bar' : 'Column';
            c.chartData = [1, 2, 3, 4];
            const id = c.$id;
            document.body.innerHTML = `
                <div id="wmChart${id}">
                  <svg>
                    <g class="nv-wrap"><g><g class="nv-barsWrap"></g><g class="nv-y"></g></g></g>
                    <g class="nv-x">
                      <g class="tick" transform="translate(10,0)"><text style="opacity:1">${opts.text ?? 'A long label text'}</text></g>
                      <g class="tick" transform="translate(${opts.transform ?? '40,0'})"><text style="opacity:${opts.opacity ?? '1'}">Second label</text></g>
                    </g>
                  </svg>
                </div>`;
            const rect = (w: number, h: number) => ({ width: w, height: h });
            const svg = document.querySelector('svg') as any;
            svg.getBoundingClientRect = () => rect(400, 200);
            if (opts.wrapper !== false) {
                (document.querySelector('.nv-barsWrap') as any).getBoundingClientRect = () => rect(300, 100);
                (document.querySelector('.nv-y') as any).getBoundingClientRect = () => rect(50, 100);
            }
            return c;
        };

        it('truncates long labels for non-bar charts', () => {
            const c = build();
            c.fontsize = '10';
            c.setLabelsMaxWidth();
            const texts = Array.from(document.querySelectorAll('.nv-x text')).map(t => t.textContent);
            expect(texts.some(t => t!.endsWith('...'))).toBe(true);
        });

        it('uses the vertical distance for bar charts, hides surplus labels and truncates', () => {
            const c = build({ bar: true, transform: '0,5' });
            c.chartData = new Array(40).fill(1);
            c.fontsize = '12';
            c.setLabelsMaxWidth();
            const each = calls.filter(call => call[0].endsWith('.each')).pop();
            expect(each).toBeDefined();
            const el = document.createElement('text');
            each![1][0].call(el, null, 1);
            each![1][0].call(el, null, 0);
            expect(calls.some(call => call[0].endsWith('.attr') && call[1][0] === 'opacity')).toBe(true);
        });

        it('handles missing bar wrappers, hidden ticks and the default font size', () => {
            const c = build({ bar: true, wrapper: false, opacity: '0' });
            c.fontsize = undefined;
            expect(() => c.setLabelsMaxWidth()).not.toThrow();
        });

        it('handles non-bar charts with hidden ticks', () => {
            const c = build({ opacity: '0', transform: '0,30' });
            expect(() => c.setLabelsMaxWidth()).not.toThrow();
        });

        it('keeps labels intact when they fit', () => {
            const c = build({ text: 'ab' });
            c.fontsize = '1';
            c.setLabelsMaxWidth();
            expect(document.querySelector('.nv-x text')!.textContent).toBe('ab');
        });
    });

    describe('click events', () => {
        it.each([
            ['Column', { _dataObj: 'col' }, 'col'],
            ['Bar', { _dataObj: 'bar' }, 'bar'],
            ['Pie', { data: { _dataObj: 'pie' } }, 'pie'],
            ['Donut', { data: { _dataObj: 'donut' } }, 'donut'],
            ['Area', [{ _dataObj: 'area' }], 'area'],
            ['Cumulative Line', [{ _dataObj: 'cl' }], 'cl'],
            ['Line', [{ _dataObj: 'line' }], 'line'],
            ['Bubble', 'bubble', 'bubble'],
            ['Unknown', 'x', undefined]
        ])('selects the data object of a %s click', (type, data, expected) => {
            const c = setup();
            c.type = type;
            const select = jest.spyOn(c, 'invokeEventCallback').mockImplementation(() => {});
            c.attachClickEvent();
            const handler = calls.filter(call => call[0].endsWith('.on')).pop()![1][1];
            handler('evt', data, 0);
            expect(c.selecteditem).toBe(expected);
            expect(select).toHaveBeenCalledWith('select', { $event: 'evt', selectedChartItem: data, selectedItem: expected });
        });
    });

    describe('post plot processing', () => {
        it('limits label widths for regular charts and registers a resize handler', () => {
            const c = setup();
            c.type = 'Column';
            c.fontunit = 'px';
            c.fontsize = '12';
            const labels = jest.spyOn(c, 'setLabelsMaxWidth').mockImplementation(() => {});
            const chartObj = { update: jest.fn() };
            jest.spyOn(c.$element[0], 'getBoundingClientRect').mockReturnValue({ height: 0 } as any);
            c.postPlotProcess(chartObj);
            expect(labels).toHaveBeenCalledTimes(1);
            expect((global as any).nv.utils.windowResize).toHaveBeenCalled();

            // hidden chart: nothing happens on resize
            windowResizeFn();
            expect(chartObj.update).not.toHaveBeenCalled();

            // visible chart: updates and re-processes
            (c.$element[0].getBoundingClientRect as jest.Mock).mockReturnValue({ height: 50 });
            windowResizeFn();
            expect(chartObj.update).toHaveBeenCalled();
            expect(labels).toHaveBeenCalledTimes(2);

            // pie charts do not recompute label widths on resize
            c.type = 'Pie';
            windowResizeFn();
            expect(labels).toHaveBeenCalledTimes(2);

            // a second pass clears the previous resize handler
            c.postPlotProcess(chartObj);
        });

        it('rotates pie labels when they are drawn inside', () => {
            const c = setup();
            c.type = 'Pie';
            c.showlabelsoutside = false;
            const group = [[document.createElement('div')]];
            (group[0][0] as HTMLElement).innerHTML = '<text></text>';
            const pieGroups: any = [1];
            pieGroups.length = 1;
            pieGroups.each = (fn: Function) => fn.call(document.createElement('g'));
            const pieLabels: any = { each: (fn: Function) => fn.call(document.createElement('g'), null, 0) };
            const svgNode = {
                select: (sel: string) => ({ selectAll: () => (sel === '.nv-pieLabels' ? pieLabels : pieGroups) }),
                selectAll: () => ({ empty: () => true })
            };
            d3Overrides['#wmChart' + c.$id + ' svg'] = svgNode;
            (global as any).d3.select = jest.fn((sel: any) => {
                if (typeof sel === 'string') { return d3Overrides[sel] || makeNode(calls); }
                // d3.select(this) inside the each callbacks
                const node: any = {
                    attr: (name: string, fn?: any) => { if (typeof fn === 'function') { fn({ startAngle: 0, endAngle: 3 }); fn({ startAngle: 0, endAngle: 7 }); } return node; },
                    0: group[0]
                };
                return node;
            });
            expect(() => c.postPlotProcess({ update: jest.fn() })).not.toThrow();
            // the label of the first slice is rotated by the computed angle
            expect($(group[0][0]).find('text').attr('transform')).toMatch(/^rotate\(/);
        });

        it('skips rotation when pie labels are outside or there are no slices', () => {
            const c = setup();
            c.type = 'Donut';
            c.showlabelsoutside = true;
            expect(() => c.postPlotProcess({ update: jest.fn() })).not.toThrow();
            c.showlabelsoutside = false;
            d3Overrides['#wmChart' + c.$id + ' svg'] = { select: () => ({ selectAll: () => ({ length: 0 }) }), selectAll: () => ({ empty: () => true }) };
            expect(() => c.postPlotProcess({ update: jest.fn() })).not.toThrow();
        });

        it('applies the text styles when text elements exist', () => {
            const c = setup();
            c.type = 'Column';
            c.fontsize = '10';
            c.fontunit = 'px';
            const style = jest.fn();
            d3Overrides['#wmChart' + c.$id + ' svg'] = { selectAll: () => ({ empty: () => false, style }) };
            jest.spyOn(c, 'setLabelsMaxWidth').mockImplementation(() => {});
            c.postPlotProcess({ update: jest.fn() });
            expect(style).toHaveBeenCalledWith(expect.objectContaining({ 'font-size': '10px' }));
        });
    });

    describe('configureChart', () => {
        beforeEach(() => setup());

        it('computes domains for bound and sample data and renders the chart', () => {
            chart.type = 'Column';
            chart.binddataset = 'Variables.v';
            chart.xdomain = 'Min';
            chart.ydomain = 'Min';
            chart._processedData = [{ values: [{ x: 1, y: 2 }, { x: 3, y: 4 }] }];
            jest.spyOn(chart, 'postPlotProcess').mockImplementation(() => {});
            expect(chart.configureChart()).toBeDefined();
            expect(callsOf('xDomain').length + callsOf('yDomain').length).toBeGreaterThan(0);
            expect(callsOf('select(#wmChart' + chart.$id + ' svg).datum')).toHaveLength(1);

            calls.length = 0;
            chart.binddataset = null;
            chart.configureChart();
            expect(callsOf('xDomain')[0][0]).toEqual([0, 5]);
        });

        it('clones sample data for pie charts and uses the beforerender result', () => {
            chart.type = 'Pie';
            chart.binddataset = null;
            chart._processedData = [{ x: 1, y: 2 }];
            const replacement = makeNode(calls);
            jest.spyOn(chart, 'invokeEventCallback').mockReturnValue(replacement);
            jest.spyOn(chart, 'postPlotProcess').mockImplementation(() => {});
            expect(chart.configureChart()).toBe(replacement);
            expect(chart.chart).toBe(replacement);
        });

        it('removes stale x axis ticks', () => {
            chart.type = 'Column';
            document.body.innerHTML = `<div id="wmChart${chart.$id}"><svg><g class="nv-x"><g class="tick"></g></g></svg></div>`;
            jest.spyOn(chart, 'postPlotProcess').mockImplementation(() => {});
            chart.configureChart();
            expect(document.querySelectorAll('g.tick')).toHaveLength(0);
        });

        it('does nothing for non-array data', () => {
            chart.type = 'Column';
            chart._processedData = {} as any;
            expect(chart.configureChart()).toBeUndefined();
        });
    });

    describe('plotChart / plotChartProxy', () => {
        beforeEach(() => {
            setup();
            jest.spyOn(chart.$element[0], 'getBoundingClientRect').mockReturnValue({ height: 100 } as any);
            jest.spyOn(chart, 'configureChart').mockImplementation(() => ({}));
        });

        it('stops when the container has no height', () => {
            (chart.$element[0].getBoundingClientRect as jest.Mock).mockReturnValue({ height: 0 });
            chart.plotChart();
            expect((global as any).nv.addGraph).not.toHaveBeenCalled();
        });

        it('plots, attaches click handlers later and clears the loading flag', () => {
            const attach = jest.spyOn(chart, 'attachClickEvent').mockImplementation(() => {});
            chart.isLoadInProgress = true;
            chart.plotChart();
            expect(chart.isLoadInProgress).toBe(false);
            addGraphCallbacks[0]();
            jest.advanceTimersByTime(700);
            expect(attach).toHaveBeenCalled();
        });

        it('uses transformed data and visually grouped data', () => {
            jest.spyOn(chart, 'invokeEventCallback').mockReturnValue([{ t: 1 }]);
            chart.type = 'Column';
            chart.isVisuallyGrouped = true;
            chart.plotChart();
            expect(chart._processedData).toEqual([{ t: 1 }]);
            expect(chart.chartData).toEqual([{ t: 1 }]);
            chart.isVisuallyGrouped = false;
            chart.binddataset = null;
            chart.plotChart();
            expect(chart._processedData.length).toBeGreaterThan(0);
        });

        it('resets the svg when the canvas must be cleared and blanks invalid axes', () => {
            chart.clearCanvas = true;
            chart.binddataset = 'v';
            chart.xaxisdatakey = undefined;
            chart.chartData = [{ a: 1 }];
            const replace = jest.spyOn($.fn, 'replaceWith');
            chart.plotChart();
            expect(replace).toHaveBeenCalledWith('<svg></svg>');
            expect(chart.clearCanvas).toBe(false);
            expect(chart._processedData).toEqual([]);
        });

        describe('plotChartProxy', () => {
            it('plots directly for non live data', () => {
                const plot = jest.spyOn(chart, 'plotChart').mockImplementation(() => {});
                chart.datasource = { category: 'wm.ServiceVariable' };
                chart.plotChartProxy();
                expect(chart.isLoadInProgress).toBe(true);
                expect(plot).toHaveBeenCalled();
            });

            it('uses the aggregated data query for live variables with data filtering', () => {
                const plot = jest.spyOn(chart, 'plotChart').mockImplementation(() => {});
                const agg = jest.spyOn(chart, 'getAggregatedData').mockImplementation((cb: any) => cb());
                chart.binddataset = 'v';
                chart.datasource = { category: 'wm.LiveVariable' };
                chart.filterFields = { a: 1 };
                chart.plotChartProxy();
                expect(agg).toHaveBeenCalled();
                expect(plot).toHaveBeenCalled();
            });

            it('resets live variable data to the full dataset and groups it visually', () => {
                const plot = jest.spyOn(chart, 'plotChart').mockImplementation(() => {});
                const grouped = jest.spyOn(chart, 'getVisuallyGroupedData').mockReturnValue(['grouped'] as any);
                chart.binddataset = 'v';
                chart.datasource = { category: 'wm.LiveVariable' };
                chart.filterFields = undefined;
                chart.dataset = [{ a: 1 }];
                chart.xaxisdatakey = 'x';
                chart.yaxisdatakey = 'y';
                chart.aggregation = 'none';
                chart.groupby = 'x,y,cat';
                chart.plotChartProxy();
                expect(grouped).toHaveBeenCalled();
                expect(chart.chartData).toEqual(['grouped']);
                expect(plot).toHaveBeenCalled();

                grouped.mockClear();
                chart.groupby = 'none';
                chart.plotChartProxy();
                expect(grouped).not.toHaveBeenCalled();
                expect(chart.chartData).toEqual([{ a: 1 }]);
            });
        });
    });

    describe('handleDataSet', () => {
        beforeEach(() => setup());

        it('resets grouping state when the binding is removed', () => {
            chart.binddataset = null;
            chart.isVisuallyGrouped = true;
            chart.handleDataSet(undefined);
            expect(chart.isVisuallyGrouped).toBe(false);
            expect(chart.axisoptions).toBeNull();
            expect(chart._plotChartProxy).not.toHaveBeenCalled();
        });

        it('wraps object data and plots', () => {
            chart.datasource = { category: 'wm.ServiceVariable' };
            chart.handleDataSet({ a: 1 });
            expect(chart.chartData).toEqual([{ a: 1 }]);
            expect(chart._plotChartProxy).toHaveBeenCalled();
        });

        it('keeps arrays and records filter fields', () => {
            chart.datasource = { category: 'wm.ServiceVariable' };
            const data: any = [{ a: 1 }];
            data.filterFields = { f: 1 };
            chart.handleDataSet(data);
            expect(chart.chartData).toBe(data);
            expect(chart.filterFields).toEqual({ f: 1 });
        });

        it('treats empty data values as no data and live variable null as empty', () => {
            chart.datasource = { category: 'wm.ServiceVariable' };
            chart.handleDataSet({ dataValue: '' });
            expect(chart.chartData).toBe('');
            expect(chart._plotChartProxy).not.toHaveBeenCalled();
            chart.datasource = { category: 'wm.LiveVariable' };
            chart.handleDataSet(null);
            expect(chart.chartData).toBe('');
        });
    });

    describe('donut center label', () => {
        it('writes and scales the centre label', () => {
            const c = setup();
            const textNode: any = {};
            const circle: any = { node: () => ({ getBoundingClientRect: () => ({ width: 130 }) }) };
            const scaleStore: Record<string, any> = {};
            const parentEl: any = {};
            const textThis: any = { parentElement: parentEl, getComputedTextLength: () => 50 };
            const makeText = () => {
                const t: any = {
                    attr: (name: string, v?: any) => { if (v === undefined) { return scaleStore[name]; } scaleStore[name] = v; return t; },
                    text: () => t,
                    style: (name: string, fn: Function) => { textNode.fontSize = fn.call({}); return t; },
                    each: (fn: Function) => { fn.call(textThis); return t; }
                };
                return t;
            };
            const pieGroups: any = { text: jest.fn(), append: jest.fn(() => makeText()) };
            d3Overrides['#wmChart' + c.$id + ' svg'] = { select: () => ({ select: () => pieGroups }) };
            (global as any).d3.select = jest.fn((sel: any) => {
                if (typeof sel === 'string') { return d3Overrides[sel]; }
                if (sel === parentEl) { return circle; }
                return makeText();
            });
            c.setDonutCenterLabel('Total');
            expect(pieGroups.text).toHaveBeenCalledWith('');
            expect(textNode.fontSize).toBeDefined();
        });
    });

    describe('onPropertyChange', () => {
        const prop = (key: string, nv: any, ov?: any) => chart.onPropertyChange(key, nv, ov);
        beforeEach(() => setup());

        it('delegates dataset changes', () => {
            const spy = jest.spyOn(chart, 'handleDataSet').mockImplementation(() => {});
            prop('dataset', [1]);
            expect(spy).toHaveBeenCalledWith([1]);
        });

        it('updates the center label of an existing chart', () => {
            const spy = jest.spyOn(chart, 'setDonutCenterLabel').mockImplementation(() => {});
            prop('centerlabel', 'x');
            expect(spy).not.toHaveBeenCalled();
            chart.chart = { title: jest.fn() };
            prop('centerlabel', 'x');
            expect(chart.chart.title).toHaveBeenCalledWith('x');
            expect(spy).toHaveBeenCalledWith('x');
        });

        it('adjusts margins and clears the canvas when the type changes', () => {
            chart.type = 'Pie';
            prop('type', 'Pie', 'Column');
            expect([chart.offsettop, chart.offsetright, chart.offsetbottom, chart.offsetleft]).toEqual([20, 0, 0, 0]);
            expect(chart.clearCanvas).toBe(true);
            chart.clearCanvas = false;
            chart.type = 'Column';
            prop('type', 'Column', 'Donut');
            expect([chart.offsettop, chart.offsetright, chart.offsetbottom, chart.offsetleft]).toEqual([25, 25, 55, 75]);
            chart.clearCanvas = false;
            prop('type', 'Column', 'Column');
            expect(chart.clearCanvas).toBe(false);
            prop('type', 'Bar', 'Line');
            expect(chart._plotChartProxy).toHaveBeenCalled();
        });

        it('re-plots for other properties, and again for advanced data properties', () => {
            prop('theme', 'Azure');
            expect(chart._plotChartProxy).toHaveBeenCalledTimes(1);
            chart._plotChartProxy.mockClear();
            prop('groupby', 'a');
            expect(chart._plotChartProxy).toHaveBeenCalledTimes(2);
        });
    });

    describe('events and styles', () => {
        beforeEach(() => setup());

        it('tracks the loading state of the bound variable only', () => {
            const identify = (id: string, apiAware = true) => ({
                execute: jest.fn((op: any) => (op === DataSource.Operation.IS_API_AWARE ? apiAware : id))
            });
            const variable = identify('other');
            chart.datasource = identify('mine');
            appHandlers['toggle-variable-state']({ variable: identify('mine'), active: true });
            expect(chart.isLoadInProgress).toBe(true);
            expect(chart.variableInflight).toBe(true);
            chart.isLoadInProgress = false;
            appHandlers['toggle-variable-state']({ variable, active: true });
            expect(chart.isLoadInProgress).toBe(false);
            chart.datasource = identify('mine', false);
            appHandlers['toggle-variable-state']({ variable: identify('mine'), active: true });
            expect(chart.isLoadInProgress).toBe(false);
            chart.datasource = undefined;
            appHandlers['toggle-variable-state']({ variable, active: true });
        });

        it('hides tooltips on scroll', () => {
            appHandlers['iscroll-start']();
            expect((global as any).d3.selectAll).toHaveBeenCalledWith('.nvtooltip');
        });

        it('applies text styles for font related style changes only', () => {
            const style = jest.fn();
            d3Overrides['#wmChart' + chart.$id + ' svg'] = { selectAll: () => ({ empty: () => false, style }) };
            chart.fontsize = '12';
            chart.fontunit = 'px';
            chart.onStyleChange('fontsize', 12, 10);
            expect(style).toHaveBeenLastCalledWith({ 'font-size': '12px' });
            chart.onStyleChange('color', 'red', 'blue');
            expect(style).toHaveBeenLastCalledWith({ fill: 'red' });
            style.mockClear();
            chart.onStyleChange('width', '10px', '5px');
            expect(style).not.toHaveBeenCalled();
        });
    });

    describe('lifecycle', () => {
        it('normalises old label settings, defaults the theme and plots sample data', () => {
            const c = setup();
            c.showlabels = 'true';
            c.showlabelsoutside = 'true';
            c.theme = undefined;
            c.type = 'Pie';
            c.ngAfterViewInit();
            expect(c.showlabels).toBe('outside');
            expect(c.theme).toBe('Azure');
            expect(c.nativeElement.getAttribute('id')).toBe('wmChart' + c.$id);
            expect(c._plotChartProxy).toHaveBeenCalled();

            c.showlabels = false;
            c.theme = undefined;
            c.type = 'Column';
            c.ngAfterViewInit();
            expect(c.showlabels).toBe('hide');
            expect(c.theme).toBe('Terrestrial');

            c.showlabels = 'true';
            c.showlabelsoutside = 'false';
            c.ngAfterViewInit();
            expect(c.showlabels).toBe('inside');

            c.showlabels = 'weird';
            c.showlabelsoutside = 'weird';
            c.theme = 'Azure';
            c.ngAfterViewInit();
            expect(c.showlabels).toBe('outside');
        });

        it('does not plot sample data for bound or scoped datasets', () => {
            const c = setup(BoundHostComponent);
            expect(c.binddataset).toBeTruthy();
            c._plotChartProxy.mockClear();
            c.ngAfterViewInit();
            expect(c._plotChartProxy).not.toHaveBeenCalled();
        });

        it('does not plot sample data for scoped datasets', () => {
            const c = setup();
            c.nativeElement.setAttribute('scopedataset', 'x');
            c._plotChartProxy.mockClear();
            c.ngAfterViewInit();
            expect(c._plotChartProxy).not.toHaveBeenCalled();
        });

        it('releases subscriptions and data on destroy', () => {
            const c = setup();
            const off = jest.fn();
            c._subsciptions = [off];
            c.chart = {};
            c._resizeFn = {};
            c.chartData = [1];
            fixture.destroy();
            expect(off).toHaveBeenCalled();
            expect(c.chart).toBeNull();
            expect(c._resizeFn).toBeNull();
            expect(c.chartData).toEqual([]);
        });

        it('is safe to destroy twice without subscriptions', () => {
            const c = setup();
            c._subsciptions = undefined;
            c.chart = null;
            c._resizeFn = null;
            expect(() => c.ngOnDestroy()).not.toThrow();
        });

        it('redraw re-plots through the debounced proxy', () => {
            const c = setup();
            const spy = jest.spyOn(c, 'plotChartProxy').mockImplementation(() => {});
            c.redraw();
            expect(typeof c.redraw).toBe('function');
            expect(spy).not.toBe(undefined);
        });
    });

    describe('leftover branches', () => {
        it('returns no data when the chart data is not an array', () => {
            const c = setup();
            c.binddataset = 'Variables.v.dataSet';
            c.chartData = 'abc';
            expect(c.processChartData()).toEqual([]);
        });

        it('keeps y columns that are not the aggregation column and skips the aggregated one', () => {
            const c = setup();
            c.xaxisdatakey = 'x';
            c.yaxisdatakey = 'y1,y2';
            c.aggregation = 'none';
            c.aggregationcolumn = 'y1';
            c.groupby = 'x,cat';
            expect(c.getGroupingDetails().expression).toBe('cat,x,x,y2');
        });

        it('reads ticks whose transform has no vertical part', () => {
            const c = setup();
            c.type = 'Column';
            c.chartData = [1];
            document.body.innerHTML = `
                <div id="wmChart${c.$id}"><svg><g class="nv-x">
                  <g class="tick" transform="translate(10)"><text style="opacity:1">A</text></g>
                  <g class="tick" transform="translate(40)"><text style="opacity:1">B</text></g>
                </g></svg></div>`;
            expect(() => c.setLabelsMaxWidth()).not.toThrow();
        });

        it('measures bar charts without bar or axis wrappers', () => {
            const c = setup();
            c.type = 'Bar';
            c.chartData = [1, 2];
            document.body.innerHTML = `
                <div id="wmChart${c.$id}"><svg><g class="nv-x">
                  <g class="tick" transform="translate(0,5)"><text style="opacity:1">A</text></g>
                  <g class="tick" transform="translate(0,9)"><text style="opacity:1">B</text></g>
                </g></svg></div>`;
            (document.querySelector('svg') as any).getBoundingClientRect = () => ({ width: 400, height: 200 });
            expect(() => c.setLabelsMaxWidth()).not.toThrow();
        });

        it('keeps the centre label size when it fits the ring', () => {
            const c = setup();
            const textNode: any = {};
            const circle: any = { node: () => ({ getBoundingClientRect: () => ({ width: 80 }) }) };
            const scaleStore: Record<string, any> = {};
            const parentEl: any = {};
            const textThis: any = { parentElement: parentEl, getComputedTextLength: () => 50 };
            const makeText = () => {
                const t: any = {
                    attr: (name: string, v?: any) => { if (v === undefined) { return scaleStore[name]; } scaleStore[name] = v; return t; },
                    text: () => t,
                    style: (name: string, fn: Function) => { textNode.fontSize = fn.call({}); return t; },
                    each: (fn: Function) => { fn.call(textThis); return t; }
                };
                return t;
            };
            const pieGroups: any = { text: jest.fn(), append: jest.fn(() => makeText()) };
            d3Overrides['#wmChart' + c.$id + ' svg'] = { select: () => ({ select: () => pieGroups }) };
            (global as any).d3.select = jest.fn((sel: any) => {
                if (typeof sel === 'string') { return d3Overrides[sel]; }
                if (sel === parentEl) { return circle; }
                return makeText();
            });
            c.setDonutCenterLabel('Total');
            expect(textNode.fontSize).toBe('16px');
        });

        it('clones the chart data for pie charts bound to a dataset without a scope dataset', () => {
            const c = setup();
            c.type = 'Pie';
            c.binddataset = 'Variables.v.dataSet';
            c.scopedataset = undefined;
            c._processedData = [{ key: 'a', y: 1 }];
            jest.spyOn(c, 'postPlotProcess').mockImplementation(() => {});
            expect(() => c.configureChart()).not.toThrow();
        });
    });
});
