# Contributing

Thanks for contributing to Git Config User Profiles.

## Development

Use Node.js 24.x and run these commands from the repository root:

```bash
npm ci
npm run compile
npm run lint
npm test
```

These are the same checks run by continuous integration. To verify that the extension can be packaged as a VSIX, also run:

```bash
npm run package
```

Keep changes focused, add or update tests for behavioral changes, and update the README or changelog when user-facing behavior changes. Ensure the compile, lint, and test commands pass before submitting a pull request.

## AI-Assisted Development

AI-assisted tools may be used during implementation, testing, and code review. Contributors and maintainers remain responsible for understanding, reviewing, and validating all submitted changes.
