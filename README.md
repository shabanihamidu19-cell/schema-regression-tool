# Schema Regression Tool

[![npm version](https://img.shields.io/npm/v/schema-regression-tool.svg)](https://www.npmjs.com/package/schema-regression-tool)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D16-brightgreen)](https://nodejs.org/)
[![CI](https://github.com/shabanihamidu19-cell/schema-regression-tool/actions/workflows/regression.yml/badge.svg)](https://github.com/shabanihamidu19-cell/schema-regression-tool/actions/workflows/regression.yml)

**Catch breaking schema changes before they reach production.**

A lightweight, focused tool that compares your current JSON/YAML schema against a stored snapshot and fails CI when breaking changes are detected. Ideal for API contracts, event schemas, configuration schemas, and any data structure that other services depend on.

## Why this exists

Silent breaking changes ship every week:

- A field is removed → downstream clients crash
- A type changes from `string` to `number` → parsing errors
- A required field becomes optional → data quality issues
- An enum value disappears → unexpected runtime behaviour

This tool turns those problems into **failing tests** in your pull requests.

## Features

- Detects **field removal**
- Detects **type changes**
- Detects **required → optional** transitions
- Detects **enum value removal**
- Supports nested objects and JSON Schema style definitions
- Additive changes (new fields) are treated as **non-breaking**
- First run automatically creates a baseline snapshot
- Works with both **JSON** and **YAML**
- Ready-to-use **GitHub Actions** workflows
- Clean CLI + programmatic API

## Installation

```bash
npm install schema-regression-tool
# or for local development
npm install
```

## Quick Start

```bash
# Place your schema (example)
# schema.json  or  schema.yaml

# First run → creates baseline snapshot
npx schema-regression schema.json
# or
npm run schema:check

# Later runs → compare against snapshot
npx schema-regression schema.json
```

If breaking changes are found the process exits with code `1` (CI will fail the job).

### Update the snapshot intentionally

When a breaking change is deliberate:

```bash
npx schema-regression schema.json --update-snapshot
# or
npm run schema:snapshot
```

## CLI Options

```
Usage: schema-regression [options] [schemaPath]

Arguments:
  schemaPath                     Path to current schema (default: "schema.json")

Options:
  -s, --snapshot-name <name>     Snapshot name (default: "schema")
  -d, --snapshots-dir <dir>      Snapshots directory (default: "snapshots")
  -u, --update-snapshot          Accept current schema as new baseline
  -q, --quiet                    Suppress detailed output
  -h, --help                     Display help
```

## Project Structure

```
schema-regression-tool/
├── src/
│   ├── loader/schemaLoader.js         # Reads & parses JSON/YAML
│   ├── storage/snapshotManager.js     # Saves / loads snapshots
│   ├── comparator/comparatorEngine.js # Detects breaking changes
│   ├── runner/testRunner.js           # Orchestrates the check
│   └── index.js                       # CLI entry point
├── tests/
│   └── schemaRegression.test.js       # Jest unit + integration tests
├── snapshots/                         # Generated schema baselines
├── .github/workflows/
│   ├── regression.yml                 # CI schema + unit tests
│   └── release.yml                    # npm publish + GitHub Release
├── package.json
└── README.md
```

## Using in your own project

1. Install the package or copy the `src/` folder.
2. Add a GitHub Action (see `.github/workflows/regression.yml`).
3. Point the action at your real schema file(s).

Example for multiple schemas:

```yaml
- name: Check user schema
  run: npx schema-regression schemas/user.json -s user

- name: Check event schema
  run: npx schema-regression schemas/event.yaml -s event
```

## Programmatic Usage

```js
const { TestRunner, ComparatorEngine } = require('schema-regression-tool');

// Full runner
const runner = new TestRunner({ snapshotName: 'api', verbose: true });
const outcome = await runner.run('./schemas/api.json');
if (!outcome.passed) {
  console.error(outcome.result.breakingChanges);
  process.exit(1);
}

// Direct comparison
const result = ComparatorEngine.compare(oldSchema, newSchema);
console.log(result.hasBreakingChanges);
console.log(result.breakingChanges);
```

## What is considered a Breaking Change?

| Change                                 | Breaking? |
|----------------------------------------|-----------|
| Field removed                          | Yes       |
| Type changed (string → number …)       | Yes       |
| Required field removed / made optional | Yes       |
| Enum value removed                     | Yes       |
| Nested field removed or type-changed   | Yes       |
| New optional field added               | No        |
| New enum value added                   | No        |
| Description / title changed            | No (ignored) |

## Releasing

This repository includes a `release.yml` workflow that:

1. Triggers on tags matching `v*.*.*` (e.g. `v1.0.0`)
2. Verifies the tag matches `package.json` version
3. Runs tests
4. Publishes to npm (requires `NPM_TOKEN` secret)
5. Creates a GitHub Release with generated notes

To release:

```bash
# bump version in package.json, commit, then
git tag v1.0.0
git push origin v1.0.0
```

## Running the tests

```bash
npm test
```

## License

MIT © KidCoder Tz

---

Built to protect developers from silent schema breakages.
