import anyTest, { TestFn } from 'ava';
import {
  compareSemver,
  parseChangelogRange,
  formatUpgradeGuidance,
} from '../../src/tools/get_upgrade_guidance/changelog_processor.js';
import type { UpgradeGuidance } from '../../src/types.js';

const test = anyTest as TestFn;

// Minimal fixture CHANGELOG string for unit tests
const FIXTURE_CHANGELOG = `# Change Log

# [2.21.0](https://github.com/UI5/webcomponents/compare/v2.20.0...v2.21.0) (2024-04-01)


### Bug Fixes

* **ui5-input:** fix placeholder overlap ([#100](https://github.com/UI5/webcomponents/issues/100)) ([abc1234](https://github.com/UI5/webcomponents/commit/abc1234))


### Features

* **ui5-table:** add sticky columns support ([#101](https://github.com/UI5/webcomponents/issues/101)) ([def5678](https://github.com/UI5/webcomponents/commit/def5678))


### BREAKING CHANGES

* **ui5-button:** The \`design\` property default changed from \`Default\` to \`Transparent\` ([#102](https://github.com/UI5/webcomponents/issues/102)) ([fed9012](https://github.com/UI5/webcomponents/commit/fed9012))


# [2.20.0](https://github.com/UI5/webcomponents/compare/v2.19.0...v2.20.0) (2024-03-15)


### Bug Fixes

* **ui5-dialog:** fix scroll behavior on iOS ([#90](https://github.com/UI5/webcomponents/issues/90)) ([111aaaa](https://github.com/UI5/webcomponents/commit/111aaaa))


### Features

* **ui5-avatar:** add initials support ([#91](https://github.com/UI5/webcomponents/issues/91)) ([222bbbb](https://github.com/UI5/webcomponents/commit/222bbbb))


# [2.19.0](https://github.com/UI5/webcomponents/compare/v2.18.0...v2.19.0) (2024-02-28)


### Bug Fixes

* **ui5-select:** fix dropdown alignment ([#80](https://github.com/UI5/webcomponents/issues/80)) ([333cccc](https://github.com/UI5/webcomponents/commit/333cccc))
`;

// --- compareSemver tests ---

test('compareSemver: 2.7.0 > 2.6.0', t => {
  t.true(compareSemver('2.7.0', '2.6.0') > 0);
});

test('compareSemver: 2.6.1 > 2.6.0', t => {
  t.true(compareSemver('2.6.1', '2.6.0') > 0);
});

test('compareSemver: 2.6.0 < 2.7.0', t => {
  t.true(compareSemver('2.6.0', '2.7.0') < 0);
});

test('compareSemver: equal versions return 0', t => {
  t.is(compareSemver('2.6.0', '2.6.0'), 0);
});

test('compareSemver: pre-release 2.0.0-rc.1 < 2.0.0', t => {
  t.true(compareSemver('2.0.0-rc.1', '2.0.0') < 0);
});

test('compareSemver: pre-release 2.0.0 > 2.0.0-rc.4', t => {
  t.true(compareSemver('2.0.0', '2.0.0-rc.4') > 0);
});

test('compareSemver: pre-release ordering by string: rc.1 < rc.2', t => {
  t.true(compareSemver('2.0.0-rc.1', '2.0.0-rc.2') < 0);
});

test('compareSemver: major version difference dominates', t => {
  t.true(compareSemver('3.0.0', '2.99.99') > 0);
});

// --- parseChangelogRange tests ---

test('parseChangelogRange: extracts versions within range', t => {
  const sections = parseChangelogRange(FIXTURE_CHANGELOG, '2.19.0', '2.21.0');
  t.is(sections.length, 2);
  t.is(sections[0]!.version, '2.21.0');
  t.is(sections[1]!.version, '2.20.0');
});

test('parseChangelogRange: excludes fromVersion (exclusive lower bound)', t => {
  const sections = parseChangelogRange(FIXTURE_CHANGELOG, '2.19.0', '2.21.0');
  const versions = sections.map(s => s.version);
  t.false(versions.includes('2.19.0'));
});

test('parseChangelogRange: includes toVersion (inclusive upper bound)', t => {
  const sections = parseChangelogRange(FIXTURE_CHANGELOG, '2.19.0', '2.21.0');
  const versions = sections.map(s => s.version);
  t.true(versions.includes('2.21.0'));
});

test('parseChangelogRange: returns empty array when no versions in range', t => {
  const sections = parseChangelogRange(FIXTURE_CHANGELOG, '2.21.0', '2.22.0');
  t.is(sections.length, 0);
});

