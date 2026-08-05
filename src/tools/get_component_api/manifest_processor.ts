import {
  CustomElementsManifest,
  NpmPackageData,
  type ComponentAttribute,
  type ComponentData,
  type ComponentEvent,
  type ComponentMember,
  type ComponentSlot,
} from '../../types.js';
import { USER_AGENT, NPM_REGISTRY_BASE, UNPKG_BASE, makeNpmRequest } from '../../utils.js';
import { logger } from '../../logger.js';

// UI5 Web Components packages ordered by priority
export const UI5_PACKAGES = [
  '@ui5/webcomponents',
  '@ui5/webcomponents-fiori',
  '@ui5/webcomponents-ai',
];

export interface FormatOptions {
  hideDeprecated?: boolean;
}

export async function fetchCustomElementsManifest(
  packageData: NpmPackageData
): Promise<CustomElementsManifest | null> {
  if (!packageData.customElements) return null;

  try {
    const customElementsPath = packageData.customElements.replace('./', '');
    const manifestUrl = `${UNPKG_BASE}/${packageData.name}@${packageData.version}/${customElementsPath}`;

    const response = await fetch(manifestUrl, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    });

    if (!response.ok) return null;
    return (await response.json()) as CustomElementsManifest;
  } catch {
    return null;
  }
}

export async function findComponentInPackages(
  componentName: string,
  version: string
): Promise<ComponentData | null> {
  for (const packageName of UI5_PACKAGES) {
    try {
      logger.debug(`Searching for ${componentName} in ${packageName}...`);

      const packageUrl = `${NPM_REGISTRY_BASE}/${packageName}/${version}`;
      const packageData = await makeNpmRequest<NpmPackageData>(packageUrl);
      if (!packageData) continue;

      const manifest = await fetchCustomElementsManifest(packageData);
      if (!manifest) continue;

      const componentData = findComponentInManifest(manifest, componentName);
      if (componentData) {
        logger.debug(`Found ${componentName} in ${packageName}`);
        return componentData;
      }
    } catch (error) {
      logger.debug(`Error searching in package ${packageName}:`, error);
    }
  }

  return null;
}

export function findComponentInManifest(
  manifest: CustomElementsManifest,
  componentName: string
): ComponentData | null {
  if (!manifest.modules) return null;

  for (const module of manifest.modules) {
    const declaration = module.declarations?.find(
      (d) => d.tagName === componentName || d.name === componentName
    );

    if (declaration) {
      return {
        name: declaration.name || componentName,
        tagName: declaration.tagName || componentName,
        description: declaration.description || `The ${componentName} component.`,
        deprecated: declaration.deprecated,
        _ui5experimental: declaration._ui5experimental,
        attributes: declaration.attributes || [],
        slots: declaration.slots || [],
        events: declaration.events || [],
        members: declaration.members || [],
      };
    }
  }

  return null;
}

// Build the "⚠ DEPRECATED" / "🧪 EXPERIMENTAL" markers for a member. Returns an
// array of markdown lines to insert after the member heading. Empty when the
// member carries no flags.
function stabilityMarkers(item: {
  deprecated?: string | boolean;
  _ui5experimental?: string | boolean;
}): string[] {
  const lines: string[] = [];

  if (item.deprecated !== undefined && item.deprecated !== false) {
    const reason = typeof item.deprecated === 'string' ? item.deprecated : '';
    lines.push(
      reason
        ? `- **⚠ DEPRECATED:** ${reason}`
        : '- **⚠ DEPRECATED:** Do not use in new code.'
    );
  }

  if (item._ui5experimental !== undefined && item._ui5experimental !== false) {
    const note = typeof item._ui5experimental === 'string' ? item._ui5experimental : '';
    lines.push(
      note
        ? `- **🧪 EXPERIMENTAL:** ${note}`
        : '- **🧪 EXPERIMENTAL:** API may change without notice.'
    );
  }

  return lines;
}

function isDeprecated(item: { deprecated?: string | boolean }): boolean {
  return item.deprecated !== undefined && item.deprecated !== false;
}

function filterDeprecated<
  T extends { deprecated?: string | boolean },
>(items: T[] | undefined, hide: boolean): T[] | undefined {
  if (!items || !hide) return items;
  return items.filter((i) => !isDeprecated(i));
}

// Helper function to format component API data
export function formatComponentAPI(
  component: ComponentData,
  options: FormatOptions = {}
): string {
  const hide = options.hideDeprecated === true;
  const sections = [`# ${component.name || component.tagName} API Reference`];

  // Component-level stability markers appear right below the title so the
  // reader (and the LLM) sees them before anything else.
  const componentMarkers = stabilityMarkers(component);
  if (componentMarkers.length) {
    sections.push('\n## Stability');
    sections.push(...componentMarkers);
  }

  if (component.description) {
    sections.push(`\n## Description\n${component.description}`);
  }

  const attributes = filterDeprecated<ComponentAttribute>(component.attributes, hide);
  if (attributes?.length) {
    sections.push('\n## Properties/Attributes');
    attributes.forEach((attr) => {
      sections.push(`\n### ${attr.name}`);
      sections.push(...stabilityMarkers(attr));
      if (attr.type?.text) sections.push(`- **Type:** ${attr.type.text}`);
      if (attr.description) sections.push(`- **Description:** ${attr.description}`);
      if (attr.default) sections.push(`- **Default:** ${attr.default}`);
    });
  }

  const slots = filterDeprecated<ComponentSlot>(component.slots, hide);
  if (slots?.length) {
    sections.push('\n## Slots');
    slots.forEach((slot) => {
      sections.push(`\n### ${slot.name || 'default'}`);
      sections.push(...stabilityMarkers(slot));
      if (slot.description) sections.push(`- **Description:** ${slot.description}`);
    });
  }

  const events = filterDeprecated<ComponentEvent>(component.events, hide);
  if (events?.length) {
    sections.push('\n## Events');
    events.forEach((event) => {
      sections.push(`\n### ${event.name}`);
      sections.push(...stabilityMarkers(event));
      if (event.type?.text) sections.push(`- **Type:** ${event.type.text}`);
      if (event.description) sections.push(`- **Description:** ${event.description}`);
    });
  }

  const publicMethods = filterDeprecated<ComponentMember>(
    component.members?.filter((m) => m.kind === 'method' && !m.name.startsWith('_')),
    hide
  );
  if (publicMethods?.length) {
    sections.push('\n## Methods');
    publicMethods.forEach((method) => {
      sections.push(`\n### ${method.name}()`);
      sections.push(...stabilityMarkers(method));
      if (method.type?.text) sections.push(`- **Returns:** ${method.type.text}`);
      if (method.description) sections.push(`- **Description:** ${method.description}`);
    });
  }

  return sections.join('\n');
}
