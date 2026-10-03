const MAX_UPLOAD_BYTES = 3 * 1024 * 1024

async function preparePhoto(file: File): Promise<Blob> {
  if (file.size <= MAX_UPLOAD_BYTES) return file

  const url = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    const scale = Math.min(1, 2000 / Math.max(image.naturalWidth, image.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Could not prepare this photo.')
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    const photo = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Could not prepare this photo.')), 'image/jpeg', 0.8)
    })
    if (photo.size > MAX_UPLOAD_BYTES) throw new Error('Please choose a smaller photo (under 3MB).')
    return photo
  } catch (error) {
    if (error instanceof Error && error.message.includes('3MB')) throw error
    throw new Error('Could not prepare this photo. Try a JPEG or PNG photo under 3MB.')
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function uploadTastingPhoto(file: File, filename: string): Promise<string> {
  const photo = await preparePhoto(file)
  const formData = new FormData()
  formData.set('file', photo, photo === file ? filename : `${filename.replace(/\.[^.]+$/, '')}.jpg`)
  formData.set('filename', photo === file ? filename : `${filename.replace(/\.[^.]+$/, '')}.jpg`)
  formData.set('folder', 'tastings')

  // Same-origin uploads avoid the bucket's browser CORS restrictions.
  const response = await fetch('/api/upload', { method: 'POST', body: formData })
  const payload = await response.json().catch(() => null)
  if (!response.ok || !payload?.publicUrl) {
    throw new Error(payload?.error || (response.status === 413
      ? 'Please choose a smaller photo (under 3MB).'
      : 'Photo upload failed. Please try again.'))
  }
  return String(payload.publicUrl)
}
