// D1 allows at most 100 bound parameters per query

export const MAX_PARAMS = 99;

/** Splits rows so that each insert statement stays under the parameter limit */
export function chunkRows<T>(rows: T[], columnsPerRow: number): T[][] {
  const size = Math.max(1, Math.floor(MAX_PARAMS / columnsPerRow));
  return chunk(rows, size);
}

/** For `inArray(column, values)`: leaves room for a few other parameters */
export function chunkValues<T>(values: T[], size = 90): T[][] {
  return chunk(values, size);
}

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
