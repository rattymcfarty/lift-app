/**
 * Minimal JSON Schema (draft-07) validator for the KB schemas.
 *
 * Deliberate decision: this is hand-rolled instead of ajv. ajv v8 compiles
 * schemas to functions via `new Function()`, which Hermes does not support
 * (no eval / Function constructor). A runtime crash on first KB import is
 * worse than maintaining ~150 lines of auditable validation code.
 *
 * Supports exactly the draft-07 subset the lift-kb schemas use:
 *   type (incl. unions like ["string","null"]), properties, required,
 *   additionalProperties, enum, const, pattern, minLength, minItems,
 *   minimum, maximum, items.
 * $id / $schema / title / description are ignored (metadata only).
 * $ref is NOT supported — the KB schemas are self-contained; validation
 * fails loudly if one ever appears, so it can't silently pass.
 *
 * Pure — no native modules, runs in node (tests) and Hermes identically.
 */

type JsonValue = null | boolean | number | string | JsonValue[] | { [k: string]: JsonValue };

interface Schema {
  $ref?: string;
  type?: string | string[];
  properties?: Record<string, Schema>;
  required?: string[];
  additionalProperties?: boolean | Schema;
  enum?: JsonValue[];
  const?: JsonValue;
  pattern?: string;
  minLength?: number;
  minItems?: number;
  minimum?: number;
  maximum?: number;
  items?: Schema;
  // metadata (ignored)
  $id?: string;
  $schema?: string;
  title?: string;
  description?: string;
  default?: JsonValue;
}

export interface ValidationIssue {
  path: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}

function typeOf(v: JsonValue): string {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  const t = typeof v;
  if (t === 'number') return Number.isInteger(v) ? 'integer' : 'number';
  return t; // string | boolean | object
}

function matchesType(v: JsonValue, type: string | string[]): boolean {
  const actual = typeOf(v);
  if (Array.isArray(type)) return type.some((t) => matchesType(v, t));
  // draft-07: "integer" matches integral numbers; "number" matches any number
  if (type === 'number') return actual === 'number' || actual === 'integer';
  return actual === type;
}

function validateAgainst(schema: Schema, value: JsonValue, path: string, issues: ValidationIssue[]): void {
  if (schema.$ref !== undefined) {
    issues.push({ path, message: '$ref is not supported by the KB validator' });
    return;
  }

  if (schema.type !== undefined && !matchesType(value, schema.type)) {
    const expected = Array.isArray(schema.type) ? schema.type.join('|') : schema.type;
    issues.push({ path, message: `expected type ${expected}, got ${typeOf(value)}` });
    return; // further checks are meaningless on a type mismatch
  }

  if (schema.enum !== undefined) {
    const ok = schema.enum.some((e) => JSON.stringify(e) === JSON.stringify(value));
    if (!ok) issues.push({ path, message: `value not in enum ${JSON.stringify(schema.enum)}` });
  }

  if (schema.const !== undefined && JSON.stringify(schema.const) !== JSON.stringify(value)) {
    issues.push({ path, message: `value does not match const ${JSON.stringify(schema.const)}` });
  }

  if (typeof value === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      issues.push({ path, message: `string shorter than minLength ${schema.minLength}` });
    }
    if (schema.pattern !== undefined) {
      let re: RegExp;
      try {
        re = new RegExp(schema.pattern);
      } catch {
        issues.push({ path, message: `invalid pattern ${schema.pattern}` });
        return;
      }
      if (!re.test(value)) issues.push({ path, message: `string does not match pattern ${schema.pattern}` });
    }
  }

  if (typeof value === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum) {
      issues.push({ path, message: `number ${value} below minimum ${schema.minimum}` });
    }
    if (schema.maximum !== undefined && value > schema.maximum) {
      issues.push({ path, message: `number ${value} above maximum ${schema.maximum}` });
    }
  }

  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) {
      issues.push({ path, message: `array shorter than minItems ${schema.minItems}` });
    }
    if (schema.items !== undefined) {
      value.forEach((item, i) => validateAgainst(schema.items as Schema, item, `${path}[${i}]`, issues));
    }
  }

  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    const obj = value as Record<string, JsonValue>;
    for (const key of schema.required ?? []) {
      if (!(key in obj)) issues.push({ path: path ? `${path}.${key}` : key, message: 'required property missing' });
    }
    const props = schema.properties ?? {};
    for (const key of Object.keys(obj)) {
      const sub = props[key];
      if (sub !== undefined) {
        validateAgainst(sub, obj[key], path ? `${path}.${key}` : key, issues);
      } else if (schema.additionalProperties === false) {
        issues.push({ path: path ? `${path}.${key}` : key, message: 'additional property not allowed' });
      }
    }
  }
}

/** Validate a JSON value against a draft-07 schema object. */
export function validateSchema(schema: Schema, value: unknown): ValidationResult {
  const issues: ValidationIssue[] = [];
  validateAgainst(schema, value as JsonValue, '', issues);
  return { valid: issues.length === 0, issues };
}

/** Human-readable one-line summary of validation issues (for logs/errors). */
export function formatIssues(issues: ValidationIssue[], max = 5): string {
  const shown = issues.slice(0, max).map((i) => `${i.path || '<root>'}: ${i.message}`);
  const rest = issues.length > max ? ` (+${issues.length - max} more)` : '';
  return shown.join('; ') + rest;
}
