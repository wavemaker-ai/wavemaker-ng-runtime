const fs = require('fs');
const path = require('path');

const variablesEntry = [
  '.yalc/@wavemaker-ai/variables/index.js',
  '.yalc/@wavemaker-ai/variables/dist/es2015/index.js',
  'node_modules/@wavemaker-ai/variables/index.js',
].find((entry) => fs.existsSync(path.join(__dirname, entry)));

module.exports = {
  preset: "jest-preset-angular",
  testTimeout: 15000,
  roots: ["<rootDir>/projects"],
    testEnvironment: 'jest-environment-jsdom',
  transformIgnorePatterns: [
    '/node_modules/(?!(@wavemaker-ai/app-ng-runtime|lodash-es|@angular|angular-imask|ng-circle-progress|@wavemaker-ai/variables|@wavemaker-ai/foundation-css|@wavemaker-ai/custom-widgets-m3|ngx-toastr|ngx-bootstrap|ngx-color-picker|@fullcalendar|preact)/)',
  ],
  testMatch: [
    "**/projects/**/*.spec.ts"
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
  ],
  setupFilesAfterEnv: ["<rootDir>/src/setup-jest.js"],
  collectCoverage: true,
  coverageReporters: ["html", "json-summary"],
  coveragePathIgnorePatterns: [
    // anything outside projects/, src/, libraries/ (and the .yalc ui-variables exception below)
    "/node_modules/",
    "/build-helpers/",
    "/build-scripts/",
    "/config/",
    "/dependency-check-bin/",
    "/dependency-check-reports/",
    "<rootDir>/dist/",
    "/docs/",
    "/documentation/",
    "/out-tsc/",
    "/pwa-assets/",
    "/tools/",
    // any "scripts" folder anywhere (top-level scripts/, libraries/scripts/, vendored build scripts)
    "/scripts/",
    // libraries/swipey stays excluded; projects/swipey stays included except the vendored plugin file below
    "libraries/swipey/",
    // other .yalc-linked packages; @wavemaker-ai/variables is intentionally NOT excluded
    ".yalc/@wavemaker/",
    ".yalc/@wavemaker-ai/angular-app",
    ".yalc/@wavemaker-ai/custom-widgets-m3",
    ".yalc/@wavemaker-ai/foundation-css",
    // vendored third-party files inside projects/
    "projects/components/widgets/basic/tree/src/keyboard-navigation.js",
    "projects/jquery.ui.touch-punch/jquery.ui.touch-punch.min.js",
    "projects/swipey/src/swipey.jquery.plugin.js",
    "projects/components/base/src/test/"
  ],
  coverageDirectory: "coverage",
  moduleNameMapper: {
    "@wavemaker-ai/variables": `<rootDir>/${variablesEntry || '.yalc/@wavemaker-ai/variables/index.js'}`,
    "@fullcalendar/(.*)$": "<rootDir>/node_modules/@fullcalendar/core/index.cjs",
    "^jQuery$": "jquery",
    "@wm/security": "<rootDir>/projects/security/src/public_api.ts",
    "@wm/variables": "<rootDir>/projects/variables/src/public_api.ts",
    "@wm/oAuth": "<rootDir>/projects/oAuth/src/public_api.ts",
    "@wm/http": "<rootDir>/projects/http-service/src/public_api.ts",
    "@wm/swipey": "<rootDir>/projects/swipey/src/public_api.ts",
    "@swipey": "<rootDir>/projects/swipey/src/public_api.ts",
    "@wm/components/base": "<rootDir>/projects/components/base/index.ts",
    "@wm/components/basic/search": "<rootDir>/projects/components/widgets/basic/search/src/public_api.ts",
    "@wm/components/basic/anchor": "<rootDir>/projects/components/widgets/basic/anchor/src/public_api.ts",
    "@wm/components/basic/audio": "<rootDir>/projects/components/widgets/basic/audio/src/public_api.ts",
    "@wm/components/basic/html": "<rootDir>/projects/components/widgets/basic/html/src/public_api.ts",
    "@wm/components/basic/icon": "<rootDir>/projects/components/widgets/basic/icon/src/public_api.ts",
    "@wm/components/basic/iframe": "<rootDir>/projects/components/widgets/basic/iframe/src/public_api.ts",
    "@wm/components/basic/label": "<rootDir>/projects/components/widgets/basic/label/src/public_api.ts",
    "@wm/components/basic/video": "<rootDir>/projects/components/widgets/basic/video/src/public_api.ts",
    "@wm/components/input/(.*)$": "<rootDir>/projects/components/widgets/input/$1/src/public_api.ts",
    "@wm/components/dialogs": "<rootDir>/projects/components/widgets/dialogs/default/src/public_api.ts",
    "@wm/components/page": "<rootDir>/projects/components/widgets/page/default/src/public_api.ts",
    "@wm/components/(.*)/(.*)$": "<rootDir>/projects/components/widgets/$1/$2/src/public_api.ts",
    "@wm/components/(.*)$": "<rootDir>/projects/components/widgets/$1/src/public_api.ts",
    "@wm/(.*)$": "<rootDir>/projects/$1/index.ts",
    "projects/(.*)$": "<rootDir>/projects/$1",
    "libraries/scripts/jquery.ui.touch-punch/jquery.ui.touch-punch.min.js": "<rootDir>/projects/jquery.ui.touch-punch/jquery.ui.touch-punch.min.js",
    "libraries/(.*)$": "<rootDir>/libraries/$1"
  }

};
