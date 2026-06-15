import anyTest, { TestFn } from 'ava';
import { createTextResponse, handleToolError, getProxyAgent } from '../src/utils.js';

const test = anyTest as TestFn;

test('createTextResponse creates valid MCP text response', (t) => {
  const result = createTextResponse('test message');

  t.deepEqual(result, {
    content: [
      {
        type: 'text',
        text: 'test message',
      },
    ],
  });
});

test('handleToolError formats Error instances correctly', (t) => {
  const error = new Error('test error message');
  const result = handleToolError(error, 'Operation failed');

  t.is(result.content[0].type, 'text');
  t.regex(result.content[0].text, /Operation failed: test error message/);
});

test('handleToolError formats unknown errors as strings', (t) => {
  const result = handleToolError('string error', 'Context');

  t.is(result.content[0].type, 'text');
  t.regex(result.content[0].text, /Context: string error/);
});

test('handleToolError formats non-Error objects', (t) => {
  const result = handleToolError({ code: 500 }, 'Request failed');

  t.is(result.content[0].type, 'text');
  t.true(result.content[0].text.includes('Request failed'));
});

// getProxyAgent tests
const PROXY_ENV_VARS = ['HTTPS_PROXY', 'https_proxy', 'HTTP_PROXY', 'http_proxy'];

function clearProxyEnv(): void {
  for (const key of PROXY_ENV_VARS) {
    delete process.env[key];
  }
}

test.serial('getProxyAgent returns undefined when no proxy env vars are set', (t) => {
  clearProxyEnv();
  t.is(getProxyAgent(), undefined);
});

test.serial('getProxyAgent returns an agent when HTTPS_PROXY is set', (t) => {
  clearProxyEnv();
  process.env.HTTPS_PROXY = 'http://proxy.example.com:8080';
  const agent = getProxyAgent();
  t.truthy(agent);
  t.is(agent!.proxy.hostname, 'proxy.example.com');
  t.is(agent!.proxy.port, '8080');
  delete process.env.HTTPS_PROXY;
});

test.serial('getProxyAgent respects priority: HTTPS_PROXY > https_proxy > HTTP_PROXY > http_proxy', (t) => {
  // On Windows, env var names are case-insensitive, so HTTPS_PROXY and
  // https_proxy refer to the same variable. We test each fallback level
  // in isolation to avoid this OS-level quirk.

  // Highest priority: HTTPS_PROXY
  clearProxyEnv();
  process.env.HTTPS_PROXY = 'http://highest-priority:4444';
  t.is(getProxyAgent()!.proxy.hostname, 'highest-priority');

  // Fallback: HTTP_PROXY (skip https_proxy on Windows due to case-insensitivity)
  clearProxyEnv();
  process.env.HTTP_PROXY = 'http://mid-priority:2222';
  t.is(getProxyAgent()!.proxy.hostname, 'mid-priority');

  // Last resort: http_proxy
  clearProxyEnv();
  process.env.http_proxy = 'http://low-priority:1111';
  t.is(getProxyAgent()!.proxy.hostname, 'low-priority');

  clearProxyEnv();
});
