'use strict';

const fs = require('fs');
const path = require('path');

/**
 * SnapshotManager
 * Handles reading and writing schema snapshots for regression comparison.
 */
class SnapshotManager {
  /**
   * @param {string} snapshotsDir - Directory where snapshots are stored
   */
  constructor(snapshotsDir = path.join(process.cwd(), 'snapshots')) {
    this.snapshotsDir = path.resolve(snapshotsDir);
    this._ensureDir();
  }

  _ensureDir() {
    if (!fs.existsSync(this.snapshotsDir)) {
      fs.mkdirSync(this.snapshotsDir, { recursive: true });
    }
  }

  /**
   * Get the path for a named snapshot.
   * @param {string} name - Snapshot name (e.g. "schema_v1" or "api")
   * @returns {string}
   */
  getSnapshotPath(name = 'schema') {
    // Sanitize name
    const safeName = name.replace(/[^a-zA-Z0-9_-]/g, '_');
    return path.join(this.snapshotsDir, `${safeName}.json`);
  }

  /**
   * Check if a snapshot exists.
   * @param {string} name
   * @returns {boolean}
   */
  exists(name = 'schema') {
    return fs.existsSync(this.getSnapshotPath(name));
  }

  /**
   * Load an existing snapshot.
   * @param {string} name
   * @returns {object|null}
   */
  load(name = 'schema') {
    const snapshotPath = this.getSnapshotPath(name);

    if (!fs.existsSync(snapshotPath)) {
      return null;
    }

    try {
      const raw = fs.readFileSync(snapshotPath, 'utf8');
      return JSON.parse(raw);
    } catch (err) {
      throw new Error(`Failed to load snapshot ${snapshotPath}: ${err.message}`);
    }
  }

  /**
   * Save a schema as a snapshot (overwrites if exists).
   * @param {object} schema
   * @param {string} name
   * @returns {string} Path where snapshot was written
   */
  save(schema, name = 'schema') {
    this._ensureDir();
    const snapshotPath = this.getSnapshotPath(name);

    const payload = {
      savedAt: new Date().toISOString(),
      schema
    };

    fs.writeFileSync(snapshotPath, JSON.stringify(payload, null, 2), 'utf8');
    return snapshotPath;
  }

  /**
   * List all available snapshot names.
   * @returns {string[]}
   */
  list() {
    this._ensureDir();
    return fs
      .readdirSync(this.snapshotsDir)
      .filter((f) => f.endsWith('.json'))
      .map((f) => path.basename(f, '.json'));
  }

  /**
   * Delete a snapshot.
   * @param {string} name
   */
  delete(name = 'schema') {
    const snapshotPath = this.getSnapshotPath(name);
    if (fs.existsSync(snapshotPath)) {
      fs.unlinkSync(snapshotPath);
    }
  }
}

module.exports = SnapshotManager;
