/**
 * Idempotency & Mutex concurrency protection.
 * Prevents double clicks, accidental double scans, and concurrent simultaneous requests
 * across transactions and customer loyalty cards.
 */

const executedKeys = new Set<string>();
const activeLocks = new Set<string>();

/**
 * Generate a unique idempotency key with optional nonce.
 */
export function generateIdempotencyKey(
  prefix: string,
  customerId: string,
  nonce?: string
): string {
  const suffix = nonce || Math.random().toString(36).substring(2, 9);
  return `${prefix}_${customerId}_${suffix}`;
}

/**
 * Checks if a key has already been executed.
 * Returns true if this is the FIRST execution, false if already executed (duplicate).
 */
export function checkAndMarkIdempotent(key: string): boolean {
  if (executedKeys.has(key)) {
    return false; // Already executed
  }
  executedKeys.add(key);
  // Auto-expire after 10 minutes
  setTimeout(() => {
    executedKeys.delete(key);
  }, 10 * 60 * 1000);
  return true;
}

/**
 * In-flight Mutex lock to prevent simultaneous concurrent requests on the same card.
 * Returns true if lock was acquired, false if an operation is ALREADY in flight.
 */
export function acquireOperationLock(resourceId: string): boolean {
  if (activeLocks.has(resourceId)) {
    return false;
  }
  activeLocks.add(resourceId);
  return true;
}

/**
 * Releases the in-flight mutex lock.
 */
export function releaseOperationLock(resourceId: string): void {
  activeLocks.delete(resourceId);
}

/**
 * Clear cache for unit tests or dev resets.
 */
export function clearIdempotencyCache(): void {
  executedKeys.clear();
  activeLocks.clear();
}
