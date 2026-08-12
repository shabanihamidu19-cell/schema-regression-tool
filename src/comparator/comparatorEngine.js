'use strict';

/**
 * ComparatorEngine
 * Detects breaking changes between two schema versions.
 *
 * Breaking change rules (common for API / data contracts):
 * 1. Field removed
 * 2. Type changed (string → number, object → array, etc.)
 * 3. Required field removed / made optional (if previously required)
 * 4. Enum value removed
 * 5. Nested property removed or type-changed
 * 6. Array item type changed
 */

class ComparatorEngine {
  /**
   * Compare a new schema against a previous snapshot schema.
   * @param {object} oldSchema - Previous (baseline) schema
   * @param {object} newSchema - Current schema
   * @param {object} options
   * @returns {{ hasBreakingChanges: boolean, breakingChanges: Array, nonBreakingChanges: Array }}
   */
  static compare(oldSchema, newSchema, options = {}) {
    const {
      treatRemovedRequiredAsBreaking = true,
      treatTypeChangeAsBreaking = true,
      treatEnumRemovalAsBreaking = true,
      path = ''
    } = options;

    const breakingChanges = [];
    const nonBreakingChanges = [];

    // Handle null / undefined edge cases
    if (oldSchema == null && newSchema == null) {
      return { hasBreakingChanges: false, breakingChanges, nonBreakingChanges };
    }

    if (oldSchema == null) {
      // Completely new schema → not breaking (first version)
      return { hasBreakingChanges: false, breakingChanges, nonBreakingChanges };
    }

    if (newSchema == null) {
      breakingChanges.push({
        type: 'SCHEMA_REMOVED',
        path: path || '(root)',
        message: 'Entire schema was removed'
      });
      return { hasBreakingChanges: true, breakingChanges, nonBreakingChanges };
    }

    // If both are primitives or different top-level types
    const oldType = this._getType(oldSchema);
    const newType = this._getType(newSchema);

    if (oldType !== newType && treatTypeChangeAsBreaking) {
      // Special case: object vs properties structure
      if (!(oldType === 'object' && newType === 'object')) {
        breakingChanges.push({
          type: 'TYPE_CHANGED',
          path: path || '(root)',
          oldType,
          newType,
          message: `Type changed from "${oldType}" to "${newType}"`
        });
        return { hasBreakingChanges: true, breakingChanges, nonBreakingChanges };
      }
    }

    // JSON Schema style (has properties / type / required)
    if (this._isJsonSchemaLike(oldSchema) || this._isJsonSchemaLike(newSchema)) {
      this._compareJsonSchema(oldSchema, newSchema, path, breakingChanges, nonBreakingChanges, {
        treatRemovedRequiredAsBreaking,
        treatTypeChangeAsBreaking,
        treatEnumRemovalAsBreaking
      });
    } else {
      // Plain object / data structure comparison
      this._comparePlainObject(oldSchema, newSchema, path, breakingChanges, nonBreakingChanges, {
        treatTypeChangeAsBreaking
      });
    }

    return {
      hasBreakingChanges: breakingChanges.length > 0,
      breakingChanges,
      nonBreakingChanges
    };
  }

  static _getType(value) {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    return typeof value;
  }

  static _isJsonSchemaLike(obj) {
    if (!obj || typeof obj !== 'object') return false;
    return (
      'type' in obj ||
      'properties' in obj ||
      'required' in obj ||
      'items' in obj ||
      'enum' in obj ||
      '$ref' in obj
    );
  }

