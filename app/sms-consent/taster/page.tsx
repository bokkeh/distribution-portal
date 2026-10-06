import { TasterSmsConsent } from '@/components/profile/TasterSmsConsent'
import { TASTER_SMS_CONSENT_COPY } from '@/lib/telnyx/taster-consent'

export const metadata = { title: 'Taster SMS consent form | AHAWC', robots: { index: false, follow: false } }

export default function TasterConsentPreview() {
  return <main className="mx-auto max-w-2xl space-y-5 px-6 py-10">
    <h1 className="text-2xl font-semibold">AHAWC taster SMS consent form</h1>
    <p>This public preview shows the same consent form available to authenticated tasters in My Profile. No phone numbers or birthdates are published.</p>
    <TasterSmsConsent preview enabled={false} phone={null} consentCopy={TASTER_SMS_CONSENT_COPY} />
  </main>
}
