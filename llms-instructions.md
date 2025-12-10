# Instructions for Generating llms.txt Entries

This document explains how to generate entries for the `docs/llms.txt` file. These instructions can be given to an LLM to automate the documentation indexing process.

## Format

Each entry follows this pattern:

```
- [Title](path): Brief description of topic [line_start-line_end], next topic [line_start-line_end]
```

## Rules

### 1. Read All Files in Target Folder

Read each markdown file in the specified folder. Skip README.md files as they're typically just navigation.

### 2. Determine File Size

- **Small files (<80 lines)**: Write a brief summary WITHOUT line ranges
- **Large files (≥80 lines)**: Break down by major sections WITH line ranges

### 3. Create Title

Extract the title from the first heading (# Title) in the markdown file. Clean it up by removing special characters if needed.

### 4. Write Description

For small files:
```
- [Title](docs/folder/file.md): Brief description covering the main topics
```

For large files, identify 3-7 major sections and add line ranges:
```
- [Title](docs/folder/file.md): Topic 1 [1-50], Topic 2 [52-120], Topic 3 [122-200]
```

### 5. Keep Descriptions Focused

- Write what an LLM needs to know to use this doc
- Focus on actionable information
- Keep it under 150 characters per section description
- Use commas to separate topics, not "and"

## Examples

### Small File Example

```markdown
- [RTL and Compact Mode](docs/2-advanced/02-RTL-and-compact-mode.md): Setting RTL mode and changing it dynamically, compact mode setup
```

### Large File Example

```markdown
- [Configuration](docs/2-advanced/01-configuration.md): All available configuration settings [5-23], theme configuration [24-69], language configuration [70-109], animation modes [111-123], calendar types [124-155], noConflict setting [156-180]
```

### Very Large File Example (Migration Guide)

For huge files (>1000 lines), group by major categories:

```markdown
- [Migration to V2](docs/6-migration-guides/01-to-version-2.md): Base library changes [9-225], theming changes [226-239], main package component migrations [240-2423], fiori package changes [2424-2875], icons changes [2877-2901]
```

## Line Range Guidelines

When adding line ranges:

1. **Scan the file** to identify major sections (look for ## headings)
2. **Note the line numbers** where each section starts
3. **Group related subsections** together (don't be too granular)
4. **Use ranges that make sense** - aim for 20-200 lines per range
5. **Check boundaries** - make sure ranges don't overlap

## Process for a Folder

1. List all .md files in the folder (excluding README.md)
2. For each file:
   - Read the file
   - Count total lines
   - If < 80 lines: write summary only
   - If ≥ 80 lines: identify sections with line ranges
3. Format each entry following the pattern above
4. Separate entries with a blank line

## Output Format

Return entries as plain text, one per file:

```
- [First Steps](docs/1-getting-started/01-first-steps.md): Distribution model and ES6 modules, bundling requirements [1-24], creating projects with Vite, installation [26-58]

- [Components Packages](docs/1-getting-started/02-components-packages.md): Available NPM packages and how to install and import components

- [Components APIs](docs/1-getting-started/03-components-APIs.md): API categories overview [1-16], creating instances [19-36], properties and attributes [38-74]
```

## Quality Checklist

Before submitting entries, verify:

- [ ] All file paths start with `docs/`
- [ ] Titles are extracted from file content (not filenames)
- [ ] Small files have no line ranges
- [ ] Large files have 3-7 line range sections
- [ ] Line ranges are valid (start < end, within file length)
- [ ] Descriptions are clear and actionable
- [ ] No README.md files included
- [ ] Entries are separated by blank lines

## Common Mistakes to Avoid

1. **Too granular**: Don't create 15 line ranges for a 300-line file
2. **Too vague**: "Various topics" doesn't help - be specific
3. **Missing ranges**: Large files need line ranges for navigation
4. **Wrong ranges**: Always verify line numbers match actual content
5. **Including READMEs**: Skip README.md files