  static _compareJsonSchema(oldSchema, newSchema, currentPath, breaking, nonBreaking, opts) {
    const pathPrefix = currentPath ? `${currentPath}.` : '';

    // 1. Type change
    if (opts.treatTypeChangeAsBreaking && oldSchema.type && newSchema.type) {
      const oldTypes = Array.isArray(oldSchema.type) ? oldSchema.type : [oldSchema.type];
      const newTypes = Array.isArray(newSchema.type) ? newSchema.type : [newSchema.type];

      // If new types no longer cover old types → breaking
      const lostTypes = oldTypes.filter((t) => !newTypes.includes(t));
      if (lostTypes.length > 0) {
        breaking.push({
          type: 'TYPE_CHANGED',
          path: currentPath || '(root)',
          oldType: oldSchema.type,
          newType: newSchema.type,
          message: `Type narrowed/changed. Lost: ${lostTypes.join(', ')}`
        });
      }
    }

    // 2. Required fields
    if (opts.treatRemovedRequiredAsBreaking) {
      const oldRequired = new Set(oldSchema.required || []);
      const newRequired = new Set(newSchema.required || []);

      for (const field of oldRequired) {
        if (!newRequired.has(field)) {
          // Field was required, now it's not (or removed entirely)
          const stillExists = newSchema.properties && field in newSchema.properties;
          breaking.push({
            type: stillExists ? 'REQUIRED_REMOVED' : 'FIELD_REMOVED',
            path: `${pathPrefix}${field}`,
            message: stillExists
              ? `Field "${field}" was required and is now optional`
              : `Required field "${field}" was removed`
          });
        }
      }
    }

    // 3. Properties
    const oldProps = oldSchema.properties || {};
    const newProps = newSchema.properties || {};

    // Removed fields
    for (const key of Object.keys(oldProps)) {
      if (!(key in newProps)) {
        breaking.push({
          type: 'FIELD_REMOVED',
          path: `${pathPrefix}${key}`,
          message: `Field "${key}" was removed`
        });
      }
    }

    // Changed or new fields
    for (const key of Object.keys(newProps)) {
      const childPath = `${pathPrefix}${key}`;

      if (key in oldProps) {
        // Recurse
        const result = this.compare(oldProps[key], newProps[key], {
          ...opts,
          path: childPath
        });
        breaking.push(...result.breakingChanges);
        nonBreaking.push(...result.nonBreakingChanges);
      } else {
        // New field → non-breaking (additive)
        nonBreaking.push({
          type: 'FIELD_ADDED',
          path: childPath,
          message: `New field "${key}" added`
        });
      }
    }

    // 4. Enum values removed
    if (opts.treatEnumRemovalAsBreaking && oldSchema.enum && Array.isArray(oldSchema.enum)) {
      const newEnum = new Set(newSchema.enum || []);
      for (const value of oldSchema.enum) {
        if (!newEnum.has(value)) {
          breaking.push({
            type: 'ENUM_VALUE_REMOVED',
            path: currentPath || '(root)',
            value,
            message: `Enum value "${value}" was removed`
          });
        }
      }
    }

    // 5. Array items
    if (oldSchema.items && newSchema.items) {
      const result = this.compare(oldSchema.items, newSchema.items, {
        ...opts,
        path: `${currentPath || '(root)'}.items`
      });
      breaking.push(...result.breakingChanges);
      nonBreaking.push(...result.nonBreakingChanges);
    }
  }

  static _comparePlainObject(oldObj, newObj, currentPath, breaking, nonBreaking, opts) {
    const pathPrefix = currentPath ? `${currentPath}.` : '';

    if (typeof oldObj !== 'object' || typeof newObj !== 'object' || oldObj === null || newObj === null) {
      if (oldObj !== newObj) {
        breaking.push({
          type: 'VALUE_CHANGED',
          path: currentPath || '(root)',
          oldValue: oldObj,
          newValue: newObj,
          message: `Value changed`
        });
      }
      return;
    }

    if (Array.isArray(oldObj) || Array.isArray(newObj)) {
      // Simple array length / type check for plain data
      if (!Array.isArray(oldObj) || !Array.isArray(newObj)) {
        breaking.push({
          type: 'TYPE_CHANGED',
          path: currentPath || '(root)',
          message: 'Array type changed'
        });
        return;
      }
      // For plain arrays we only warn on structural issues; deep item compare is limited
      return;
    }

    // Plain object keys
    for (const key of Object.keys(oldObj)) {
      const childPath = `${pathPrefix}${key}`;

      if (!(key in newObj)) {
        breaking.push({
          type: 'FIELD_REMOVED',
          path: childPath,
          message: `Field "${key}" was removed`
        });
      } else {
        const oldType = this._getType(oldObj[key]);
        const newType = this._getType(newObj[key]);

        if (oldType !== newType && opts.treatTypeChangeAsBreaking) {
          breaking.push({
            type: 'TYPE_CHANGED',
            path: childPath,
            oldType,
            newType,
            message: `Type of "${key}" changed from ${oldType} to ${newType}`
          });
        } else if (oldType === 'object' || oldType === 'array') {
          this._comparePlainObject(oldObj[key], newObj[key], childPath, breaking, nonBreaking, opts);
        }
      }
    }

    // New keys are non-breaking
    for (const key of Object.keys(newObj)) {
      if (!(key in oldObj)) {
        nonBreaking.push({
          type: 'FIELD_ADDED',
          path: `${pathPrefix}${key}`,
          message: `New field "${key}" added`
        });
      }
    }
  }
}

module.exports = ComparatorEngine;
