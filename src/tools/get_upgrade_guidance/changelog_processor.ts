import { makeNpmRequest, NPM_REGISTRY_BASE, USER_AGENT } from '../../utils.js';
import type { NpmPackageData, VersionSection, ChangelogEntry, UpgradeGuidance } from '../../types.js';

const GITHUB_RAW_CHANGELOG_URL =
  'https://raw.githubusercontent.com/SAP/ui5-webcomponents/main/CHANGELOG.md';

// # [2.21.0-rc.4](https://github.com/UI5/webcomponents/compare/...) (2026-04-02)
const VERSION_HEADING_RE = /^# \[(\d[\w.-]*)\].*?\((\d{4}-\d{2}-\d{2})\)/;
// ### Bug Fixes / ### Features / ### BREAKING CHANGES
const SUBSECTION_RE = /^### (.+)/;
// * **ui5-button:** description text ([#NNN](...)) ([hash](...))
const ENTRY_RE = /^\* \*\*([^*]+)\*\*:? ?(.+)/;

export async function fetchChangelog(): Promise<string | null> {
  try {
    const response = await fetch(GITHUB_RAW_CHANGELOG_URL, {
      headers: { 'User-Agent': USER_AGENT },
    });
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  }
}

export async function resolveLatestVersion(): Promise<string | null> {
  const data = await makeNpmRequest<NpmPackageData>(
    `${NPM_REGISTRY_BASE}/@ui5/webcomponents/latest`
  );
  return data?.version ?? null;
}

// Returns negative if a < b, 0 if equal, positive if a > b
// Handles pre-release versions: 2.0.0-rc.1 < 2.0.0
export function compareSemver(a: string, b: string): number {
  const parseVersion = (v: string) => {
    const [mainPart, prePart] = v.split('-', 2);
    const nums = (mainPart ?? '').split('.').map(n => parseInt(n, 10) || 0);
    return { nums, pre: prePart ?? null };
  };

  const pa = parseVersion(a);
  const pb = parseVersion(b);

  for (let i = 0; i < 3; i++) {
    const diff = (pa.nums[i] ?? 0) - (pb.nums[i] ?? 0);
    if (diff !== 0) return diff;
  }

  // Same numeric version: pre-release sorts before release
  if (pa.pre && !pb.pre) return -1;
  if (!pa.pre && pb.pre) return 1;
  if (pa.pre && pb.pre) return pa.pre.localeCompare(pb.pre);
  return 0;
}

// Range: (fromVersion, toVersion] — exclusive lower, inclusive upper
export function parseChangelogRange(
  content: string,
  fromVersion: string,
  toVersion: string
): VersionSection[] {
  const sections: VersionSection[] = [];
  let currentSection: VersionSection | null = null;
  type SubsectionType = 'breakingChanges' | 'features' | 'bugFixes' | null;
  let currentSubsection: SubsectionType = null;

  for (const line of content.split('\n')) {
    const versionMatch = VERSION_HEADING_RE.exec(line);
    if (versionMatch) {
      const version = versionMatch[1]!;
      const date = versionMatch[2]!;

      // Stop when we reach a version at or below fromVersion
      if (compareSemver(version, fromVersion) <= 0) {
        break;
      }

      // Only collect versions within range: (fromVersion, toVersion]
      if (compareSemver(version, toVersion) <= 0) {
        currentSection = { version, date, breakingChanges: [], features: [], bugFixes: [] };
        sections.push(currentSection);
        currentSubsection = null;
      } else {
        // Version is above toVersion — not in range yet, keep scanning
        currentSection = null;
        currentSubsection = null;
      }
      continue;
    }

    if (!currentSection) continue;

    const subsectionMatch = SUBSECTION_RE.exec(line);
    if (subsectionMatch) {
      const name = subsectionMatch[1]!.trim().toLowerCase();
      if (name === 'breaking changes') {
        currentSubsection = 'breakingChanges';
      } else if (name === 'features') {
        currentSubsection = 'features';
      } else if (name === 'bug fixes') {
        currentSubsection = 'bugFixes';
      } else {
        currentSubsection = null;
      }
      continue;
    }

    if (!currentSubsection) continue;

    const entryMatch = ENTRY_RE.exec(line);
    if (entryMatch) {
      // Strip trailing PR/commit links: ([#NNN](link)) ([hash](link))
      const rawDescription = entryMatch[2]!.replace(/\s*\(\[.*?\]\(.*?\)\)+\s*$/g, '').trim();
      const entry: ChangelogEntry = {
        component: entryMatch[1]!.replace(/:$/, '').trim(),
        description: rawDescription,
      };
      currentSection[currentSubsection].push(entry);
    }
  }

  return sections;
}

export function formatUpgradeGuidance(guidance: UpgradeGuidance): string {
  const { fromVersion, toVersion, sections, hasBreakingChanges } = guidance;

  const totalFeatures = sections.reduce((sum, s) => sum + s.features.length, 0);
  const totalBugFixes = sections.reduce((sum, s) => sum + s.bugFixes.length, 0);
  const totalBreaking = sections.reduce((sum, s) => sum + s.breakingChanges.length, 0);

  const lines: string[] = [
    `# UI5 Web Components Upgrade Guide: v${fromVersion} → v${toVersion}`,
    '',
    '## Summary',
    '',
    `- **Versions analyzed:** ${sections.map(s => `v${s.version}`).join(', ')}`,
    `- **Breaking changes:** ${totalBreaking}`,
    `- **New features:** ${totalFeatures}`,
    `- **Bug fixes:** ${totalBugFixes}`,
    '',
  ];

  if (!hasBreakingChanges) {
    lines.push('> No breaking changes found in this range. This upgrade should be safe.\n');
  }

  // Breaking changes section
  const sectionsWithBreaking = sections.filter(s => s.breakingChanges.length > 0);
  if (sectionsWithBreaking.length > 0) {
    lines.push('## Breaking Changes\n');
    for (const section of sectionsWithBreaking) {
      lines.push(`### v${section.version} (${section.date})\n`);
      // Group by component
      const byComponent = new Map<string, string[]>();
      for (const entry of section.breakingChanges) {
        const existing = byComponent.get(entry.component) ?? [];
        existing.push(entry.description);
        byComponent.set(entry.component, existing);
      }
      for (const [component, descriptions] of byComponent) {
        lines.push(`**${component}**`);
        for (const desc of descriptions) {
          lines.push(`- ${desc}`);
        }
        lines.push('');
      }
    }
  }

  // Features section
  const sectionsWithFeatures = sections.filter(s => s.features.length > 0);
  if (sectionsWithFeatures.length > 0) {
    lines.push('## New Features\n');
    for (const section of sectionsWithFeatures) {
      lines.push(`### v${section.version} (${section.date})\n`);
      for (const entry of section.features) {
        lines.push(`- **${entry.component}:** ${entry.description}`);
      }
      lines.push('');
    }
  }

  // Migration checklist — one item per unique component with breaking changes
  if (hasBreakingChanges) {
    const affectedComponents = new Set<string>();
    for (const section of sections) {
      for (const entry of section.breakingChanges) {
        affectedComponents.add(entry.component);
      }
    }

    lines.push('## Migration Checklist\n');
    lines.push('Review and update each affected component in your codebase:\n');
    for (const component of affectedComponents) {
      lines.push(`- [ ] Update usage of \`${component}\``);
    }
    lines.push('');
  }

  return lines.join('\n');
}
