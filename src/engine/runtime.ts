import type { RowData } from './types';

// ─── Field Accessor Cache ────────────────────────────────────────────────────

type Accessor = (obj: RowData) => unknown;
const accessorCache = new Map<string, Accessor>();

export function getFieldAccessor(path: string[]): Accessor {
  const key = path.join('.');
  let fn = accessorCache.get(key);
  if (fn) return fn;

  if (path.length === 1) {
    const field = path[0];
    fn = (obj: RowData) => obj[field];
  } else {
    const segments = [...path]; // snapshot
    fn = (obj: RowData) => {
      let val: unknown = obj;
      for (const segment of segments) {
        if (val == null) return undefined;
        val = (val as RowData)[segment];
      }
      return val;
    };
  }

  accessorCache.set(key, fn);
  return fn;
}

// ─── Comparison ──────────────────────────────────────────────────────────────

export function compareValues(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (a == null && b == null) return 0;
  if (a == null) return -1;
  if (b == null) return 1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b));
}

// ─── Group By ────────────────────────────────────────────────────────────────

export interface GroupResult {
  keys: RowData;
  rows: RowData[];
}

export function groupByFn(
  data: RowData[],
  keyFns: Array<{ fn: Accessor; name: string }>,
): GroupResult[] {
  const groups = new Map<string, GroupResult>();

  if (keyFns.length === 1) {
    // Fast path: single key, no JSON.stringify
    const { fn, name } = keyFns[0];
    for (const row of data) {
      const val = fn(row);
      const groupKey = String(val);
      let group = groups.get(groupKey);
      if (!group) {
        group = { keys: { [name]: val }, rows: [] };
        groups.set(groupKey, group);
      }
      group.rows.push(row);
    }
  } else {
    // Multi-key: delimiter-joined string instead of JSON.stringify
    for (const row of data) {
      const keys: RowData = {};
      let groupKey = '';
      for (let i = 0; i < keyFns.length; i++) {
        const { fn, name } = keyFns[i];
        const val = fn(row);
        keys[name] = val;
        groupKey += (i > 0 ? '\x00' : '') + String(val);
      }
      let group = groups.get(groupKey);
      if (!group) {
        group = { keys, rows: [] };
        groups.set(groupKey, group);
      }
      group.rows.push(row);
    }
  }

  return Array.from(groups.values());
}

// ─── Join ────────────────────────────────────────────────────────────────────

export function nestedLoopJoin(
  left: RowData[],
  right: RowData[],
  conditionFn: (combined: RowData) => unknown,
): RowData[] {
  const result: RowData[] = [];
  for (const l of left) {
    for (const r of right) {
      const combined = { ...l, ...r };
      if (conditionFn(combined)) {
        result.push(combined);
      }
    }
  }
  return result;
}

export function hashJoin(
  left: RowData[],
  right: RowData[],
  leftKeyFn: (row: RowData) => unknown,
  rightKeyFn: (row: RowData) => unknown,
): RowData[] {
  const hashMap = new Map<unknown, RowData[]>();
  for (const r of right) {
    const key = rightKeyFn(r);
    let bucket = hashMap.get(key);
    if (!bucket) {
      bucket = [];
      hashMap.set(key, bucket);
    }
    bucket.push(r);
  }

  const result: RowData[] = [];
  for (const l of left) {
    const matches = hashMap.get(leftKeyFn(l));
    if (matches) {
      for (const r of matches) {
        result.push({ ...l, ...r });
      }
    }
  }
  return result;
}

// ─── Distinct ────────────────────────────────────────────────────────────────

