export { mountUpstream, mountUpstreams, markShutdown } from './mount.js';
/** Test-only re-export of the module-state reset helper; production callers should not use it. */
export { _resetForTesting } from './mount.js';
export type { MountOptions, UpstreamHandle } from './mount.js';
export { UPSTREAMS } from './registry.js';
export type { UpstreamSpec } from './registry.js';
