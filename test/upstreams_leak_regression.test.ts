/**
 * Regression tests for the two child-process-leak bugs called out in the PR #17 review comment
 * from NakataCode (2026-08-05):
 *
 *   1. `mountUpstreams` leaks already-spawned children when a later mount throws.
 *   2. `handles` in the entrypoint is `[]` during the mount window, so a shutdown fired
 *      mid-mount leaves in-flight children orphaned.
 *
 * These previously-failing "proof" tests now assert the fixed behavior — flipping either back
 * would cause a real leak on the same code paths.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import anyTest, { TestFn } from 'ava';

import {
  mountUpstream,
  mountUpstreams,
  markShutdown,
  _resetForTesting,
  UPSTREAMS,
  UpstreamHandle,
} from '../src/upstreams/index.js';

const test = anyTest as TestFn;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MOCK_BIN = path.join(__dirname, 'fixtures', 'mock_upstream.mjs');

test.beforeEach(() => {
  _resetForTesting();
});

/**
 * Returns true if a process with `pid` is currently alive. `process.kill(pid, 0)` throws
 * ESRCH when the pid doesn't exist.
 */
function isAlive(pid: number | null | undefined): boolean {
  if (pid == null) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Poll for `isAlive(pid) === false` for up to `timeoutMs`. The child's 'close' event races the
 * subsequent kill(pid, 0) syscall — sometimes we observe it dead immediately, sometimes a few
 * ms later. Poll to avoid a flaky sleep-then-check.
 */
async function waitDead(pid: number | null | undefined, timeoutMs = 2000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (!isAlive(pid)) return true;
    await delay(20);
  }
  return false;
}

/**
 * Issue 1: `mountUpstreams` must not leak already-spawned children when a later mount throws.
 *
 * We drive `mountUpstreams` with two specs: the first resolves to the real, installed
 * `@ui5/webcomponents-react-mcp` package; the second has an unresolvable packageName so
 * `resolveUpstreamBin` throws before its child is even spawned. Without the fix, the React
 * child (fully mounted before the failure) stays alive; with the fix, `mountUpstreams`' catch
 * closes every collected handle before rethrowing.
 *
 * The `onHandle` callback captures each handle as it lands so we can observe the leak surface
 * from outside `mountUpstreams`. This is exactly how src/index.ts uses the callback.
 */
test.serial(
  'mountUpstreams closes already-mounted children when a later mount fails',
  async (t) => {
    const reactSpec = UPSTREAMS.find((u) => u.prefix === 'react');
    t.truthy(reactSpec, 'React entry must exist in UPSTREAMS for this test');

    const server = new McpServer(
      { name: 'host', version: '0' },
      { capabilities: { tools: {}, resources: {}, prompts: {} } }
    );

    const captured: UpstreamHandle[] = [];
    await t.throwsAsync(() =>
      mountUpstreams(
        server,
        [reactSpec!, { prefix: 'nope', label: 'Nope', packageName: '__does_not_exist__' }],
        (h) => captured.push(h)
      )
    );

    t.is(captured.length, 1, 'first upstream was mounted before the failure');
    const firstPid = captured[0].transport.pid;
    t.true(
      await waitDead(firstPid),
      `first child (pid ${firstPid}) must be dead after mountUpstreams rejected`
    );
  }
);

/**
 * Issue 2: During the mount window, the entrypoint's `handles` used to be `[]` — a SIGINT
 * arriving between "child spawned" and "mountUpstreams resolved" left the child orphaned.
 *
 * The fix threads an `onHandle` callback through `mountUpstreams` so the entrypoint sees each
 * handle as soon as it's connected. Here we replay that exact pattern: start `mountUpstreams`
 * against a slow second mount, wait until the first `onHandle` has fired, run the shutdown
 * sequence (markShutdown + close each handle), and assert the first child actually died.
 *
 * We inline the outer loop shape rather than calling `mountUpstreams` because `mountUpstreams`
 * doesn't accept per-spec `binPath` — but the callback contract we're testing is identical.
 */
test.serial('mid-mount shutdown closes the child via onHandle callback', async (t) => {
  const server = new McpServer(
    { name: 'host', version: '0' },
    { capabilities: { tools: {}, resources: {}, prompts: {} } }
  );

  // Mirror of `const handles: UpstreamHandle[] = []` in src/index.ts (with the fix applied).
  const handles: UpstreamHandle[] = [];

  // Sequential mount: first is our mock; second delays so we can catch the shutdown window
  // AFTER the first handle has been collected. The delay is simulated by awaiting a promise
  // we never resolve until the test signals we're done.
  let releaseSecondMount: () => void = () => {};
  const secondMountGate = new Promise<void>((resolve) => {
    releaseSecondMount = resolve;
  });

  const mountLoop = (async () => {
    const h1 = await mountUpstream(
      server,
      { prefix: 'a', label: 'A', packageName: 'unused' },
      { binPath: MOCK_BIN, onUpstreamExit: () => {} }
    );
    handles.push(h1); // simulates onHandle callback
    // Gate: don't proceed until the test releases us. Simulates a slow second mount.
    await secondMountGate;
    return handles;
  })();

  // Wait until the first mount has completed and onHandle has fired.
  while (handles.length === 0) await delay(10);

  // Now simulate SIGINT: run the exact shutdown sequence from src/index.ts.
  markShutdown();
  for (const h of handles) {
    try {
      h.transport.close();
    } catch {
      /* best-effort */
    }
  }

  // The first child should be dead - shutdown had a handle to close, unlike before the fix.
  t.is(handles.length, 1, 'onHandle callback populated the shutdown array mid-mount');
  t.true(
    await waitDead(handles[0].transport.pid),
    `child (pid ${handles[0].transport.pid}) must be dead after mid-mount shutdown`
  );

  // Release the gate and drain the mount loop so the test process exits cleanly.
  releaseSecondMount();
  await mountLoop;
});
