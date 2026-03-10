export async function postGoogleChat(text: string): Promise<void> {
  const webhookUrl = process.env.GOOGLE_CHAT_WEBHOOK_URL
  if (!webhookUrl) return

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    })
  } catch (error) {
    console.error('Google Chat webhook failed:', error)
  }
}

export async function postGoogleChatCard(title: string, text: string): Promise<void> {
  const webhookUrl = process.env.GOOGLE_CHAT_WEBHOOK_URL
  if (!webhookUrl) return

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cards: [{
          header: { title: 'AHAWC Portal', subtitle: title },
          sections: [{ widgets: [{ textParagraph: { text } }] }],
        }],
      }),
    })
  } catch (error) {
    console.error('Google Chat webhook failed:', error)
  }
}
