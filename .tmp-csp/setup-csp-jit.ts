import { JitEvaluator } from '@angular/compiler';
import { installCspSafeJitCompiler, InterpretingJitEvaluator } from '../projects/core/src/utils/csp-safe-jit';
(JitEvaluator.prototype as any).evaluateCode = () => { throw new Error('NATIVE JIT EVAL USED'); };
installCspSafeJitCompiler(true);
let n = 0;
const orig = InterpretingJitEvaluator.prototype.evaluateStatements;
InterpretingJitEvaluator.prototype.evaluateStatements = function (...a: any[]) { n++; return (orig as any).apply(this, a); };
afterAll(() => { process.stdout.write(`INTERPRETED_COMPILES=${n} facade=${(globalThis as any).ng.ɵcompilerFacade.jitEvaluator.constructor.name}\n`); });
