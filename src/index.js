#!/usr/bin/env node
'use strict';

const { Command } = require('commander');
const path = require('path');
const TestRunner = require('./runner/testRunner');

const program = new Command();

program
  .name('schema-regression')
  .description('Detect breaking changes in JSON/YAML schemas')
  .version('1.0.1')
  .argument('[schemaPath]', 'Path to the current schema file (JSON or YAML)', 'schema.json')
  .option('-s, --snapshot-name <name>', 'Name of the snapshot to compare against', 'schema')
  .option('-d, --snapshots-dir <dir>', 'Directory where snapshots are stored', 'snapshots')
  .option('-u, --update-snapshot', 'Update the snapshot with the current schema (accept changes)', false)
  .option('-q, --quiet', 'Suppress verbose output', false)
  .action(async (schemaPath, options) => {
    try {
      const runner = new TestRunner({
        snapshotsDir: path.resolve(options.snapshotsDir),
        snapshotName: options.snapshotName,
        updateSnapshot: options.updateSnapshot,
        verbose: !options.quiet
      });

      const outcome = await runner.run(schemaPath);

      if (!outcome.passed) {
        process.exitCode = 1;
      }
    } catch (err) {
      console.error('\n✖ Error:', err.message);
      process.exitCode = 1;
    }
  });

// Also export for programmatic use
module.exports = {
  TestRunner,
  SchemaLoader: require('./loader/schemaLoader'),
  SnapshotManager: require('./storage/snapshotManager'),
  ComparatorEngine: require('./comparator/comparatorEngine')
};

// Run only when executed directly
if (require.main === module) {
  program.parse(process.argv);
}
