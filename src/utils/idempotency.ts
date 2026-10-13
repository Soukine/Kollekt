/**
 * Idempotency protection to prevent double clicks, accidental double scans,
 * or concurrent duplicate operations.
 */

const executedKeys = new Set<string>();

export function generateIdempotencyKey(prefix: string, customerId: string, timestamp: number = Date.now()): string {
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  return `${prefix}_${customerId}_${timestamp}_${randomSuffix}`;
}

export function checkAndMarkIdempotent(key: string): boolean {
  if (executedKeys.has(key)) {
    return false; // Already executed
  }
  executedKeys.add(key);
  // Keep memory clean by removing key after 10 minutes
  setTimeout(() => {
    executedKeys.delete(key);
  }, 10 * 60 * 1000);
  return true;
}
