import { Storage } from '@google-cloud/storage'

let _storage: Storage | null = null

function normalizePrivateKey(value: string | undefined) {
  if (!value) return undefined

  let normalized = value.trim()

  if (
    (normalized.startsWith('"') && normalized.endsWith('"')) ||
    (normalized.startsWith("'") && normalized.endsWith("'"))
  ) {
    normalized = normalized.slice(1, -1)
  }

  return normalized.replace(/\\n/g, '\n')
}

function getStorage() {
  if (!_storage) {
    _storage = new Storage({
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
      credentials: {
        client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
        private_key: normalizePrivateKey(process.env.GOOGLE_CLOUD_PRIVATE_KEY),
      },
    })
  }
  return _storage
}

export async function generateSignedUploadUrl(
  filename: string,
  contentType: string,
  folder: string = 'uploads'
): Promise<{ uploadUrl: string; publicUrl: string }> {
  const storage = getStorage()
  const bucket = storage.bucket(process.env.GCS_BUCKET_NAME ?? '')
  const filePath = `${folder}/${filename}`
  const file = bucket.file(filePath)

  const [uploadUrl] = await file.getSignedUrl({
    action: 'write',
    expires: Date.now() + 15 * 60 * 1000, // 15 minutes
    contentType,
  })

  return { uploadUrl, publicUrl: getPublicUrl(filePath) }
}

export async function generateSignedReadUrl(filePath: string): Promise<string> {
  const storage = getStorage()
  const bucket = storage.bucket(process.env.GCS_BUCKET_NAME ?? '')
  const file = bucket.file(filePath)

  const [url] = await file.getSignedUrl({
    action: 'read',
    expires: Date.now() + 60 * 60 * 1000, // 1 hour
  })

  return url
}

export function getPublicUrl(filePath: string): string {
  return `https://storage.googleapis.com/${process.env.GCS_BUCKET_NAME}/${filePath}`
}
