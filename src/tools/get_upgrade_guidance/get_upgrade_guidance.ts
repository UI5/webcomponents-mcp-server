import { z } from 'zod';
import { createTextResponse, handleToolError } from '../../utils.js';
import type { UpgradeGuidance } from '../../types.js';
import {
  fetchChangelog,
  parseChangelogRange,
  formatUpgradeGuidance,
  resolveLatestVersion,
  compareSemver,
} from './changelog_processor.js';

const VERSION_RE = /^[\da-zA-Z.-]+$/;

type GetUpgradeGuidancePayload = {
  fromVersion: string;
  toVersion?: string;
};

export const getUpgradeGuidanceTool = {
  name: 'get_upgrade_guidance',
  description:
    'Get upgrade guidance and breaking change summary for UI5 Web Components between two versions. Fetches the CHANGELOG from GitHub and returns a structured migration guide.',
  inputSchema: {
    fromVersion: z
      .string()
      .describe('Starting version to upgrade from (e.g., "2.6.0")'),
    toVersion: z
      .string()
      .optional()
      .default('latest')
      .describe('Target version to upgrade to (e.g., "2.8.0" or "latest")'),
  },
  handler: async ({ fromVersion, toVersion = 'latest' }: GetUpgradeGuidancePayload) => {
    try {
      if (!VERSION_RE.test(fromVersion)) {
        return createTextResponse(
          `Access denied: fromVersion "${fromVersion}" contains invalid characters. Use a semver string (e.g., "2.6.0").`
        );
      }
      if (!VERSION_RE.test(toVersion)) {
        return createTextResponse(
          `Access denied: toVersion "${toVersion}" contains invalid characters. Use a semver string (e.g., "2.8.0") or "latest".`
        );
      }

      let resolvedToVersion = toVersion;
      if (toVersion === 'latest') {
        const latest = await resolveLatestVersion();
        if (!latest) {
          return createTextResponse(
            'Could not resolve latest version from npm registry. Please specify an explicit version.'
          );
        }
        resolvedToVersion = latest;
      }

      if (compareSemver(fromVersion, resolvedToVersion) >= 0) {
        return createTextResponse(
          `fromVersion "${fromVersion}" must be less than toVersion "${resolvedToVersion}".`
        );
      }

      const changelog = await fetchChangelog();
      if (!changelog) {
        return createTextResponse(
          'Could not fetch the UI5 Web Components CHANGELOG from GitHub. ' +
            'Please try again or check https://github.com/SAP/ui5-webcomponents/blob/main/CHANGELOG.md'
        );
      }

      const sections = parseChangelogRange(changelog, fromVersion, resolvedToVersion);

      if (sections.length === 0) {
        return createTextResponse(
          `No changelog entries found between v${fromVersion} and v${resolvedToVersion}. ` +
            'The versions may not exist in the current CHANGELOG (which covers recent releases only). ' +
            'For older version history, see https://github.com/SAP/ui5-webcomponents/blob/main/CHANGELOG.md'
        );
      }

      const guidance: UpgradeGuidance = {
        fromVersion,
        toVersion: resolvedToVersion,
        sections,
        hasBreakingChanges: sections.some(s => s.breakingChanges.length > 0),
      };

      return createTextResponse(formatUpgradeGuidance(guidance));
    } catch (error) {
      return handleToolError(error, 'Error retrieving upgrade guidance');
    }
  },
};
