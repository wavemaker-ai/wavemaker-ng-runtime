import * as api from './public_api';

describe('table public_api', () => {
    it('re-exports the table directives and components', () => {
        for (const name of ['TableComponent', 'TableFilterSortDirective', 'TableRowActionDirective', 'TableColumnGroupDirective']) {
            expect((api as any)[name]).toBeDefined();
        }
        expect(api.TableComponent.name).toBe('TableComponent');
        expect(api.TableFilterSortDirective.name).toBe('TableFilterSortDirective');
        expect(api.TableRowActionDirective.name).toBe('TableRowActionDirective');
    });
});
