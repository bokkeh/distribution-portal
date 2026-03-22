export function toDisplayAvatarUrl(avatarUrl: string | null | undefined): string | null {
  if (!avatarUrl) return null

  if (avatarUrl.startsWith('https://storage.googleapis.com/')) {
    const filePath = avatarUrl.replace(/^https:\/\/storage\.googleapis\.com\/[^/]+\//, '')
    return `/api/image?path=${encodeURIComponent(filePath)}`
  }

  return avatarUrl
}
