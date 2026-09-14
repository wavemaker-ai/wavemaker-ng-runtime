export interface WebpackPatchResult {
    sourceMapsOptimized: boolean;
    licenseExtractionDisabled: boolean;
    buildCacheEnabled: boolean;
}
export declare function optimizeWebpackAndBuildConfigs(targetDir: string): WebpackPatchResult;
