export async function sendSms({ to, body }: { to: string; body: string }): Promise<void> {
  const apiKey = process.env.TELNYX_API_KEY
  const from = process.env.TELNYX_FROM_NUMBER

  if (!apiKey || !from) {
    console.warn('Telnyx not configured — SMS not sent')
    return
  }

  try {
    const res = await fetch('https://api.telnyx.com/v2/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ from, to, text: body }),
    })

    if (!res.ok) {
      const err = await res.json()
      console.error('Telnyx SMS failed:', err)
    }
  } catch (error) {
    console.error('Telnyx SMS error:', error)
  }
}
