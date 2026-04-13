// src/lib/assert.ts
export function assertDefined<T>(
  val: T | undefined,
  msg: string
): asserts val is T {
  if (val === undefined) throw new Error(msg);
}
