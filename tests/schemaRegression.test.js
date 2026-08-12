'use strict';

const path = require('path');
const fs = require('fs');
const os = require('os');

const SchemaLoader = require('../src/loader/schemaLoader');
const SnapshotManager = require('../src/storage/snapshotManager');
const ComparatorEngine = require('../src/comparator/comparatorEngine');
const TestRunner = require('../src/runner/testRunner');

describe('SchemaLoader', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'schema-loader-'));

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('loads JSON schema correctly', () => {
    const file = path.join(tmpDir, 'test.json');
    fs.writeFileSync(file, JSON.stringify({ type: 'object', properties: { id: { type: 'string' } } }));

    const schema = SchemaLoader.loadFromFile(file);
    expect(schema.type).toBe('object');
    expect(schema.properties.id.type).toBe('string');
  });

  test('loads YAML schema correctly', () => {
    const file = path.join(tmpDir, 'test.yaml');
    fs.writeFileSync(
      file,
      `
type: object
properties:
  name:
    type: string
required:
  - name
`
    );

    const schema = SchemaLoader.loadFromFile(file);
    expect(schema.type).toBe('object');
    expect(schema.required).toEqual(['name']);
  });

  test('throws on missing file', () => {
    expect(() => SchemaLoader.loadFromFile(path.join(tmpDir, 'nope.json'))).toThrow(/not found/);
  });
});

describe('SnapshotManager', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'snapshot-mgr-'));

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('creates and loads a snapshot', () => {
    const mgr = new SnapshotManager(tmpDir);
    const schema = { type: 'object', properties: { a: { type: 'number' } } };

    expect(mgr.exists('demo')).toBe(false);

    const savedPath = mgr.save(schema, 'demo');
    expect(fs.existsSync(savedPath)).toBe(true);
    expect(mgr.exists('demo')).toBe(true);

    const loaded = mgr.load('demo');
    expect(loaded.schema).toEqual(schema);
    expect(loaded.savedAt).toBeDefined();
  });

  test('lists snapshots', () => {
    const mgr = new SnapshotManager(tmpDir);
    mgr.save({ foo: 1 }, 'one');
    mgr.save({ bar: 2 }, 'two');

    const list = mgr.list();
    expect(list).toEqual(expect.arrayContaining(['one', 'two']));
  });
});

describe('ComparatorEngine – Breaking Changes', () => {
  test('detects removed field', () => {
    const oldSchema = {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' }
      },
      required: ['id', 'name']
    };

    const newSchema = {
      type: 'object',
      properties: {
        id: { type: 'string' }
      },
      required: ['id']
    };

    const result = ComparatorEngine.compare(oldSchema, newSchema);
    expect(result.hasBreakingChanges).toBe(true);
    expect(result.breakingChanges.some((c) => c.type === 'FIELD_REMOVED' && c.path === 'name')).toBe(true);
  });

  test('detects type change', () => {
    const oldSchema = {
      type: 'object',
      properties: {
        age: { type: 'string' }
      }
    };

    const newSchema = {
      type: 'object',
      properties: {
        age: { type: 'number' }
      }
    };

    const result = ComparatorEngine.compare(oldSchema, newSchema);
    expect(result.hasBreakingChanges).toBe(true);
    expect(result.breakingChanges.some((c) => c.type === 'TYPE_CHANGED')).toBe(true);
  });

  test('detects required field made optional', () => {
    const oldSchema = {
      type: 'object',
      properties: {
        email: { type: 'string' }
      },
      required: ['email']
    };

    const newSchema = {
      type: 'object',
      properties: {
        email: { type: 'string' }
      },
      required: []
    };

    const result = ComparatorEngine.compare(oldSchema, newSchema);
    expect(result.hasBreakingChanges).toBe(true);
    expect(result.breakingChanges.some((c) => c.type === 'REQUIRED_REMOVED')).toBe(true);
  });

  test('detects enum value removal', () => {
    const oldSchema = {
      type: 'string',
      enum: ['active', 'inactive', 'pending']
    };

    const newSchema = {
      type: 'string',
      enum: ['active', 'inactive']
    };

    const result = ComparatorEngine.compare(oldSchema, newSchema);
    expect(result.hasBreakingChanges).toBe(true);
    expect(result.breakingChanges.some((c) => c.type === 'ENUM_VALUE_REMOVED')).toBe(true);
  });

  test('allows additive (non-breaking) changes', () => {
    const oldSchema = {
      type: 'object',
      properties: {
        id: { type: 'string' }
      },
      required: ['id']
    };

    const newSchema = {
      type: 'object',
      properties: {
        id: { type: 'string' },
        createdAt: { type: 'string', format: 'date-time' }
      },
      required: ['id']
    };

    const result = ComparatorEngine.compare(oldSchema, newSchema);
    expect(result.hasBreakingChanges).toBe(false);
    expect(result.nonBreakingChanges.some((c) => c.type === 'FIELD_ADDED')).toBe(true);
  });

  test('handles nested objects', () => {
    const oldSchema = {
      type: 'object',
      properties: {
        user: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            email: { type: 'string' }
          },
          required: ['id', 'email']
        }
      }
    };

    const newSchema = {
      type: 'object',
      properties: {
        user: {
          type: 'object',
          properties: {
            id: { type: 'string' }
          },
          required: ['id']
        }
      }
    };

    const result = ComparatorEngine.compare(oldSchema, newSchema);
    expect(result.hasBreakingChanges).toBe(true);
    expect(result.breakingChanges.some((c) => c.path.includes('user.email'))).toBe(true);
  });
});

describe('TestRunner (integration)', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-runner-'));
  const schemaPath = path.join(tmpDir, 'current.json');

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('creates baseline on first run', async () => {
    const schema = {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id']
    };
    fs.writeFileSync(schemaPath, JSON.stringify(schema));

    const runner = new TestRunner({
      snapshotsDir: path.join(tmpDir, 'snaps'),
      snapshotName: 'api',
      verbose: false
    });

    const outcome = await runner.run(schemaPath);
    expect(outcome.passed).toBe(true);
    expect(outcome.isBaseline).toBe(true);
  });

  test('fails on breaking change', async () => {
    // First create baseline
    const baseSchema = {
      type: 'object',
      properties: {
        id: { type: 'string' },
        status: { type: 'string' }
      },
      required: ['id', 'status']
    };
    fs.writeFileSync(schemaPath, JSON.stringify(baseSchema));

    const snapsDir = path.join(tmpDir, 'snaps2');
    const runner1 = new TestRunner({
      snapshotsDir: snapsDir,
      snapshotName: 'api',
      verbose: false
    });
    await runner1.run(schemaPath);

    // Now introduce a breaking change
    const brokenSchema = {
      type: 'object',
      properties: {
        id: { type: 'string' }
        // status removed
      },
      required: ['id']
    };
    fs.writeFileSync(schemaPath, JSON.stringify(brokenSchema));

    const runner2 = new TestRunner({
      snapshotsDir: snapsDir,
      snapshotName: 'api',
      verbose: false
    });

    const outcome = await runner2.run(schemaPath);
    expect(outcome.passed).toBe(false);
    expect(outcome.result.breakingChanges.length).toBeGreaterThan(0);
  });
});
