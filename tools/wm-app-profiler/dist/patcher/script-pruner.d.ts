export interface PruneResult {
    modified: boolean;
    removedScripts: string[];
}
export declare function pruneAngularJsonScripts(angularJsonPath: string, unusedLibs: {
    scriptFile: string;
    libraryName: string;
}[]): PruneResult;
