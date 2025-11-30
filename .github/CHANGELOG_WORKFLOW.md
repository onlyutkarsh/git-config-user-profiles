# Changelog Workflow

This project uses automated changelog generation based on [Conventional Commits](https://www.conventionalcommits.org/).

## How It Works

### Automatic Updates (CI)
- **On every push to `main`**: The `update-changelog.yml` workflow automatically updates `CHANGELOG.md`
- Changes are committed back with `[skip ci]` to avoid infinite loops
- You can review and edit the changelog at any time before release

### Manual Updates (Local)
You can generate/update the changelog locally:

```bash
# Add new entries since last release (incremental)
npm run changelog

# Regenerate entire changelog from all commits
npm run changelog:all
```

## Commit Message Format

Use [Conventional Commits](https://www.conventionalcommits.org/) format for your commits:

### Format
```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types
- **feat**: New feature (appears in changelog)
- **fix**: Bug fix (appears in changelog)
- **docs**: Documentation changes
- **style**: Code style changes (formatting, etc.)
- **refactor**: Code refactoring
- **perf**: Performance improvements
- **test**: Adding or updating tests
- **chore**: Build process or auxiliary tool changes

### Examples
```bash
feat: add support for workspace-scoped profile selection
fix: resolve flickering issue with multiple editors
docs: update README with new tooltip states
chore(deps): update typescript to 5.3.3
```

## Release Process

1. **Before Release**: Review and edit `CHANGELOG.md`
   - The file is automatically updated on each merge to main
   - You can manually edit it to improve descriptions or add notes
   - Add any important breaking changes or migration notes

2. **During Release**:
   - The release workflow will use the version you specify
   - GitHub release notes will be auto-generated from commits
   - The CHANGELOG.md already has all the changes accumulated

3. **After Release**:
   - Optionally, you can manually add a version header to CHANGELOG.md if needed

## Editing the Changelog

Feel free to manually edit `CHANGELOG.md` at any time:
- Improve commit descriptions
- Add additional context or examples
- Reorganize entries for clarity
- Add migration guides for breaking changes

The automated workflow will preserve your manual edits and only add new entries.

## Workflow Files

- `.github/workflows/update-changelog.yml` - Auto-updates changelog on push to main
- `package.json` - Contains `changelog` and `changelog:all` scripts for local use