test('parseChangelogRange: returns empty array when range is below available history', t => {
  const sections = parseChangelogRange(FIXTURE_CHANGELOG, '1.0.0', '1.5.0');
  t.is(sections.length, 0);
});

test('parseChangelogRange: parses breaking changes into correct section', t => {
  const sections = parseChangelogRange(FIXTURE_CHANGELOG, '2.20.0', '2.21.0');
  t.is(sections.length, 1);
  t.is(sections[0]!.breakingChanges.length, 1);
  t.is(sections[0]!.breakingChanges[0]!.component, 'ui5-button');
});

test('parseChangelogRange: parses component name from bold prefix', t => {
  const sections = parseChangelogRange(FIXTURE_CHANGELOG, '2.20.0', '2.21.0');
  t.is(sections[0]!.features[0]!.component, 'ui5-table');
});

test('parseChangelogRange: strips trailing PR/commit links from description', t => {
  const sections = parseChangelogRange(FIXTURE_CHANGELOG, '2.20.0', '2.21.0');
  const desc = sections[0]!.bugFixes[0]!.description;
  t.false(desc.includes('(#100)'));
  t.false(desc.includes('abc1234'));
  t.true(desc.includes('fix placeholder overlap'));
});

test('parseChangelogRange: handles version section with no BREAKING CHANGES subsection', t => {
  const sections = parseChangelogRange(FIXTURE_CHANGELOG, '2.19.0', '2.20.0');
  t.is(sections.length, 1);
  t.is(sections[0]!.breakingChanges.length, 0);
});

test('parseChangelogRange: parses date correctly', t => {
  const sections = parseChangelogRange(FIXTURE_CHANGELOG, '2.20.0', '2.21.0');
  t.is(sections[0]!.date, '2024-04-01');
});

test('parseChangelogRange: single-version range returns one section', t => {
  const sections = parseChangelogRange(FIXTURE_CHANGELOG, '2.20.0', '2.21.0');
  t.is(sections.length, 1);
  t.is(sections[0]!.version, '2.21.0');
});

// --- formatUpgradeGuidance tests ---

const makeGuidance = (overrides: Partial<UpgradeGuidance> = {}): UpgradeGuidance => ({
  fromVersion: '2.20.0',
  toVersion: '2.21.0',
  sections: [
    {
      version: '2.21.0',
      date: '2024-04-01',
      breakingChanges: [{ component: 'ui5-button', description: 'Design default changed' }],
      features: [{ component: 'ui5-table', description: 'Sticky columns added' }],
      bugFixes: [{ component: 'ui5-input', description: 'Placeholder overlap fixed' }],
    },
  ],
  hasBreakingChanges: true,
  ...overrides,
});

test('formatUpgradeGuidance: includes from/to version in title', t => {
  const result = formatUpgradeGuidance(makeGuidance());
  t.true(result.includes('v2.20.0 → v2.21.0'));
});

test('formatUpgradeGuidance: shows breaking changes section when present', t => {
  const result = formatUpgradeGuidance(makeGuidance());
  t.true(result.includes('## Breaking Changes'));
  t.true(result.includes('ui5-button'));
});

test('formatUpgradeGuidance: shows "no breaking changes" message when none', t => {
  const guidance = makeGuidance({
    sections: [{ version: '2.21.0', date: '2024-04-01', breakingChanges: [], features: [], bugFixes: [] }],
    hasBreakingChanges: false,
  });
  const result = formatUpgradeGuidance(guidance);
  t.true(result.includes('No breaking changes found'));
  t.false(result.includes('## Breaking Changes'));
});

test('formatUpgradeGuidance: generates migration checklist', t => {
  const result = formatUpgradeGuidance(makeGuidance());
  t.true(result.includes('## Migration Checklist'));
  t.true(result.includes('- [ ] Update usage of `ui5-button`'));
});

test('formatUpgradeGuidance: includes summary counts', t => {
  const result = formatUpgradeGuidance(makeGuidance());
  t.true(result.includes('**Breaking changes:** 1'));
  t.true(result.includes('**New features:** 1'));
  t.true(result.includes('**Bug fixes:** 1'));
});

test('formatUpgradeGuidance: shows features section', t => {
  const result = formatUpgradeGuidance(makeGuidance());
  t.true(result.includes('## New Features'));
  t.true(result.includes('ui5-table'));
});

test('formatUpgradeGuidance: no migration checklist when no breaking changes', t => {
  const guidance = makeGuidance({
    sections: [{ version: '2.21.0', date: '2024-04-01', breakingChanges: [], features: [], bugFixes: [] }],
    hasBreakingChanges: false,
  });
  const result = formatUpgradeGuidance(guidance);
  t.false(result.includes('## Migration Checklist'));
});
