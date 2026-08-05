import anyTest, { TestFn } from 'ava';
import {
  formatComponentAPI,
  findComponentInManifest,
  fetchCustomElementsManifest,
} from '../../src/tools/get_component_api/manifest_processor.js';
import type { ComponentData, CustomElementsManifest, NpmPackageData } from '../../src/types.js';

const test = anyTest as TestFn;

const originalFetch = global.fetch;

test.afterEach(() => {
  global.fetch = originalFetch;
});

// Mock data
const mockComponentData: ComponentData = {
  name: 'Button',
  tagName: 'ui5-button',
  description: 'A button component',
  attributes: [
    {
      name: 'design',
      type: { text: 'string' },
      description: 'Button design',
      default: 'Default',
    },
    {
      name: 'disabled',
      type: { text: 'boolean' },
      description: 'Disabled state',
    },
  ],
  slots: [
    {
      name: 'default',
      description: 'Button content',
    },
  ],
  events: [
    {
      name: 'click',
      type: { text: 'CustomEvent' },
      description: 'Fired on click',
    },
  ],
  members: [
    {
      name: 'focus',
      kind: 'method',
      type: { text: 'void' },
      description: 'Focus the button',
    },
    {
      name: '_privateMethod',
      kind: 'method',
      description: 'Private method',
    },
  ],
};

const mockManifest: CustomElementsManifest = {
  modules: [
    {
      declarations: [
        {
          name: 'Button',
          tagName: 'ui5-button',
          description: 'A button component',
          attributes: [
            {
              name: 'design',
              type: { text: 'string' },
              description: 'Button design',
            },
          ],
          slots: [],
          events: [],
          members: [],
        },
        {
          name: 'Input',
          tagName: 'ui5-input',
          description: 'An input component',
        },
      ],
    },
  ],
};

// Tests for formatComponentAPI
test('formatComponentAPI includes component name', (t) => {
  const result = formatComponentAPI(mockComponentData);
  t.true(result.includes('# Button API Reference'));
});

test('formatComponentAPI includes description', (t) => {
  const result = formatComponentAPI(mockComponentData);
  t.true(result.includes('A button component'));
});

test('formatComponentAPI formats attributes correctly', (t) => {
  const result = formatComponentAPI(mockComponentData);
  t.true(result.includes('## Properties/Attributes'));
  t.true(result.includes('### design'));
  t.true(result.includes('**Type:** string'));
  t.true(result.includes('**Default:** Default'));
});

test('formatComponentAPI formats slots correctly', (t) => {
  const result = formatComponentAPI(mockComponentData);
  t.true(result.includes('## Slots'));
  t.true(result.includes('### default'));
  t.true(result.includes('Button content'));
});

test('formatComponentAPI formats events correctly', (t) => {
  const result = formatComponentAPI(mockComponentData);
  t.true(result.includes('## Events'));
  t.true(result.includes('### click'));
  t.true(result.includes('Fired on click'));
});

test('formatComponentAPI includes public methods only', (t) => {
  const result = formatComponentAPI(mockComponentData);
  t.true(result.includes('## Methods'));
  t.true(result.includes('### focus()'));
  t.false(result.includes('_privateMethod'));
});

test('formatComponentAPI handles empty arrays', (t) => {
  const minimal: ComponentData = {
    name: 'Minimal',
    tagName: 'ui5-minimal',
    description: 'Minimal component',
  };
  const result = formatComponentAPI(minimal);
  t.true(result.includes('# Minimal API Reference'));
  t.false(result.includes('## Properties/Attributes'));
  t.false(result.includes('## Slots'));
});

// Tests for findComponentInManifest
test('findComponentInManifest finds component by tagName', (t) => {
  const result = findComponentInManifest(mockManifest, 'ui5-button');
  t.truthy(result);
  t.is(result?.name, 'Button');
  t.is(result?.tagName, 'ui5-button');
});

test('findComponentInManifest finds component by name', (t) => {
  const result = findComponentInManifest(mockManifest, 'Input');
  t.truthy(result);
  t.is(result?.name, 'Input');
  t.is(result?.tagName, 'ui5-input');
});

test('findComponentInManifest returns null for non-existent component', (t) => {
  const result = findComponentInManifest(mockManifest, 'ui5-nonexistent');
  t.is(result, null);
});

test('findComponentInManifest handles empty manifest', (t) => {
  const emptyManifest: CustomElementsManifest = { modules: [] };
  const result = findComponentInManifest(emptyManifest, 'ui5-button');
  t.is(result, null);
});

test('findComponentInManifest handles manifest without modules', (t) => {
  const noModules: CustomElementsManifest = {};
  const result = findComponentInManifest(noModules, 'ui5-button');
  t.is(result, null);
});

test('findComponentInManifest provides default values', (t) => {
  const minimal: CustomElementsManifest = {
    modules: [
      {
        declarations: [
          {
            tagName: 'ui5-test',
          },
        ],
      },
    ],
  };
  const result = findComponentInManifest(minimal, 'ui5-test');
  t.truthy(result);
  t.is(result?.description, 'The ui5-test component.');
  t.deepEqual(result?.attributes, []);
  t.deepEqual(result?.slots, []);
});

// Tests for fetchCustomElementsManifest
test('fetchCustomElementsManifest returns null if no customElements field', async (t) => {
  const packageData: NpmPackageData = {
    name: '@ui5/webcomponents',
    version: '2.0.0',
  };
  const result = await fetchCustomElementsManifest(packageData);
  t.is(result, null);
});

