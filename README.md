# Schema Regression Tool

**Catch breaking schema changes before they reach production.**

This tool compares your current JSON/YAML schema against a stored snapshot and fails CI when breaking changes are detected. Perfect for API contracts, event schemas, configuration schemas, and any data structure that other services depend on.

## Why this exists

Thousands of developers ship silent breaking changes every week:

- A field is removed → downstream clients crash
- A type changes from `string` to `number` → parsing errors
- A required field becomes optional → data quality issues
- An enum value disappears → unexpected runtime behaviour

This tool turns those problems into **failing tests** in your PR.

## Features

- Detects **field removal**
- Detects **type changes**
- Detects **required → optional** transitions
- Detects **enum value removal**
- Supports nested objects and JSON Schema style definitions
- Additive changes (new fields) are treated as **non-breaking**
- First run automatically creates a baseline snapshot
- Works with both **JSON** and **YAML**
- Ready-to-use **GitHub Action**
- Clean CLI + programmatic API

## Quick Start

```bash
# 1. Install
npm install

# 2. Place your schema (example)
# schema.json  or  schema.yaml

# 3. First run → creates baseline snapshot
npm run schema:check
# or
node src/index.js schema.json

# 4. Later runs → compare against snapshot
node src/index.js schema.json
```

If breaking changes are found the process exits with code `1` (CI will fail the job).

### Update the snapshot intentionally

When a breaking change is deliberate:

```bash
node src/index.js schema.json --update-snapshot
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
│   ├── loader/schemaLoader.js        # Reads & parses JSON/YAML
│   ├── storage/snapshotManager.js    # Saves / loads snapshots
│   ├── comparator/comparatorEngine.js # Detects breaking changes
│   ├── runner/testRunner.js          # Orchestrates the check
│   └── index.js                      # CLI entry point
├── tests/
│   └── schemaRegression.test.js      # Jest unit + integration tests
├── snapshots/                        # Generated schema baselines
├── .github/workflows/regression.yml  # CI integration
├── package.json
└── README.md
```

## Using in your own project

1. Copy the `src/` folder (or publish this as a package).
2. Add a GitHub Action (see `.github/workflows/regression.yml`).
3. Point the action at your real schema file(s).

Example for multiple schemas:

```yaml
- name: Check user schema
  run: node src/index.js schemas/user.json -s user

- name: Check event schema
  run: node src/index.js schemas/event.yaml -s event
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

| Change                              | Breaking? |
|-------------------------------------|-----------|
| Field removed                       | Yes       |
| Type changed (string → number …)    | Yes       |
| Required field removed / made optional | Yes    |
| Enum value removed                  | Yes       |
| Nested field removed or type-changed| Yes       |
| New optional field added            | No        |
| New enum value added                | No        |
| Description / title changed         | No (ignored) |

## Running the tests

```bash
npm test
```

## License

MIT

---

Built to protect developers from silent schema breakages.
```
