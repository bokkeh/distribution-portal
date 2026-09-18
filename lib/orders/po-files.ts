export const PO_FILE_TYPES: Record<string, string> = {
  pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
  doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
}
export const MAX_PO_BYTES = 4 * 1024 * 1024

export function validatePoFile(name: string, size: number, bytes: Uint8Array) {
  const extension = name.split('.').pop()?.toLowerCase() ?? ''
  const contentType = PO_FILE_TYPES[extension]
  if (!contentType) return { error: 'Use a PDF, JPG, PNG, WebP, DOC or DOCX file.' } as const
  if (!size || size > MAX_PO_BYTES) return { error: 'Files must be between 1 byte and 4 MB.' } as const
  const starts = (...signature: number[]) => signature.every((byte, index) => bytes[index] === byte)
  const matches = extension === 'pdf' ? starts(0x25, 0x50, 0x44, 0x46, 0x2d)
    : ['jpg', 'jpeg'].includes(extension) ? starts(0xff, 0xd8, 0xff)
    : extension === 'png' ? starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)
    : extension === 'webp' ? starts(0x52, 0x49, 0x46, 0x46) && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
    : extension === 'doc' ? starts(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1)
    : starts(0x50, 0x4b, 0x03, 0x04)
  if (!matches) return { error: 'The file contents do not match its extension.' } as const
  return { extension, contentType } as const
}
