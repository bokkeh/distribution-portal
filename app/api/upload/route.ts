import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { generateSignedUploadUrl } from '@/lib/gcs/client'
import { v4 as uuidv4 } from 'uuid'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { filename, contentType, folder } = await req.json()

  const ext = filename.split('.').pop()
  const uniqueFilename = `${uuidv4()}.${ext}`

  const url = await generateSignedUploadUrl(uniqueFilename, contentType, folder ?? 'uploads')

  return NextResponse.json({ url, filename: uniqueFilename })
}
