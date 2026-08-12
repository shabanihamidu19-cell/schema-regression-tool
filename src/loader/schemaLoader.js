'use strict';

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

/**
 * SchemaLoader
 * Responsible for reading and parsing schema files (JSON or YAML).
 */
class SchemaLoader {
  /**
   * Load a schema from a file path.
   * @param {string} filePath - Absolute or relative path to the schema file
   * @returns {object} Parsed schema object
   */
  static loadFromFile(filePath) {
    if (!filePath) {
      throw new Error('Schema file path is required');
    }

    const absolutePath = path.resolve(filePath);

    if (!fs.existsSync(absolutePath)) {
      throw new Error(`Schema file not found: ${absolutePath}`);
    }

    const raw = fs.readFileSync(absolutePath, 'utf8');
    const ext = path.extname(absolutePath).toLowerCase();

    try {
      if (ext === '.yaml' || ext === '.yml') {
        return yaml.load(raw);
      }

      // Default to JSON (also accepts .json or files without extension that contain JSON)
      return JSON.parse(raw);
    } catch (err) {
      throw new Error(`Failed to parse schema at ${absolutePath}: ${err.message}`);
    }
  }

  /**
   * Load schema from a raw string (useful for API / in-memory use).
   * @param {string} content - Raw JSON or YAML string
   * @param {'json'|'yaml'} format - Format of the content
   * @returns {object}
   */
  static loadFromString(content, format = 'json') {
    if (!content || typeof content !== 'string') {
      throw new Error('Schema content must be a non-empty string');
    }

    try {
      if (format === 'yaml' || format === 'yml') {
        return yaml.load(content);
      }
      return JSON.parse(content);
    } catch (err) {
      throw new Error(`Failed to parse schema string: ${err.message}`);
    }
  }

  /**
   * Normalize a schema object so comparison is consistent.
   * Currently removes $schema and other non-structural noise if present.
   * @param {object} schema
   * @returns {object}
   */
  static normalize(schema) {
    if (!schema || typeof schema !== 'object') {
      return schema;
    }

    // Shallow clone to avoid mutating original
    const normalized = { ...schema };

    // Optional: strip metadata that shouldn't affect regression
    delete normalized.$schema;
    delete normalized.$id;
    delete normalized.title;
    delete normalized.description;

    return normalized;
  }
}

module.exports = SchemaLoader;
