import { CustomElementsManifest, NpmPackageData, type ComponentData } from '../../types.js';
import { USER_AGENT, NPM_REGISTRY_BASE, UNPKG_BASE, makeNpmRequest } from '../../utils.js';
import { logger } from '../../logger.js';

// UI5 Web Components packages ordered by priority
export const UI5_PACKAGES = [
  '@ui5/webcomponents',
  '@ui5/webcomponents-fiori',
  '@ui5/webcomponents-ai',
];

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
        attributes: declaration.attributes || [],
        slots: declaration.slots || [],
        events: declaration.events || [],
        members: declaration.members || [],
      };
    }
  }

  return null;
}

// Helper function to format component API data
export function formatComponentAPI(component: ComponentData): string {
  const sections = [`# ${component.name || component.tagName} API Reference`];

  if (component.description) {
    sections.push(`\n## Description\n${component.description}`);
  }

  if (component.attributes?.length) {
    sections.push('\n## Properties/Attributes');
    component.attributes.forEach((attr) => {
      sections.push(`\n### ${attr.name}`);
      if (attr.type?.text) sections.push(`- **Type:** ${attr.type.text}`);
      if (attr.description) sections.push(`- **Description:** ${attr.description}`);
      if (attr.default) sections.push(`- **Default:** ${attr.default}`);
    });
  }

  if (component.slots?.length) {
    sections.push('\n## Slots');
    component.slots.forEach((slot) => {
      sections.push(`\n### ${slot.name || 'default'}`);
      if (slot.description) sections.push(`- **Description:** ${slot.description}`);
    });
  }

  if (component.events?.length) {
    sections.push('\n## Events');
    component.events.forEach((event) => {
      sections.push(`\n### ${event.name}`);
      if (event.type?.text) sections.push(`- **Type:** ${event.type.text}`);
      if (event.description) sections.push(`- **Description:** ${event.description}`);
    });
  }

  const publicMethods = component.members?.filter(
    (m) => m.kind === 'method' && !m.name.startsWith('_')
  );
  if (publicMethods?.length) {
    sections.push('\n## Methods');
    publicMethods.forEach((method) => {
      sections.push(`\n### ${method.name}()`);
      if (method.type?.text) sections.push(`- **Returns:** ${method.type.text}`);
      if (method.description) sections.push(`- **Description:** ${method.description}`);
    });
  }

  return sections.join('\n');
}

