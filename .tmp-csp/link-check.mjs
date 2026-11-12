import { readFileSync, existsSync } from 'fs';
import * as path from 'path';
const fileSystem = { resolve: path.resolve, exists: existsSync, dirname: path.dirname, relative: path.relative, readFile: readFileSync };
const logger = { level: 1, debug() {}, info() {}, warn() {}, error() {} };
import { transformAsync } from '@babel/core';
import { createEs2015LinkerPlugin } from '@angular/compiler-cli/linker/babel';
const file = 'node_modules/@angular/forms/fesm2022/forms.mjs';
const src = readFileSync(file, 'utf8');
for (const linkerJitMode of [false, true]) {
  const out = await transformAsync(src, { filename: file, babelrc: false, configFile: false, compact: false,
    plugins: [createEs2015LinkerPlugin({ linkerJitMode, fileSystem, logger })] });
  const code = out.code;
  const m = code.match(/defineNgModule\(\{\s*type:\s*ReactiveFormsModule[\s\S]*?\}\)/);
  const def = m ? m[0].replace(/\s+/g, ' ') : 'NOT FOUND';
  console.log(`linkerJitMode=${linkerJitMode}:`, def.slice(0, 260));
}
