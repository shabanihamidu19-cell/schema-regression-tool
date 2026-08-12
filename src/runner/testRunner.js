'use strict';

const chalk = require('chalk');
const SchemaLoader = require('../loader/schemaLoader');
const SnapshotManager = require('../storage/snapshotManager');
const ComparatorEngine = require('../comparator/comparatorEngine');

/**
 * TestRunner
 * Orchestrates loading, comparing, and reporting schema regression results.
 * Can be used both programmatically and from CLI / Jest.
 */
class TestRunner {
  /**
   * @param {object} options
   * @param {string} [options.snapshotsDir]
   * @param {string} [options.snapshotName]
   * @param {boolean} [options.updateSnapshot]
   * @param {boolean} [options.verbose]
   */
  constructor(options = {}) {
    this.snapshotsDir = options.snapshotsDir;
    this.snapshotName = options.snapshotName || 'schema';
    this.updateSnapshot = options.updateSnapshot || false;
    this.verbose = options.verbose !== false;

    this.snapshotManager = new SnapshotManager(this.snapshotsDir);
  }

  /**
   * Run regression check against a schema file.
   * @param {string} schemaPath - Path to current schema file
   * @returns {Promise<{passed: boolean, result: object, message: string}>}
   */
  async run(schemaPath) {
    const currentSchema = SchemaLoader.loadFromFile(schemaPath);
    const normalized = SchemaLoader.normalize(currentSchema);

    // First run → create baseline
    if (!this.snapshotManager.exists(this.snapshotName)) {
      const savedPath = this.snapshotManager.save(normalized, this.snapshotName);

      if (this.verbose) {
        console.log(chalk.green('✔ No previous snapshot found.'));
        console.log(chalk.green(`  Created baseline snapshot → ${savedPath}`));
      }

      return {
        passed: true,
        isBaseline: true,
        message: 'Baseline snapshot created successfully',
        result: null
      };
    }

    // Update mode
    if (this.updateSnapshot) {
      const savedPath = this.snapshotManager.save(normalized, this.snapshotName);

      if (this.verbose) {
        console.log(chalk.yellow('⚠ Snapshot updated (breaking changes will be accepted).'));
        console.log(chalk.yellow(`  New snapshot → ${savedPath}`));
      }

      return {
        passed: true,
        isUpdated: true,
        message: 'Snapshot updated successfully',
        result: null
      };
    }

    // Compare
    const snapshotData = this.snapshotManager.load(this.snapshotName);
    const oldSchema = snapshotData.schema;

    const result = ComparatorEngine.compare(oldSchema, normalized);

    if (result.hasBreakingChanges) {
      if (this.verbose) {
        this._printFailure(result);
      }

      return {
        passed: false,
        message: `Found ${result.breakingChanges.length} breaking change(s)`,
        result
      };
    }

    if (this.verbose) {
      this._printSuccess(result);
    }

    return {
      passed: true,
      message: 'No breaking changes detected',
      result
    };
  }

  /**
   * Run comparison between two in-memory schemas (useful for unit tests).
   * @param {object} oldSchema
   * @param {object} newSchema
   * @returns {object}
   */
  static compareSchemas(oldSchema, newSchema) {
    return ComparatorEngine.compare(oldSchema, newSchema);
  }

  _printFailure(result) {
    console.log('');
    console.log(chalk.red.bold('✖ Schema Regression FAILED'));
    console.log(chalk.red(`  ${result.breakingChanges.length} breaking change(s) detected:\n`));

    result.breakingChanges.forEach((change, index) => {
      console.log(chalk.red(`  ${index + 1}. [${change.type}] ${change.path}`));
      console.log(chalk.red(`     ${change.message}`));
      if (change.oldType && change.newType) {
        console.log(chalk.gray(`     ${change.oldType} → ${change.newType}`));
      }
      console.log('');
    });

    if (result.nonBreakingChanges.length > 0) {
      console.log(chalk.cyan(`  (Also found ${result.nonBreakingChanges.length} non-breaking change(s))`));
    }

    console.log(chalk.yellow('\n  Tip: If these changes are intentional, run with --update-snapshot'));
    console.log('');
  }

  _printSuccess(result) {
    console.log('');
    console.log(chalk.green.bold('✔ Schema Regression PASSED'));
    console.log(chalk.green('  No breaking changes detected.'));

    if (result.nonBreakingChanges && result.nonBreakingChanges.length > 0) {
      console.log(chalk.cyan(`\n  Non-breaking changes (${result.nonBreakingChanges.length}):`));
      result.nonBreakingChanges.slice(0, 5).forEach((c) => {
        console.log(chalk.cyan(`    + ${c.path} — ${c.message}`));
      });
      if (result.nonBreakingChanges.length > 5) {
        console.log(chalk.cyan(`    ... and ${result.nonBreakingChanges.length - 5} more`));
      }
    }
    console.log('');
  }
}

module.exports = TestRunner;
