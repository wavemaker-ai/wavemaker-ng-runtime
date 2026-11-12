const base = require('../jest.config.js');
module.exports = { ...base, rootDir: require('path').resolve(__dirname, '..'), setupFilesAfterEnv: [...base.setupFilesAfterEnv, '<rootDir>/.tmp-csp/setup-csp-jit.ts'], coverageThreshold: undefined, collectCoverage: false };
