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

const ALLOWED_FOLDERS = new Set(['uploads', 'avatars', 'documents', 'tastings', 'products', 'sales-routes', 'deliveries', 'account-media'])

function validateFolder(folder: string): string {
  if (!ALLOWED_FOLDERS.has(folder)) throw new Error(`Invalid upload folder: ${folder}`)
  return folder
}

export async function generateSignedUploadUrl(
  filename: string,
  contentType: string,
  folder: string = 'uploads'
): Promise<{ uploadUrl: string; publicUrl: string }> {
  validateFolder(folder)
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

export async function uploadBuffer(
  filename: string,
  contentType: string,
  buffer: Buffer,
  folder: string = 'uploads'
): Promise<{ publicUrl: string; filePath: string }> {
  validateFolder(folder)
  const storage = getStorage()
  const bucket = storage.bucket(process.env.GCS_BUCKET_NAME ?? '')
  const filePath = `${folder}/${filename}`
  const file = bucket.file(filePath)

  await file.save(buffer, {
    metadata: { contentType },
    resumable: false,
  })

  return {
    publicUrl: getPublicUrl(filePath),
    filePath,
  }
}

export function getPublicUrl(filePath: string): string {
  return `https://storage.googleapis.com/${process.env.GCS_BUCKET_NAME}/${filePath}`
}

/**
 * Convert a stored GCS public URL to a signed-URL proxy path.
 * Use this wherever photos are rendered — it handles the case where
 * the bucket is not publicly accessible.
 */
export function signedPhotoUrl(url: string | null | undefined): string | null {
  if (!url) return null
  return `/api/photo?url=${encodeURIComponent(url)}`
}
