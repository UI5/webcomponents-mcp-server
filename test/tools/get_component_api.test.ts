import anyTest, { TestFn } from 'ava';
import { getComponentApiTool } from '../../src/tools/get_component_api/get_component_api.js';

const test = anyTest as TestFn;

const originalFetch = global.fetch;

test.afterEach(() => {
  global.fetch = originalFetch;
});

test.serial('normalizes Button to ui5-button', async (t) => {
  global.fetch = async () => ({ ok: false, status: 404 }) as Response;

  const result = await getComponentApiTool.handler({
    componentName: 'Button',
    version: 'latest',
  });

  t.true(result.content[0].text.includes('ui5-button'));
});

test.serial('normalizes AvatarGroup to ui5-avatar-group', async (t) => {
  global.fetch = async () => ({ ok: false, status: 404 }) as Response;

  const result = await getComponentApiTool.handler({
    componentName: 'AvatarGroup',
    version: 'latest',
  });

  t.true(result.content[0].text.includes('ui5-avatar-group'));
});

test.serial('returns not found for invalid component', async (t) => {
  global.fetch = async () => ({ ok: false, status: 404 }) as Response;

  const result = await getComponentApiTool.handler({
    componentName: 'nonexistent',
    version: 'latest',
  });

  t.true(result.content[0].text.includes('not found'));
});

test.serial('blocks version with path traversal', async (t) => {
  const result = await getComponentApiTool.handler({
    componentName: 'Button',
    version: '../../express',
  });

  t.true(result.content[0].text.includes('Access denied'));
});

test.serial('blocks version with slashes', async (t) => {
  const result = await getComponentApiTool.handler({
    componentName: 'Button',
    version: 'latest/../../lodash',
  });

  t.true(result.content[0].text.includes('Access denied'));
});

test.serial('allows valid semver version', async (t) => {
  global.fetch = async () => ({ ok: false, status: 404 }) as Response;

  const result = await getComponentApiTool.handler({
    componentName: 'Button',
    version: '2.6.0',
  });

  t.false(result.content[0].text.includes('Access denied'));
});

test.serial('allows valid prerelease version', async (t) => {
  global.fetch = async () => ({ ok: false, status: 404 }) as Response;

  const result = await getComponentApiTool.handler({
    componentName: 'Button',
    version: '2.0.0-rc.1',
  });

  t.false(result.content[0].text.includes('Access denied'));
});

// End-to-end: fake CEM containing a deprecated attribute, verify the handler
// surfaces the warning and that hideDeprecated removes it.
test.serial('surfaces a deprecation warning end-to-end', async (t) => {
  const fakeManifest = {
    modules: [
      {
        declarations: [
          {
            name: 'TableRowAction',
            tagName: 'ui5-table-row-action',
            description: 'Row action.',
            attributes: [
              {
                name: 'interactive',
                type: { text: 'boolean' },
                description: 'Whether interactive.',
                deprecated: 'Set `mode="Interactive"` instead.',
              },
            ],
          },
        ],
      },
    ],
  };

  global.fetch = async (url) => {
    const u = String(url);
    if (u.includes('registry.npmjs.org')) {
      return {
        ok: true,
        json: async () => ({
          name: '@ui5/webcomponents',
          version: '2.25.0',
          customElements: 'dist/custom-elements.json',
        }),
      } as Response;
    }
    if (u.includes('unpkg.com')) {
      return { ok: true, json: async () => fakeManifest } as Response;
    }
    return { ok: false, status: 404 } as Response;
  };

  const result = await getComponentApiTool.handler({
    componentName: 'ui5-table-row-action',
    version: 'latest',
  });

  t.true(result.content[0].text.includes('**⚠ DEPRECATED:**'));
  t.true(result.content[0].text.includes('Set `mode="Interactive"` instead.'));
});

test.serial('hideDeprecated removes deprecated members from output end-to-end', async (t) => {
  const fakeManifest = {
    modules: [
      {
        declarations: [
          {
            name: 'TableRowAction',
            tagName: 'ui5-table-row-action',
            description: 'Row action.',
            attributes: [
              {
                name: 'interactive',
                type: { text: 'boolean' },
                deprecated: 'gone',
              },
              {
                name: 'text',
                type: { text: 'string' },
              },
            ],
          },
        ],
      },
    ],
  };

  global.fetch = async (url) => {
    const u = String(url);
    if (u.includes('registry.npmjs.org')) {
      return {
        ok: true,
        json: async () => ({
          name: '@ui5/webcomponents',
          version: '2.25.0',
          customElements: 'dist/custom-elements.json',
        }),
      } as Response;
    }
    if (u.includes('unpkg.com')) {
      return { ok: true, json: async () => fakeManifest } as Response;
    }
    return { ok: false, status: 404 } as Response;
  };

  const result = await getComponentApiTool.handler({
    componentName: 'ui5-table-row-action',
    version: 'latest',
    hideDeprecated: true,
  });

  t.false(result.content[0].text.includes('### interactive'));
  t.true(result.content[0].text.includes('### text'));
});
