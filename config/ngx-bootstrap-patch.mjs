/**
 * Re-exports the canonical patch module from `build-scripts/` so Rollup and any
 * legacy `config/` imports keep working. The real implementation lives next to
 * `build.js` so it is always deployed with the UI build step.
 */
export * from '../build-scripts/ngx-bootstrap-patch.mjs';
