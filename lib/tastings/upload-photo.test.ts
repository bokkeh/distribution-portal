import assert from 'node:assert/strict'
import test from 'node:test'
import { uploadTastingPhoto } from './upload-photo'

test('photos use the portal multipart endpoint and return a proxy URL', async context => {
  const photo = new File(['photo'], 'phone.jpg', { type: 'image/jpeg' })
  context.mock.method(globalThis, 'fetch', async (url: string, options: RequestInit) => {
    assert.equal(url, '/api/upload')
    assert.equal(options.method, 'POST')
    assert.equal(options.headers, undefined)
    const body = options.body as FormData
    assert.equal(body.get('folder'), 'tastings')
    assert.equal(body.get('filename'), 'setup-phone.jpg')
    assert.equal((body.get('file') as File).size, photo.size)
    return Response.json({ publicUrl: '/api/image?path=tastings%2Fphoto.jpg' })
  })
  assert.equal(await uploadTastingPhoto(photo, 'setup-phone.jpg'), '/api/image?path=tastings%2Fphoto.jpg')
})

test('server upload failures are surfaced instead of saving an empty URL', async context => {
  context.mock.method(globalThis, 'fetch', async () => Response.json({ error: 'Upload limit reached' }, { status: 429 }))
  await assert.rejects(uploadTastingPhoto(new File(['photo'], 'phone.jpg'), 'phone.jpg'), /Upload limit reached/)
})

test('oversized request responses give a useful photo-size error', async context => {
  context.mock.method(globalThis, 'fetch', async () => new Response('Too large', { status: 413 }))
  await assert.rejects(uploadTastingPhoto(new File(['photo'], 'phone.jpg'), 'phone.jpg'), /under 3MB/)
})
