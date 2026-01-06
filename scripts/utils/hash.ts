import { createHash } from 'crypto';

/**
 * Generate a short hash from token for cache key
 * Uses SHA-256 and takes first 12 characters
 *
 * @param token - The OAuth access token
 * @returns 12-character hash string
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex').substring(0, 12);
}
