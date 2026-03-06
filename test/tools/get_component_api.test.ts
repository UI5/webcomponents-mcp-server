import anyTest, { TestFn } from 'ava';
import { getComponentApiTool } from '../../src/tools/get_component_api/get_component_api.js';

const test = anyTest as TestFn;

const originalFetch = global.fetch;

test.afterEach(() => {
  global.fetch = originalFetch;
});

test('normalizes Button to ui5-button', async (t) => {
  global.fetch = async () => ({ ok: false, status: 404 }) as Response;

  const result = await getComponentApiTool.handler({
    componentName: 'Button',
    version: 'latest',
  });

  t.true(result.content[0].text.includes('ui5-button'));
});

test('normalizes AvatarGroup to ui5-avatar-group', async (t) => {
  global.fetch = async () => ({ ok: false, status: 404 }) as Response;

  const result = await getComponentApiTool.handler({
    componentName: 'AvatarGroup',
    version: 'latest',
  });

  t.true(result.content[0].text.includes('ui5-avatar-group'));
});

test('returns not found for invalid component', async (t) => {
  global.fetch = async () => ({ ok: false, status: 404 }) as Response;

  const result = await getComponentApiTool.handler({
    componentName: 'nonexistent',
    version: 'latest',
  });

  t.true(result.content[0].text.includes('not found'));
});

test('blocks version with path traversal', async (t) => {
  const result = await getComponentApiTool.handler({
    componentName: 'Button',
    version: '../../express',
  });

  t.true(result.content[0].text.includes('Access denied'));
});

test('blocks version with slashes', async (t) => {
  const result = await getComponentApiTool.handler({
    componentName: 'Button',
    version: 'latest/../../lodash',
  });

  t.true(result.content[0].text.includes('Access denied'));
});

test('allows valid semver version', async (t) => {
  global.fetch = async () => ({ ok: false, status: 404 }) as Response;

  const result = await getComponentApiTool.handler({
    componentName: 'Button',
    version: '2.6.0',
  });

  t.false(result.content[0].text.includes('Access denied'));
});

test('allows valid prerelease version', async (t) => {
  global.fetch = async () => ({ ok: false, status: 404 }) as Response;

  const result = await getComponentApiTool.handler({
    componentName: 'Button',
    version: '2.0.0-rc.1',
  });

  t.false(result.content[0].text.includes('Access denied'));
});
