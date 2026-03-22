/**
 * Converts a stored GCS public URL to the signed-URL proxy path.
 * Works in both server and client components (no Node.js imports).
 */
export function signedPhotoUrl(url: string | null | undefined): string | null {
  if (!url) return null
  // Already a proxy URL — don't double-wrap
  if (url.startsWith('/api/photo') || url.startsWith('/api/image')) return url
  return `/api/photo?url=${encodeURIComponent(url)}`
}
