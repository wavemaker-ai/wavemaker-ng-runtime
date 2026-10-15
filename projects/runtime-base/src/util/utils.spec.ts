import {
    isPrefabInPreview,
    getPrefabBaseUrl,
    getPrefabConfigUrl,
    getPrefabMinJsonUrl,
    getPrefabPartialJsonUrl,
    getModesFromLocalStorage,
} from './utils';
import { _WM_APP_PROJECT } from '@wm/core';

describe('runtime-base utils', () => {
    afterEach(() => {
        delete _WM_APP_PROJECT.isPreview;
        delete _WM_APP_PROJECT.cdnUrl;
        localStorage.clear();
        jest.restoreAllMocks();
    });

    describe('isPrefabInPreview', () => {
        it('should return true for the special __self__ prefab name', () => {
            expect(isPrefabInPreview('__self__')).toBe(true);
        });

        it('should return false for a regular prefab name', () => {
            expect(isPrefabInPreview('MyPrefab')).toBe(false);
        });
    });

    describe('getPrefabBaseUrl', () => {
        it('should return "." for the self prefab regardless of preview mode', () => {
            _WM_APP_PROJECT.isPreview = true;
            expect(getPrefabBaseUrl('__self__')).toBe('.');
        });

        it('should use the app/prefabs path in preview mode', () => {
            _WM_APP_PROJECT.isPreview = true;
            expect(getPrefabBaseUrl('MyPrefab')).toBe('app/prefabs/MyPrefab');
        });

        it('should use the cdn resources path outside preview mode', () => {
            _WM_APP_PROJECT.isPreview = false;
            _WM_APP_PROJECT.cdnUrl = 'https://cdn.example.com/';
            expect(getPrefabBaseUrl('MyPrefab')).toBe('https://cdn.example.com/resources/MyPrefab');
        });
    });

    describe('url builders', () => {
        beforeEach(() => {
            _WM_APP_PROJECT.isPreview = true;
        });

        it('should build the prefab config url', () => {
            expect(getPrefabConfigUrl('MyPrefab')).toBe('app/prefabs/MyPrefab/config.json');
        });

        it('should build the prefab main page min-json url', () => {
            expect(getPrefabMinJsonUrl('MyPrefab')).toBe('app/prefabs/MyPrefab/pages/Main/page.min.json');
        });

        it('should build the prefab partial page min-json url', () => {
            expect(getPrefabPartialJsonUrl('MyPrefab', 'Header')).toBe('app/prefabs/MyPrefab/pages/Header/page.min.json');
        });
    });

    describe('getModesFromLocalStorage', () => {
        it('should return the parsed modes from localStorage', () => {
            localStorage.setItem('wm-app-modes', JSON.stringify({ theme: 'dark' }));
            expect(getModesFromLocalStorage()).toEqual({ theme: 'dark' });
        });

        it('should return an empty object when nothing is stored', () => {
            expect(getModesFromLocalStorage()).toEqual({});
        });

        it('should return an empty object and log an error for malformed JSON', () => {
            localStorage.setItem('wm-app-modes', '{not valid json');
            const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
            expect(getModesFromLocalStorage()).toEqual({});
            expect(errorSpy).toHaveBeenCalled();
        });
    });
});
