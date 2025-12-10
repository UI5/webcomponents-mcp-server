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

