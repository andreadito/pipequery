import type { Expression, Operation, SortOp } from '../engine/types';
import { DataWeaveError, ParseError } from '../engine/types';
import { parseQuery } from '../engine/index';
import { assertIdentifier, printQuery } from '../engine/print';

/** Error thrown by the builder for invalid input (bad names, arities, misplaced expressions). */
export class BuilderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BuilderError';
  }
}

const WRAPPER = '_data | ';

/** Run `fn`, re-labelling printer errors as builder errors. */
function relabel<T>(fn: () => T): T {
  try {
    return fn();
  } catch (e) {
    if (e instanceof Error && e.name === 'Error' && e.message.startsWith('printQuery: ')) {
      throw new BuilderError(e.message.slice('printQuery: '.length));
    }
    throw e;
  }
}

export function checkIdentifier(name: unknown, what: string): string {
  return relabel(() => assertIdentifier(name, what));
}

/** Validate a single operation in isolation with the printer (alias placement, arities, names). */
export function validateOperation(op: Operation): void {
  relabel(() => printQuery({ kind: 'Pipeline', source: '_data', operations: [op] }));
}

export function validateSource(name: unknown): string {
  return checkIdentifier(name, 'source name');
}

/**
 * Parse `_data | <raw>` with the real parser and return the operations.
 * Error positions are shifted so they point into `raw` (for the first line).
 */
export function parseOperations(
  raw: string,
  wrapperLength = 0,
  label?: string,
  internalName?: string,
): Operation[] {
  if (typeof raw !== 'string') {
    throw new BuilderError(`${label ? `${label}: ` : ''}expected a pipequery string but got ${typeof raw}`);
  }
  const shift = WRAPPER.length + wrapperLength;
  try {
    return parseQuery(WRAPPER + raw).operations;
  } catch (e) {
    if (e instanceof DataWeaveError) {
      if (e.line === 1 && e.position >= shift) {
        e.position -= shift;
        e.column -= shift;
      }
      // Name the method the user called; the error class and position are preserved.
      if (label) {
        let message = e.message;
        if (internalName) {
          // The parser mentions the wrapper op (`after groupBy arguments`); show the user's method instead.
          const method = /^(\w+)\(\)/.exec(label)?.[1];
          message = method
            ? message.replace(new RegExp(`\\b${internalName}\\b`, 'g'), method)
            : message.replace(new RegExp(`\\s*\\b${internalName} arguments`, 'g'), ' the expression');
        }
        e.message = `${label}: ${message}`;
      }
    }
    throw e;
  }
}

/** Parse `name(<raw>)` and require that it yields exactly one operation of `kind`. */
export function parseSingleOp<K extends Operation['kind']>(
  name: string,
  raw: string,
  kind: K,
  prefix = '',
  label = `${name}()`,
): Extract<Operation, { kind: K }> {
  const ops = parseOperations(`${name}(${prefix}${raw})`, name.length + 1 + prefix.length, label, name);
  if (ops.length !== 1 || ops[0].kind !== kind) {
    throw new ParseError(
      `${label}: invalid argument ${JSON.stringify(raw)}: expected a single argument list`,
      0, 1, 1,
    );
  }
  return ops[0] as Extract<Operation, { kind: K }>;
}

/**
 * Comma separated expressions that may carry `as` aliases (select, map, rollup, ...).
 * `label` is the user-facing position used in error messages, e.g. `rollup()`.
 */
export function parseExprList(raw: string, label = 'select()'): Expression[] {
  return parseSingleOp('select', raw, 'SelectOp', '', label).fields;
}

/** Comma separated expressions without aliases (groupBy keys, distinct fields, ...). */
export function parseOrExprList(raw: string, label = 'groupBy()'): Expression[] {
  return parseSingleOp('groupBy', raw, 'GroupByOp', '', label).keys;
}

export function parseSortCriteria(raw: string, label = 'sort()'): SortOp['criteria'] {
  return parseSingleOp('sort', raw, 'SortOp', '', label).criteria;
}

/** Exactly one expression without alias (field positions of aggregates and window functions). */
export function parseFieldExpr(raw: string, label = 'field'): Expression {
  const keys = parseOrExprList(raw, label);
  if (keys.length !== 1) {
    throw new ParseError(
      `${label}: expected exactly one expression but got ${keys.length} in ${JSON.stringify(raw)}`,
      0, 1, 1,
    );
  }
  return keys[0];
}
