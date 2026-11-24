import { env } from 'cloudflare:workers'

export async function sendWhatsApp(number, lines) {
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_MESSAGING_SERVICE_SID, TWILIO_CONTENT_SID } = env
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_MESSAGING_SERVICE_SID || !TWILIO_CONTENT_SID) {
    return 'WhatsApp delivery needs a connected provider.'
  }
  if (!/^\+[1-9]\d{6,14}$/.test(number)) return 'Check your WhatsApp number in Settings.'
  try {
    const result = await fetch('https://api.twilio.com/2010-04-01/Accounts/' + encodeURIComponent(TWILIO_ACCOUNT_SID) + '/Messages.json', {
      method: 'POST',
      headers: { Authorization: 'Basic ' + btoa(TWILIO_ACCOUNT_SID + ':' + TWILIO_AUTH_TOKEN) },
      body: new URLSearchParams({
        To: 'whatsapp:' + number, MessagingServiceSid: TWILIO_MESSAGING_SERVICE_SID, ContentSid: TWILIO_CONTENT_SID,
        ContentVariables: JSON.stringify({ 1: lines.join(' | ').slice(0, 1000) }),
      }),
    })
    return result.ok ? 'WhatsApp digest queued.' : 'The WhatsApp provider could not accept the digest.'
  } catch { return 'The WhatsApp provider could not be reached.' }
}
