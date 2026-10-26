import {
    CONSTANTS, VARIABLE_CONSTANTS, WS_CONSTANTS, MODE_CONSTANTS, DB_CONSTANTS,
    SWAGGER_CONSTANTS, VARIABLE_URLS, $rootScope,
} from './variables.constants';

describe('variables.constants', () => {
    it('should expose the expected variable category identifiers', () => {
        expect(VARIABLE_CONSTANTS.CATEGORY.MODEL).toBe('wm.Variable');
        expect(VARIABLE_CONSTANTS.CATEGORY.LIVE).toBe('wm.LiveVariable');
        expect(VARIABLE_CONSTANTS.CATEGORY.CRUD).toBe('wm.CrudVariable');
        expect(VARIABLE_CONSTANTS.CATEGORY.SERVICE).toBe('wm.ServiceVariable');
        expect(VARIABLE_CONSTANTS.CATEGORY.WEBSOCKET).toBe('wm.WebSocketVariable');
    });

    it('should map every EVENT constant to a value present in the EVENTS list (except onAbort)', () => {
        Object.values(VARIABLE_CONSTANTS.EVENT).forEach((eventName) => {
            if (eventName === 'onAbort') {
                return;
            }
            expect(VARIABLE_CONSTANTS.EVENTS).toContain(eventName);
        });
    });

    it('should default CONSTANTS to run mode, not studio mode', () => {
        expect(CONSTANTS.isRunMode).toBe(true);
        expect(CONSTANTS.isStudioMode).toBe(false);
    });

    it('should map DATABASE_MATCH_MODES entries to a query template in DATABASE_MATCH_MODES_WITH_QUERY', () => {
        Object.values(DB_CONSTANTS.DATABASE_MATCH_MODES).forEach((mode) => {
            expect(DB_CONSTANTS.DATABASE_MATCH_MODES_WITH_QUERY[mode]).toBeDefined();
        });
    });

    it('should expose the websocket non-body http methods', () => {
        expect(WS_CONSTANTS.NON_BODY_HTTP_METHODS).toEqual(['GET', 'HEAD']);
    });

    it('should expose the app-mode key used for theming', () => {
        expect(MODE_CONSTANTS.MODE_KEY).toBe('app-mode');
    });

    it('should expose swagger json param names', () => {
        expect(SWAGGER_CONSTANTS.WM_DATA_JSON).toBe('wm_data_json');
    });

    it('should expose the CRUD table data URLs with method and path', () => {
        expect(VARIABLE_URLS.DATABASE.readTableData.method).toBe('GET');
        expect(VARIABLE_URLS.DATABASE.insertTableData.method).toBe('POST');
    });

    it('should re-export the vendored package $rootScope object', () => {
        expect($rootScope).toBeDefined();
        expect(typeof $rootScope).toBe('object');
    });
});
