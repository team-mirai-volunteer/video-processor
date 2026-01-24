/**
 * Result type for domain operations
 * Used to express all possible errors as domain types
 */
export type Result<T, E> = { success: true; value: T } | { success: false; error: E };

/**
 * Helper to create a success result
 */
export function ok<T, E>(value: T): Result<T, E> {
  return { success: true, value };
}

/**
 * Helper to create a failure result
 */
export function err<T, E>(error: E): Result<T, E> {
  return { success: false, error };
}
