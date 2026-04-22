# Contributing to pi-quotas

Thanks for your interest in contributing! Here's how to get started.

## Development setup

```bash
git clone https://github.com/latentminds/pi-quotas.git
cd pi-quotas
npm install
```

## Scripts

| Script | Description |
|--------|-------------|
| `npm run typecheck` | Type-check without emitting |
| `npm test` | Run tests once |
| `npm run test:watch` | Run tests in watch mode |

## Making changes

1. Create a branch from `main`
2. Make your changes with tests where applicable
3. Run `npm run typecheck` and `npm test` before committing
4. Open a pull request against `main`

## Testing locally

Load all extensions into a Pi session:

```bash
pi -e ./src/extensions/command-quotas/index.ts \
   -e ./src/extensions/usage-status/index.ts \
   -e ./src/extensions/quota-warnings/index.ts
```

Or install from your local checkout:

```bash
pi install /absolute/path/to/pi-quotas
```

## Code style

- TypeScript, strict mode
- ESM modules (`"type": "module"`)
- Follow existing patterns in the codebase

## Reporting issues

Open a GitHub issue with:
- Pi version (`pi --version`)
- Steps to reproduce
- Expected vs actual behaviour
