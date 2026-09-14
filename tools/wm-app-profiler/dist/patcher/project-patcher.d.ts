import { AutoPatchResult } from '../types.js';
export declare function applyAutoPatches(targetProjectDir: string, unusedLibs?: {
    scriptFile: string;
    libraryName: string;
}[]): AutoPatchResult;
