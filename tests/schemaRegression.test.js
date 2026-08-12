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

  test('throws on missing file', () => {
    expect(() => SchemaLoader.loadFromFile(path.join(tmpDir, 'nope.json'))).toThrow(/not found/);
  });
});

describe('ComparatorEngine', () => {
  test('detects field removal as breaking', () => {
    const oldSchema = {
      type: 'object',
      properties: { id: { type: 'string' }, name: { type: 'string' } },
      required: ['id']
    };
    const newSchema = {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id']
    };

    const result = ComparatorEngine.compare(oldSchema, newSchema);
    expect(result.hasBreakingChanges).toBe(true);
    expect(result.breakingChanges.some(c => c.type === 'FIELD_REMOVED')).toBe(true);
  });

  test('treats new optional field as non-breaking', () => {
    const oldSchema = {
      type: 'object',
      properties: { id: { type: 'string' } }
    };
    const newSchema = {
      type: 'object',
      properties: { id: { type: 'string' }, email: { type: 'string' } }
    };

    const result = ComparatorEngine.compare(oldSchema, newSchema);
    expect(result.hasBreakingChanges).toBe(false);
    expect(result.nonBreakingChanges.some(c => c.type === 'FIELD_ADDED')).toBe(true);
  });

  test('detects type change as breaking', () => {
    const oldSchema = { type: 'object', properties: { age: { type: 'string' } } };
    const newSchema = { type: 'object', properties: { age: { type: 'number' } } };

    const result = ComparatorEngine.compare(oldSchema, newSchema);
    expect(result.hasBreakingChanges).toBe(true);
  });
});

describe('TestRunner', () => {
  test('creates baseline on first run', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'runner-'));
    const schemaFile = path.join(tmpDir, 'schema.json');
    fs.writeFileSync(schemaFile, JSON.stringify({ type: 'object', properties: { id: { type: 'string' } } }));

    const runner = new TestRunner({
      snapshotsDir: path.join(tmpDir, 'snapshots'),
      snapshotName: 'test',
      verbose: false
    });

    const outcome = await runner.run(schemaFile);
    expect(outcome.passed).toBe(true);
    expect(outcome.isBaseline).toBe(true);

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