export function distinctFn(
  data: RowData[],
  keyFn?: (row: RowData) => string,
): RowData[] {
  const seen = new Set<string>();
  return data.filter((row) => {
    const key = keyFn ? keyFn(row) : JSON.stringify(row);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ─── Transpose ───────────────────────────────────────────────────────────────

export function transposeFn(
  data: RowData[],
  headerFn?: (row: RowData) => unknown,
  headerFieldName?: string,
): RowData[] {
  if (data.length === 0) return [];

  const colNames: string[] = data.map((row, i) =>
    headerFn ? String(headerFn(row)) : `col_${i}`
  );

  const allFields = new Set<string>();
  for (const row of data) {
    for (const key of Object.keys(row)) {
      if (key !== '_group' && key !== headerFieldName) {
        allFields.add(key);
      }
    }
  }

  const results: RowData[] = [];
  for (const field of allFields) {
    const row: RowData = { _field: field };
    for (let i = 0; i < data.length; i++) {
      row[colNames[i]] = data[i][field] ?? null;
    }
    results.push(row);
  }
  return results;
}

// ─── Rollup ──────────────────────────────────────────────────────────────────

type AggDef = { fn: (row: RowData) => unknown; name: string };

export function rollupFn(
  data: RowData[],
  keyFns: Array<{ fn: Accessor; name: string }>,
  aggFns: AggDef[],
): RowData[] {
  const results: RowData[] = [];
  const numKeys = keyFns.length;

  for (let level = 0; level <= numKeys; level++) {
    const activeKeys = keyFns.slice(0, numKeys - level);
    const groups = groupByFn(data, activeKeys);

    for (const group of groups) {
      const row: RowData = {};
      for (const { name } of activeKeys) {
        row[name] = group.keys[name];
      }
      for (let i = numKeys - level; i < numKeys; i++) {
        row[keyFns[i].name] = null;
      }
      const groupedRow: RowData = { ...row, _group: group.rows };
      for (const { fn, name } of aggFns) {
        row[name] = fn(groupedRow);
      }
      row._rollupLevel = level;
      results.push(row);
    }
  }
  return results;
}

// ─── Pivot ───────────────────────────────────────────────────────────────────

function defaultForAggregate(name: string): unknown {
  if (name === 'min' || name === 'max') return null;
  return 0;
}

export function pivotFlatFn(
  data: RowData[],
  pivotFn: (row: RowData) => unknown,
  aggCompilers: AggDef[],
  singleAggregate: boolean,
): RowData[] {
  const pivotGroups = new Map<string, RowData[]>();
  for (const row of data) {
    const pivotVal = String(pivotFn(row));
    if (!pivotGroups.has(pivotVal)) pivotGroups.set(pivotVal, []);
    pivotGroups.get(pivotVal)!.push(row);
  }

  const result: RowData = {};
  for (const [pivotVal, groupRows] of pivotGroups) {
    const syntheticRow: RowData = { _group: groupRows };
    const safeName = pivotVal.replace(/\s+/g, '_');
    for (const { fn, name } of aggCompilers) {
      const colName = singleAggregate ? safeName : `${name}_${safeName}`;
      result[colName] = fn(syntheticRow);
    }
  }
  return [result];
}

export function pivotGroupedFn(
  data: RowData[],
  pivotFn: (row: RowData) => unknown,
  aggCompilers: AggDef[],
  singleAggregate: boolean,
): RowData[] {
  // Discover all unique pivot values across all groups
  const allPivotValues = new Set<string>();
  for (const groupRow of data) {
    const groupData = groupRow._group as RowData[];
    for (const row of groupData) {
      allPivotValues.add(String(pivotFn(row)));
    }
  }

  return data.map((groupRow) => {
    const groupData = groupRow._group as RowData[];
    const result: RowData = {};

    for (const key of Object.keys(groupRow)) {
      if (key !== '_group') result[key] = groupRow[key];
    }

    const subGroups = new Map<string, RowData[]>();
    for (const row of groupData) {
      const pivotVal = String(pivotFn(row));
      if (!subGroups.has(pivotVal)) subGroups.set(pivotVal, []);
      subGroups.get(pivotVal)!.push(row);
    }

    for (const pivotVal of allPivotValues) {
      const subGroupRows = subGroups.get(pivotVal) || [];
      const syntheticRow: RowData = { _group: subGroupRows };
      const safeName = pivotVal.replace(/\s+/g, '_');
      for (const { fn, name } of aggCompilers) {
        const colName = singleAggregate ? safeName : `${name}_${safeName}`;
        result[colName] = subGroupRows.length > 0 ? fn(syntheticRow) : defaultForAggregate(name);
      }
    }

    return result;
  });
}

// ─── Window Functions ────────────────────────────────────────────────────────

export interface WindowDef {
  id: string;
  name: string;
  fieldFn?: (row: RowData) => unknown;
  offset: number;
}

export function computeWindowValues(
  data: RowData[],
  windowDefs: WindowDef[],
): Record<string, unknown>[] {
  const n = data.length;
  const results: Record<string, unknown>[] = Array.from({ length: n }, () => ({}));

  for (const def of windowDefs) {
    switch (def.name) {
      case 'row_number':
      case 'running_count':
        for (let i = 0; i < n; i++) results[i][def.id] = i + 1;
        break;

      case 'running_sum': {
        let acc = 0;
        for (let i = 0; i < n; i++) {
          acc += Number(def.fieldFn!(data[i]));
          results[i][def.id] = acc;
        }
        break;
      }

      case 'running_avg': {
        let acc = 0;
        for (let i = 0; i < n; i++) {
          acc += Number(def.fieldFn!(data[i]));
          results[i][def.id] = acc / (i + 1);
        }
        break;
      }

      case 'running_min': {
        let min = Infinity;
        for (let i = 0; i < n; i++) {
          const val = Number(def.fieldFn!(data[i]));
          if (val < min) min = val;
          results[i][def.id] = min;
        }
        break;
      }

      case 'running_max': {
        let max = -Infinity;
        for (let i = 0; i < n; i++) {
          const val = Number(def.fieldFn!(data[i]));
          if (val > max) max = val;
          results[i][def.id] = max;
        }
        break;
      }

      case 'lag': {
        const offset = def.offset;
        for (let i = 0; i < n; i++) {
          results[i][def.id] = i >= offset ? def.fieldFn!(data[i - offset]) : null;
        }
        break;
      }

      case 'lead': {
        const offset = def.offset;
        for (let i = 0; i < n; i++) {
          results[i][def.id] = i + offset < n ? def.fieldFn!(data[i + offset]) : null;
        }
        break;
      }
    }
  }
  return results;
}
