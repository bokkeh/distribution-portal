import { Storage } from '@google-cloud/storage'

let _storage: Storage | null = null

function getStorage() {
  if (!_storage) {
    _storage = new Storage({
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
      credentials: {
        client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      },
    })
  }
  return _storage
}

export async function generateSignedUploadUrl(filename: string, contentType: string, folder: string = 'uploads'): Promise<string> {
  const storage = getStorage()
  const bucket = storage.bucket(process.env.GCS_BUCKET_NAME ?? '')
  const file = bucket.file(`${folder}/${filename}`)

  const [url] = await file.generateSignedPostPolicyV4({
    expires: Date.now() + 15 * 60 * 1000, // 15 minutes
    conditions: [
      ['content-length-range', 0, 10 * 1024 * 1024], // 10MB max
      ['eq', '$Content-Type', contentType],
    ],
    fields: { 'Content-Type': contentType },
  })

  return `https://storage.googleapis.com/${process.env.GCS_BUCKET_NAME}/${folder}/${filename}`
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