test('fetchCustomElementsManifest fetches manifest successfully', async (t) => {
  const mockManifestResponse = { modules: [] };
  global.fetch = async () =>
    ({
      ok: true,
      json: async () => mockManifestResponse,
    }) as Response;

  const packageData: NpmPackageData = {
    name: '@ui5/webcomponents',
    version: '2.0.0',
    customElements: './dist/custom-elements.json',
  };

  const result = await fetchCustomElementsManifest(packageData);
  t.deepEqual(result, mockManifestResponse);
});

test('fetchCustomElementsManifest handles fetch errors', async (t) => {
  global.fetch = async () =>
    ({
      ok: false,
      status: 404,
    }) as Response;

  const packageData: NpmPackageData = {
    name: '@ui5/webcomponents',
    version: '2.0.0',
    customElements: './dist/custom-elements.json',
  };

  const result = await fetchCustomElementsManifest(packageData);
  t.is(result, null);
});

test('fetchCustomElementsManifest handles network errors', async (t) => {
  global.fetch = async () => {
    throw new Error('Network error');
  };

  const packageData: NpmPackageData = {
    name: '@ui5/webcomponents',
    version: '2.0.0',
    customElements: './dist/custom-elements.json',
  };

  const result = await fetchCustomElementsManifest(packageData);
  t.is(result, null);
});

// ---------------------------------------------------------------------------
// Deprecated / experimental flag surfacing
// ---------------------------------------------------------------------------

// Mirrors the shape of the real @ui5/webcomponents CEM: `deprecated` is a
// string reason on individual attributes/slots/events/members. We also cover a
// component-level flag and the `_ui5experimental` field for future-proofing.
const mockFlaggedComponent: ComponentData = {
  name: 'TableRowAction',
  tagName: 'ui5-table-row-action',
  description: 'Row action inside a Table.',
  attributes: [
    {
      name: 'interactive',
      type: { text: 'boolean' },
      description: 'Whether the action is interactive.',
      deprecated: 'Set `mode="Interactive"` instead for the same functionality.',
    },
    {
      name: 'text',
      type: { text: 'string' },
      description: 'Action label.',
    },
  ],
  slots: [
    {
      name: 'icon',
      description: 'Icon slot.',
      deprecated: true,
    },
  ],
  events: [
    {
      name: 'click',
      type: { text: 'CustomEvent' },
      description: 'Fired on click.',
      _ui5experimental: 'Event payload may change.',
    },
  ],
  members: [
    {
      name: 'focus',
      kind: 'method',
      type: { text: 'void' },
      description: 'Focus the action.',
      _ui5experimental: true,
    },
    {
      name: 'oldMethod',
      kind: 'method',
      description: 'Legacy method.',
      deprecated: 'Use focus() instead.',
    },
  ],
};

test('formatComponentAPI renders a deprecation warning with reason on attributes', (t) => {
  const result = formatComponentAPI(mockFlaggedComponent);
  t.true(result.includes('### interactive'));
  t.true(result.includes('**⚠ DEPRECATED:**'));
  t.true(result.includes('Set `mode="Interactive"` instead for the same functionality.'));
});

test('formatComponentAPI renders a generic deprecation marker when reason is `true`', (t) => {
  const result = formatComponentAPI(mockFlaggedComponent);
  t.true(result.includes('### icon'));
  t.true(result.includes('**⚠ DEPRECATED:** Do not use in new code.'));
});

test('formatComponentAPI renders an experimental marker with note on events', (t) => {
  const result = formatComponentAPI(mockFlaggedComponent);
  t.true(result.includes('### click'));
  t.true(result.includes('**🧪 EXPERIMENTAL:** Event payload may change.'));
});

test('formatComponentAPI renders a generic experimental marker when flag is `true`', (t) => {
  const result = formatComponentAPI(mockFlaggedComponent);
  t.true(result.includes('### focus()'));
  t.true(result.includes('**🧪 EXPERIMENTAL:** API may change without notice.'));
});

test('formatComponentAPI renders deprecation warnings on methods', (t) => {
  const result = formatComponentAPI(mockFlaggedComponent);
  t.true(result.includes('### oldMethod()'));
  t.true(result.includes('Use focus() instead.'));
});

test('formatComponentAPI renders a top-level Stability section when the whole component is flagged', (t) => {
  const flagged: ComponentData = {
    name: 'ExperimentalWidget',
    tagName: 'ui5-experimental-widget',
    description: 'Experimental widget.',
    _ui5experimental: 'Whole component is a preview.',
  };
  const result = formatComponentAPI(flagged);
  t.true(result.includes('## Stability'));
  t.true(result.includes('Whole component is a preview.'));
});

test('formatComponentAPI hides deprecated items when hideDeprecated is true', (t) => {
  const result = formatComponentAPI(mockFlaggedComponent, { hideDeprecated: true });
  // Deprecated attribute, slot and method should be gone entirely.
  t.false(result.includes('### interactive'));
  t.false(result.includes('### icon'));
  t.false(result.includes('### oldMethod()'));
  // Non-deprecated members remain.
  t.true(result.includes('### text'));
  t.true(result.includes('### focus()'));
});

test('formatComponentAPI keeps deprecated items visible by default', (t) => {
  const result = formatComponentAPI(mockFlaggedComponent);
  t.true(result.includes('### interactive'));
  t.true(result.includes('### oldMethod()'));
});

test('findComponentInManifest preserves deprecated and experimental flags', (t) => {
  const manifest: CustomElementsManifest = {
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
                deprecated: 'Use mode="Interactive".',
              },
            ],
            events: [
              {
                name: 'click',
                _ui5experimental: true,
              },
            ],
          },
        ],
      },
    ],
  };
  const result = findComponentInManifest(manifest, 'ui5-table-row-action');
  t.truthy(result);
  t.is(result?.attributes?.[0].deprecated, 'Use mode="Interactive".');
  t.is(result?.events?.[0]._ui5experimental, true);
});

